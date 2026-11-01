from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

import oracledb

from app.models.overview import Overview, Section

# These rows add up to the current SGA. The other V$SGAINFO rows are settings
# or overlap with these, so adding them would count memory twice.
SGA_COMPONENTS = {
    "Fixed SGA Size",
    "Redo Buffers",
    "Buffer Cache Size",
    "In-Memory Area Size",
    "Shared Pool Size",
    "Large Pool Size",
    "Java Pool Size",
    "Streams Pool Size",
    "Data Transfer Cache Size",
}

PGA_STATISTICS = {
    "aggregate PGA target parameter",
    "total PGA allocated",
    "total PGA inuse",
    "total freeable PGA memory",
    "maximum PGA allocated",
    "process count",
}


def fetch_all(connection: oracledb.Connection, sql: str) -> list[dict]:
    with connection.cursor() as cursor:
        cursor.execute(sql)
        columns = [column[0].lower() for column in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]


def fetch_one(connection: oracledb.Connection, sql: str) -> dict:
    return fetch_all(connection, sql)[0]


def read_sga(connection: oracledb.Connection) -> dict:
    rows = fetch_all(connection, "SELECT name, bytes, resizeable FROM v$sgainfo")
    components = [row for row in rows if row["name"] in SGA_COMPONENTS]

    return {
        "components": components,
        "other": [row for row in rows if row["name"] not in SGA_COMPONENTS],
        "total_bytes": sum(row["bytes"] for row in components),
    }


def read_pga(connection: oracledb.Connection) -> list[dict]:
    rows = fetch_all(connection, "SELECT name, value, unit FROM v$pgastat")
    return [row for row in rows if row["name"] in PGA_STATISTICS]

def read_sessions(connection: oracledb.Connection) -> dict:
    rows = fetch_all(
        connection,
        "SELECT type, status, COUNT(*) AS total FROM v$session GROUP BY type, status",
    )

    return {
        "groups": rows,
        "user_total": sum(row["total"] for row in rows if row["type"] == "USER"),
        "background_total": sum(row["total"] for row in rows if row["type"] == "BACKGROUND"),
    }


def read_processes(connection: oracledb.Connection) -> dict:
    rows = fetch_all(
        connection,
        "SELECT pid, pname, spid, program, background FROM v$process ORDER BY pname, pid",
    )
    background = [row for row in rows if row["background"] == "1"]

    return {
        "background": background,
        "background_total": len(background),
        "other_total": len(rows) - len(background),
    }

def read_storage(connection: oracledb.Connection) -> dict:
    pdbs = fetch_all(connection, "SELECT con_id, name, open_mode, total_size FROM v$pdbs")
    tablespaces = fetch_all(connection, "SELECT con_id, ts# AS ts_id, name FROM v$tablespace")
    datafiles = fetch_all(
        connection,
        "SELECT con_id, ts# AS ts_id, file# AS file_id, name, bytes, status FROM v$datafile",
    )
    tempfiles = fetch_all(
        connection,
        "SELECT con_id, ts# AS ts_id, file# AS file_id, name, bytes, status FROM v$tempfile",
    )

    # V$PDBS leaves out the root, so it is added by its fixed Oracle name.
    containers = {row["con_id"]: row for row in pdbs}
    if any(row["con_id"] == 1 for row in tablespaces):
        containers[1] = {"con_id": 1, "name": "CDB$ROOT", "open_mode": None, "total_size": None}

    result = []
    for con_id in sorted(containers):
        container_tablespaces = []

        for tablespace in tablespaces:
            if tablespace["con_id"] != con_id:
                continue

            key = (con_id, tablespace["ts_id"])
            data = [f for f in datafiles if (f["con_id"], f["ts_id"]) == key]
            temp = [f for f in tempfiles if (f["con_id"], f["ts_id"]) == key]

            container_tablespaces.append({
                "name": tablespace["name"],
                "kind": "temporary" if temp else "permanent",
                "bytes": sum(f["bytes"] for f in data + temp),
                "files": data + temp,
            })

        result.append({
            **containers[con_id],
            "bytes": sum(t["bytes"] for t in container_tablespaces),
            "tablespaces": sorted(container_tablespaces, key=lambda t: t["name"]),
        })

    return {"containers": result}


def collect_section(source: str, read: Callable[[], Any]) -> Section:
    collected_at = datetime.now(timezone.utc)

    try:
        return Section(
            status="ok",
            source=source,
            collected_at=collected_at,
            data=read(),
        )
    except oracledb.Error as exc:
        return Section(
            status="error",
            source=source,
            collected_at=collected_at,
            error=str(exc),
        )


def collect_overview(connection: oracledb.Connection) -> Overview:
    return Overview(
        database=collect_section(
            "V$DATABASE",
            lambda: fetch_one(
                connection,
                "SELECT name, cdb, open_mode, log_mode, database_role FROM v$database",
            ),
        ),
        instance=collect_section(
            "V$INSTANCE",
            lambda: fetch_one(
                connection,
                "SELECT instance_name, host_name, version_full, status, startup_time FROM v$instance",
            ),
        ),
        sga=collect_section("V$SGAINFO", lambda: read_sga(connection)),
        pga=collect_section("V$PGASTAT", lambda: read_pga(connection)),
        sessions=collect_section("V$SESSION", lambda: read_sessions(connection)),
        processes=collect_section("V$PROCESS", lambda: read_processes(connection)),
        storage=collect_section(
            "V$PDBS, V$TABLESPACE, V$DATAFILE, V$TEMPFILE",
            lambda: read_storage(connection),
        ),
    )