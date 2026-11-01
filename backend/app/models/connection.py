from pydantic import BaseModel, Field, SecretStr


class OracleConnectionRequest(BaseModel):
    host: str = Field(min_length=1)
    port: int = Field(default=1521, ge=1, le=65535)
    service_name: str = Field(min_length=1)
    username: str = Field(min_length=1)
    password: SecretStr