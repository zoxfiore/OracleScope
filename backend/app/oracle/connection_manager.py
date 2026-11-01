import uuid

import oracledb

from app.models.connection import OracleConnectionRequest
from app.oracle.inspector import InspectorSession


class ConnectionManager:

    def __init__(self):
        self.connections: dict[uuid.UUID, oracledb.Connection] = {}
        self.inspectors: dict[uuid.UUID, InspectorSession] = {}

    async def create_connection(
        self,
        config: OracleConnectionRequest,
    ) -> uuid.UUID:

        def connect() -> oracledb.Connection:
            return oracledb.connect(
                user=config.username,
                password=config.password.get_secret_value(),
                dsn=f"{config.host}:{config.port}/{config.service_name}",
            )

        connection = connect()

        try:
            inspector = InspectorSession(connect())
        except oracledb.Error:
            connection.close()
            raise

        connection_id = uuid.uuid4()

        self.connections[connection_id] = connection
        self.inspectors[connection_id] = inspector

        return connection_id

    def get_connection(self, connection_id: uuid.UUID):
        return self.connections.get(connection_id)

    def get_inspector(self, connection_id: uuid.UUID) -> InspectorSession | None:
        return self.inspectors.get(connection_id)

    def is_alive(self, connection_id: uuid.UUID) -> bool:
        connection = self.connections.get(connection_id)

        if connection is None:
            return False

        try:
            connection.ping()
            return True
        except oracledb.Error:
            self.connections.pop(connection_id, None)
            self._close_inspector(connection_id)
            return False

    async def close_connection(self, connection_id: uuid.UUID) -> bool:

        connection = self.connections.pop(connection_id, None)

        if connection is None:
            return False

        self._close_inspector(connection_id)
        connection.close()

        return True

    def _close_inspector(self, connection_id: uuid.UUID) -> None:
        inspector = self.inspectors.pop(connection_id, None)

        if inspector is not None:
            inspector.close()


connection_manager = ConnectionManager()