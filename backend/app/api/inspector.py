from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.models.inspector import ExecutionRecord, SqlRequest
from app.oracle.connection_manager import connection_manager
from app.oracle.inspector import InspectorSession, InvalidStatementError

router = APIRouter(
    prefix="/api/connections",
    tags=["SQL Inspector"],
)


def get_inspector(connection_id: UUID) -> InspectorSession:
    if not connection_manager.is_alive(connection_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found or no longer alive.",
        )

    return connection_manager.get_inspector(connection_id)


@router.post(
    "/{connection_id}/sql",
    response_model=ExecutionRecord,
    status_code=status.HTTP_201_CREATED,
)
def execute_sql(connection_id: UUID, request: SqlRequest):
    try:
        return get_inspector(connection_id).execute(request.sql)
    except InvalidStatementError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.get("/{connection_id}/sql", response_model=list[ExecutionRecord])
def get_history(connection_id: UUID):
    return get_inspector(connection_id).history
