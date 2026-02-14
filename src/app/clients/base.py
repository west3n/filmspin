import asyncio
import logging
from typing import Any

import httpx

logger = logging.getLogger("uvicorn.error")

_RETRYABLE_STATUS = {429, 500, 502, 503, 504}
_RETRYABLE_ERRORS = (
    httpx.ReadTimeout,
    httpx.ConnectTimeout,
    httpx.PoolTimeout,
    httpx.ConnectError,
    httpx.RemoteProtocolError,
)


class RetryHttpClient:
    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        retries: int = 2,
        base_delay_sec: float = 0.25,
    ) -> None:
        self.client = client
        self.retries = max(0, retries)
        self.base_delay_sec = max(0.0, base_delay_sec)

    async def get_json(
        self,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        attempt = 0
        while True:
            try:
                response = await self.client.get(url, params=params, headers=headers)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as exc:
                if (
                    exc.response.status_code in _RETRYABLE_STATUS
                    and attempt < self.retries
                ):
                    await self._sleep_backoff(attempt, url, exc)
                    attempt += 1
                    continue
                raise
            except _RETRYABLE_ERRORS as exc:
                if attempt < self.retries:
                    await self._sleep_backoff(attempt, url, exc)
                    attempt += 1
                    continue
                raise

    async def _sleep_backoff(self, attempt: int, url: str, exc: Exception) -> None:
        delay = self.base_delay_sec * (2**attempt)
        logger.warning(
            "[FilmSpin] retrying upstream request: url=%s attempt=%s delay=%.2fs error=%s",
            url,
            attempt + 1,
            delay,
            exc.__class__.__name__,
        )
        if delay > 0:
            await asyncio.sleep(delay)
