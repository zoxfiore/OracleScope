from uuid import UUID
import oracledb
from fastapi import APIRouter, HTTPException, status

from app.models.connection import OracleConnectionRequest
from app.oracle.connection_manager import connection_manager

router = APIRouter(
    prefix="/api/connections",
    tags=["Connections"],
)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_connection(request: OracleConnectionRequest):
    try:
        connection_id = await connection_manager.create_connection(request)

        return {
            "connection_id": str(connection_id),
            "status": "connected",
            "message": "Successfully connected to Oracle Database.",
        }

    except oracledb.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.get("/{connection_id}")
def get_connection(connection_id: UUID):
    if not connection_manager.is_alive(connection_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found or no longer alive.",
        )

    return {
        "connection_id": str(connection_id),
        "status": "connected",
    }


@router.delete("/{connection_id}")
async def close_connection(connection_id: UUID):
    closed = await connection_manager.close_connection(connection_id)

    if not closed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found.",
        )

    return {
        "connection_id": str(connection_id),
        "status": "disconnected",
        "message": "Oracle connection closed successfully.",
    }