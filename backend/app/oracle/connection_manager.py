import uuid

import oracledb

from app.models.connection import OracleConnectionRequest


class ConnectionManager:

    def __init__(self):
        self.connections: dict[uuid.UUID, oracledb.Connection] = {}

    async def create_connection(
        self,
        config: OracleConnectionRequest,
    ) -> uuid.UUID:

        connection = oracledb.connect(
            user=config.username,
            password=config.password.get_secret_value(),
            dsn=f"{config.host}:{config.port}/{config.service_name}",
        )

        connection_id = uuid.uuid4()

        self.connections[connection_id] = connection

        return connection_id

    def get_connection(self, connection_id: uuid.UUID):
        return self.connections.get(connection_id)

    def is_alive(self, connection_id: uuid.UUID) -> bool:
        connection = self.connections.get(connection_id)

        if connection is None:
            return False

        try:
            connection.ping()
            return True
        except oracledb.Error:
            self.connections.pop(connection_id, None)
            return False
            
    async def close_connection(self, connection_id: uuid.UUID) -> bool:

        connection = self.connections.pop(connection_id, None)

        if connection is None:
            return False

        connection.close()

        return True


connection_manager = ConnectionManager()