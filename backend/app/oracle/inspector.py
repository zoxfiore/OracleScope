import re
import threading
import time
from collections.abc import Callable
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import oracledb

from app.models.inspector import (
    BackgroundChange,
    ExecutionRecord,
    PlanStep,
    ServerProcess,
    StatisticChange,
    WaitChange,
)
from app.oracle.collectors import fetch_all

CALL_TIMEOUT_MS = 30_000
MAX_RUN_SECONDS = 30
MAX_ROWS_FETCHED = 1_000_000
MAX_ROWS_KEPT = 100
MAX_VALUE_LENGTH = 500
MAX_HISTORY = 50

TRACKED_STATISTICS = (
    "session logical reads",
    "physical reads",
    "redo size",
    "sorts (memory)",
    "sorts (disk)",
    "table scans (long tables)",
    "parse count (hard)",
)

BACKGROUND_PROCESSES = ("LGWR", "LG00", "LG01", "DBW0", "CKPT", "ARC0")

STATISTICS_SQL = f"""
    SELECT n.name, s.value
    FROM v$mystat s
    JOIN v$statname n ON n.statistic# = s.statistic#
    WHERE n.name IN ({", ".join(f"'{name}'" for name in TRACKED_STATISTICS)})
"""

WAITS_SQL = """
    SELECT event, wait_class, total_waits, time_waited_micro
    FROM v$session_event
    WHERE sid = SYS_CONTEXT('USERENV', 'SID') AND wait_class <> 'Idle'
"""

BACKGROUND_SQL = f"""
    SELECT p.pname, e.event, e.total_waits, e.time_waited_micro
    FROM v$session_event e
    JOIN v$session s ON e.sid = s.sid
    JOIN v$process p ON s.paddr = p.addr
    WHERE s.type = 'BACKGROUND'
      AND e.wait_class = 'System I/O'
      AND p.pname IN ({", ".join(f"'{name}'" for name in BACKGROUND_PROCESSES)})
"""

CURSOR_SQL = """
    SELECT prev_sql_id, prev_child_number
    FROM v$session
    WHERE sid = SYS_CONTEXT('USERENV', 'SID')
"""

PROCESS_SQL = """
    SELECT s.sid, s.serial# AS serial, s.username, p.pid, p.spid
    FROM v$session s
    JOIN v$process p ON s.paddr = p.addr
    WHERE s.sid = SYS_CONTEXT('USERENV', 'SID')
"""

PLAN_SQL = """
    SELECT id, parent_id, operation, options, object_name, cardinality,
           last_starts, last_output_rows, last_cr_buffer_gets, last_disk_reads,
           last_elapsed_time, access_predicates, filter_predicates
    FROM v$sql_plan_statistics_all
    WHERE sql_id = :sql_id AND child_number = :child_number
    ORDER BY id
"""

LEADING_COMMENTS = re.compile(r"^(\s+|--[^\n]*\n?|/\*.*?\*/)+", re.DOTALL)


class InvalidStatementError(Exception):
    pass


def clean_statement(sql: str) -> str:
    statement = sql.strip().rstrip(";").rstrip()
    body = LEADING_COMMENTS.sub("", statement)

    if not re.match(r"(SELECT|WITH)\b", body, re.IGNORECASE):
        raise InvalidStatementError("The SQL Inspector can only run SELECT queries.")

    return statement


