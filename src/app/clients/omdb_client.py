from typing import Optional
import logging

import httpx

from ..core.config import OMDB_API_KEYS, OMDB_BASE, OMDB_MOCK_ENABLED

logger = logging.getLogger("uvicorn.error")


class OmdbClient:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client
        self._active_key_index = 0

    @staticmethod
    def _should_rotate_by_payload_error(error: str) -> bool:
        normalized = error.lower()
        return (
            "request limit reached" in normalized
            or "invalid api key" in normalized
            or "api key" in normalized and "required" in normalized
        )

    @staticmethod
    def _should_rotate_by_status(status_code: Optional[int]) -> bool:
        return status_code in (401, 403, 429)

    def _ordered_keys(self) -> list[tuple[int, str]]:
        keys = list(OMDB_API_KEYS)
        if not keys:
            return []
        start = self._active_key_index % len(keys)
        ordered: list[tuple[int, str]] = []
        for offset in range(len(keys)):
            index = (start + offset) % len(keys)
            ordered.append((index, keys[index]))
        return ordered

    @staticmethod
    def _mock_rating(imdb_id: str) -> dict[str, float | int]:
        digits = [int(ch) for ch in imdb_id if ch.isdigit()]
        checksum = sum((index + 1) * digit for index, digit in enumerate(digits))
        rating = round(6.0 + (checksum % 31) / 10.0, 1)
        votes = 5_000 + (checksum * 7_919) % 450_000
        return {"imdb_rating": rating, "imdb_votes": votes}

    async def rating(self, imdb_id: str) -> Optional[dict[str, float | int]]:
        if not imdb_id:
            return None
        if OMDB_MOCK_ENABLED:
            return self._mock_rating(imdb_id)

        key_candidates = self._ordered_keys()
        if not key_candidates:
            return None
        has_rotated = False

        for key_index, key in key_candidates:
            try:
                response = await self._client.get(
                    OMDB_BASE, params={"apikey": key, "i": imdb_id, "type": "movie"}
                )
                if self._should_rotate_by_status(response.status_code):
                    has_rotated = True
                    logger.info(
                        "[FilmSpin] omdb rotate key: imdb_id=%s key_index=%s status=%s",
                        imdb_id,
                        key_index + 1,
                        response.status_code,
                    )
                    self._active_key_index = (key_index + 1) % len(key_candidates)
                    continue

                response.raise_for_status()
                payload = response.json()
                if payload.get("Response") != "True":
                    reason = str(payload.get("Error") or "")
                    if self._should_rotate_by_payload_error(reason):
                        has_rotated = True
                        logger.info(
                            "[FilmSpin] omdb rotate key: imdb_id=%s key_index=%s reason=%s",
                            imdb_id,
                            key_index + 1,
                            reason,
                        )
                        self._active_key_index = (key_index + 1) % len(key_candidates)
                        continue

                    logger.info(
                        "[FilmSpin] omdb miss: imdb_id=%s reason=%s",
                        imdb_id,
                        reason,
                    )
                    self._active_key_index = key_index
                    return None

                rating_raw = payload.get("imdbRating")
                votes_raw = payload.get("imdbVotes")
                rating = float(rating_raw) if rating_raw and rating_raw != "N/A" else None
                votes = (
                    int(str(votes_raw).replace(",", ""))
                    if votes_raw and votes_raw != "N/A"
                    else None
                )
                if rating is None and votes is None:
                    self._active_key_index = key_index
                    return None
                self._active_key_index = key_index
                return {"imdb_rating": rating, "imdb_votes": votes}
            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code if exc.response else None
                if self._should_rotate_by_status(status_code):
                    has_rotated = True
                    logger.info(
                        "[FilmSpin] omdb rotate key: imdb_id=%s key_index=%s status=%s",
                        imdb_id,
                        key_index + 1,
                        status_code,
                    )
                    self._active_key_index = (key_index + 1) % len(key_candidates)
                    continue
                logger.warning(
                    "[FilmSpin] omdb http status error: imdb_id=%s status=%s",
                    imdb_id,
                    status_code,
                )
                return None
            except httpx.RequestError as exc:
                logger.warning(
                    "[FilmSpin] omdb request error: imdb_id=%s error=%s",
                    imdb_id,
                    exc.__class__.__name__,
                )
                return None
            except Exception as exc:
                logger.warning(
                    "[FilmSpin] omdb parse error: imdb_id=%s error=%s",
                    imdb_id,
                    exc.__class__.__name__,
                )
                return None

        if has_rotated:
            logger.warning(
                "[FilmSpin] omdb exhausted keys: imdb_id=%s keys=%s",
                imdb_id,
                len(key_candidates),
            )
        return None
