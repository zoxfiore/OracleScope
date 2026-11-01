from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel


class Section(BaseModel):
    status: Literal["ok", "error"]
    source: str
    collected_at: datetime
    data: Any = None
    error: str | None = None


class Overview(BaseModel):
    database: Section
    instance: Section
    sga: Section
    pga: Section
    sessions: Section
    processes: Section
    storage: Section