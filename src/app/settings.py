from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    tmdb_api_key: str = ""
    omdb_api_key: str = ""
    kinopoisk_api_key: str | None = None

    tmdb_base: str = "https://api.themoviedb.org/3"
    omdb_base: str = "http://www.omdbapi.com/"
    kino_base: str = "https://api.poiskkino.dev"
    redis_url: str = "redis://localhost:6379/0"
    cors_allow_origins: str = (
        "http://localhost:8000,http://127.0.0.1:8000,"
        "http://localhost:18000,http://127.0.0.1:18000,"
        "https://filmspin.cloud,https://www.filmspin.cloud"
    )

    http_connect_timeout: float = 5.0
    http_read_timeout: float = 15.0
    http_write_timeout: float = 15.0
    http_pool_timeout: float = 5.0
    http_max_connections: int = 100
    http_max_keepalive_connections: int = 20
    ru_enabled: bool = True

    ttl_genres: int = 60 * 60 * 24 * 30
    ttl_movie_detail: int = 60 * 60 * 24
    ttl_recent: int = 60 * 60 * 12
    recent_limit: int = 100

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def _normalize_origins(cls, value: str | list[str]) -> str:
        if isinstance(value, list):
            return ",".join(value)
        return value

    @property
    def cors_origins_list(self) -> list[str]:
        raw = (self.cors_allow_origins or "").strip()
        if raw == "*":
            return ["*"]
        return [x.strip() for x in raw.split(",") if x.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
