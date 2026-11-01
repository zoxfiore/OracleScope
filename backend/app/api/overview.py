from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.models.overview import Overview
from app.oracle.collectors import collect_overview
from app.oracle.connection_manager import connection_manager

router = APIRouter(
    prefix="/api/connections",
    tags=["Overview"],
)


@router.get("/{connection_id}/overview", response_model=Overview)
def get_overview(connection_id: UUID):
    if not connection_manager.is_alive(connection_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found or no longer alive.",
        )

    return collect_overview(connection_manager.get_connection(connection_id))