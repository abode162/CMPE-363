from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/urlshortener"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Services
    analytics_service_url: str = "http://localhost:3001"
    base_url: str = "http://localhost:8000"

    # URL Settings
    short_code_length: int = 6

    # Security
    jwt_secret: str = "your-super-secret-jwt-key-change-in-production"
    internal_api_key: str = "internal-service-key-change-in-production"

    # CORS
    cors_origins: str = "http://localhost,http://localhost:3003,http://localhost:5173"

    # Debug
    debug: bool = False

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
