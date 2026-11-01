from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "local"
    api_prefix: str = "/api"
    cors_origins: list[str] = ["http://localhost:3000"]

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"
    redis_url: str = "redis://localhost:6379/0"

    supabase_url: str = ""
    supabase_jwt_audience: str = "authenticated"

    anthropic_api_key: str = ""
    voyage_api_key: str = ""

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
