from typing import Any

import httpx

from ..core.config import KINOPOISK_API_KEY, KINO_BASE
from .base import RetryHttpClient


class PoiskkinoClient:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._http = RetryHttpClient(client)
        self._headers = {"X-API-KEY": KINOPOISK_API_KEY}

    async def get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        data = await self._http.get_json(
            f"{KINO_BASE}{path}", params=params, headers=self._headers
        )
        return data if isinstance(data, dict) else {}

    async def get_list(
        self, path: str, params: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        data = await self._http.get_json(
            f"{KINO_BASE}{path}", params=params, headers=self._headers
        )
        if not isinstance(data, list):
            return []
        return [x for x in data if isinstance(x, dict)]
