from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "local"
    api_prefix: str = "/api"
    cors_origins: list[str] = ["http://localhost:3000"]

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"
    redis_url: str = "redis://localhost:6379/0"

    # Seals short-lived tokens the server hands out (e.g. adaptive exam answers). Set it in
    # staging and production so tokens survive restarts; empty means a random key per process.
    signing_secret: str = ""

    supabase_url: str = ""
    supabase_jwt_audience: str = "authenticated"

    # Reminders (IP-110). The scheduler runs inside the API process and is safe to run in several
    # processes at once (rows are locked with SKIP LOCKED). Telegram and email go through an n8n
    # workflow at N8N_WEBHOOK_URL; requests are signed with N8N_WEBHOOK_SECRET.
    scheduler_enabled: bool = True
    scheduler_interval_seconds: int = 60
    n8n_webhook_url: str = ""
    n8n_webhook_secret: str = ""
    telegram_bot_username: str = ""

    # AI provider for generation and embeddings: "openai" or "anthropic"
    llm_provider: str = "openai"
    openai_api_key: str = ""
    openai_model: str = "gpt-5-mini"
    anthropic_api_key: str = ""
    voyage_api_key: str = ""

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def local_dev_auth(self) -> bool:
        """Local development without a Supabase project: requests run as a fixed dev user."""
        return self.environment == "local" and not self.supabase_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
