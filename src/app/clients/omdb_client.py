from typing import Optional
import logging

import httpx

from ..core.config import OMDB_API_KEY, OMDB_BASE

logger = logging.getLogger("uvicorn.error")


class OmdbClient:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def rating(self, imdb_id: str) -> Optional[dict[str, float | int]]:
        if not OMDB_API_KEY or not imdb_id:
            return None
        try:
            response = await self._client.get(
                OMDB_BASE, params={"apikey": OMDB_API_KEY, "i": imdb_id, "type": "movie"}
            )
            response.raise_for_status()
            payload = response.json()
            if payload.get("Response") != "True":
                logger.info(
                    "[FilmSpin] omdb miss: imdb_id=%s reason=%s",
                    imdb_id,
                    payload.get("Error"),
                )
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
                return None
            return {"imdb_rating": rating, "imdb_votes": votes}
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "[FilmSpin] omdb http status error: imdb_id=%s status=%s",
                imdb_id,
                exc.response.status_code if exc.response else None,
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
