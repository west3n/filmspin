from typing import Any

import httpx

from ..core.config import TMDB_API_KEY, TMDB_BASE
from .base import RetryHttpClient


class TmdbClient:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._http = RetryHttpClient(client)

    async def get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = {"api_key": TMDB_API_KEY, **(params or {})}
        data = await self._http.get_json(f"{TMDB_BASE}{path}", params=payload)
        return data if isinstance(data, dict) else {}