def to_json_value(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat(sep=" ")
    if isinstance(value, (bytes, bytearray)):
        value = value.hex()

    text = str(value)
    return text if len(text) <= MAX_VALUE_LENGTH else f"{text[:MAX_VALUE_LENGTH]}…"


class InspectorSession:
    """A dedicated Oracle session, so before-and-after numbers only contain the user's query."""

    def __init__(self, connection: oracledb.Connection):
        self.connection = connection
        self.connection.call_timeout = CALL_TIMEOUT_MS
        self.history: list[ExecutionRecord] = []
        self._lock = threading.Lock()
        self._next_id = 1

        with self.connection.cursor() as cursor:
            cursor.execute("ALTER SESSION SET statistics_level = ALL")

    def close(self) -> None:
        try:
            self.connection.close()
        except oracledb.Error:
            pass

    def execute(self, sql: str) -> ExecutionRecord:
        statement = clean_statement(sql)

        # One session can only measure one query at a time.
        with self._lock:
            record = self._run(statement)
            self._next_id += 1
            self.history.insert(0, record)
            del self.history[MAX_HISTORY:]
            return record

    def _read(
        self,
        warnings: list[str],
        label: str,
        read: Callable[[], Any],
        default: Any,
    ) -> Any:
        try:
            return read()
        except oracledb.Error as exc:
            warnings.append(f"{label}: {exc}")
            return default

    def _run(self, statement: str) -> ExecutionRecord:
        record = ExecutionRecord(
            id=self._next_id,
            sql=statement,
            status="ok",
            executed_at=datetime.now(timezone.utc),
        )
        warnings = record.warnings
        snapshot = lambda label, sql: self._read(
            warnings, label, lambda: fetch_all(self.connection, sql), []
        )

        statistics_before = snapshot("Session statistics", STATISTICS_SQL)
        waits_before = snapshot("Session waits", WAITS_SQL)
        background_before = snapshot("Background activity", BACKGROUND_SQL)

        try:
            with self.connection.cursor() as cursor:
                # Oracle itself rejects writes inside a read-only transaction.
                cursor.execute("SET TRANSACTION READ ONLY")
                started = time.perf_counter()
                cursor.execute(statement)
                self._fetch(cursor, record)
                record.elapsed_ms = (time.perf_counter() - started) * 1000
        except oracledb.Error as exc:
            record.status = "error"
            record.error = str(exc)
            self._end_transaction()
            return record

        # This must come first, because any later statement replaces "previous".
        cursor_row = self._read(
            warnings, "Execution plan", lambda: fetch_all(self.connection, CURSOR_SQL), []
        )
        statistics_after = snapshot("Session statistics", STATISTICS_SQL)
        waits_after = snapshot("Session waits", WAITS_SQL)
        background_after = snapshot("Background activity", BACKGROUND_SQL)
        self._end_transaction()

        if cursor_row:
            record.sql_id = cursor_row[0]["prev_sql_id"]
            record.child_number = cursor_row[0]["prev_child_number"]
            record.plan = self._read(warnings, "Execution plan", lambda: self._plan(record), [])

        if not record.fully_fetched:
            record.plan = []
            warnings.append(
                f"Stopped after {record.rows_fetched:,} rows. Oracle only finalises a plan "
                "once a query is read to its end, so no plan is shown. Narrow the query and "
                "run it again."
            )
        elif not record.plan:
            warnings.append("Oracle did not return an execution plan for this query.")

        record.statistics = self._statistic_changes(statistics_before, statistics_after)
        record.waits = self._wait_changes(waits_before, waits_after)
        record.background = self._background_changes(background_before, background_after)

        process_rows = snapshot("Server process", PROCESS_SQL)
        if process_rows:
            row = process_rows[0]
            record.process = ServerProcess(
                sid=row["sid"],
                serial=row["serial"],
                username=row["username"],
                oracle_pid=row["pid"],
                os_pid=row["spid"],
            )

        return record

    def _end_transaction(self) -> None:
        try:
            self.connection.rollback()
        except oracledb.Error:
            pass

    def _fetch(self, cursor: oracledb.Cursor, record: ExecutionRecord) -> None:
        # Oracle only finalises plan statistics once a query is read to its end,
        # so every row is read even though only the first few are kept.
        record.columns = [column[0] for column in cursor.description]
        deadline = time.monotonic() + MAX_RUN_SECONDS

        while record.rows_fetched < MAX_ROWS_FETCHED and time.monotonic() < deadline:
            rows = cursor.fetchmany(1000)
            if not rows:
                return

            record.rows_fetched += len(rows)
            room = MAX_ROWS_KEPT - len(record.rows)
            record.rows.extend(
                [to_json_value(value) for value in row] for row in rows[:max(room, 0)]
            )

        record.fully_fetched = False

    def _plan(self, record: ExecutionRecord) -> list[PlanStep]:
        with self.connection.cursor() as cursor:
            cursor.execute(
                PLAN_SQL,
                sql_id=record.sql_id,
                child_number=record.child_number,
            )
            return [
                PlanStep(
                    id=row[0],
                    parent_id=row[1],
                    operation=row[2],
                    options=row[3],
                    object_name=row[4],
                    estimated_rows=row[5],
                    starts=row[6],
                    actual_rows=row[7],
                    buffer_gets=row[8],
                    disk_reads=row[9],
                    elapsed_us=row[10],
                    access_predicates=row[11],
                    filter_predicates=row[12],
                )
                for row in cursor.fetchall()
            ]

    @staticmethod
    def _statistic_changes(before: list[dict], after: list[dict]) -> list[StatisticChange]:
        previous = {row["name"]: row["value"] for row in before}
        return [
            StatisticChange(name=row["name"], change=row["value"] - previous[row["name"]])
            for row in after
            if row["name"] in previous
        ]

    @staticmethod
    def _wait_changes(before: list[dict], after: list[dict]) -> list[WaitChange]:
        previous = {row["event"]: row for row in before}
        changes = []

        for row in after:
            old = previous.get(row["event"])
            waits = row["total_waits"] - (old["total_waits"] if old else 0)
            if waits > 0:
                changes.append(
                    WaitChange(
                        event=row["event"],
                        wait_class=row["wait_class"],
                        waits=waits,
                        time_us=row["time_waited_micro"] - (old["time_waited_micro"] if old else 0),
                    )
                )

        return changes

    @staticmethod
    def _background_changes(before: list[dict], after: list[dict]) -> list[BackgroundChange]:
        previous = {(row["pname"], row["event"]): row for row in before}
        changes = []

        for row in after:
            old = previous.get((row["pname"], row["event"]))
            waits = row["total_waits"] - (old["total_waits"] if old else 0)
            if waits > 0:
                changes.append(
                    BackgroundChange(
                        process=row["pname"],
                        event=row["event"],
                        waits=waits,
                        time_us=row["time_waited_micro"] - (old["time_waited_micro"] if old else 0),
                    )
                )

        return changes
