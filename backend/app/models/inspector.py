from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class SqlRequest(BaseModel):
    sql: str = Field(min_length=1, max_length=20000)


class PlanStep(BaseModel):
    id: int
    parent_id: int | None
    operation: str
    options: str | None
    object_name: str | None
    estimated_rows: int | None
    starts: int | None
    actual_rows: int | None
    buffer_gets: int | None
    disk_reads: int | None
    elapsed_us: int | None
    access_predicates: str | None
    filter_predicates: str | None


class StatisticChange(BaseModel):
    name: str
    change: int


class WaitChange(BaseModel):
    event: str
    wait_class: str
    waits: int
    time_us: int


class BackgroundChange(BaseModel):
    process: str
    event: str
    waits: int
    time_us: int


class ServerProcess(BaseModel):
    sid: int
    serial: int
    username: str | None
    oracle_pid: int
    os_pid: str


class ExecutionRecord(BaseModel):
    id: int
    sql: str
    status: Literal["ok", "error"]
    executed_at: datetime
    error: str | None = None
    elapsed_ms: float | None = None
    columns: list[str] = []
    rows: list[list[Any]] = []
    rows_fetched: int = 0
    fully_fetched: bool = True
    sql_id: str | None = None
    child_number: int | None = None
    plan: list[PlanStep] = []
    statistics: list[StatisticChange] = []
    waits: list[WaitChange] = []
    background: list[BackgroundChange] = []
    process: ServerProcess | None = None
    warnings: list[str] = []
