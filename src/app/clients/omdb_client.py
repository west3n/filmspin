from typing import Optional

import httpx

from ..core.config import OMDB_API_KEY, OMDB_BASE


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
        except Exception:
            return None
