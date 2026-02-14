import random
import re
from typing import Optional

from ..clients import PoiskkinoClient, TmdbClient
from ..core.config import RECENT_LIMIT, TTL_RECENT
from ..repositories import CacheRepository, RecentRepository
from ..schemas import ApiError, MovieCard
from .movie_service import MovieResolverService


class RandomService:
    def __init__(
        self,
        *,
        cache: CacheRepository,
        recent: RecentRepository,
        tmdb: TmdbClient,
        poiskkino: PoiskkinoClient,
        movie_resolver: MovieResolverService,
    ) -> None:
        self.cache = cache
        self.recent = recent
        self.tmdb = tmdb
        self.poiskkino = poiskkino
        self.movie_resolver = movie_resolver

    async def random_en(
        self,
        *,
        year_from: Optional[int],
        year_to: Optional[int],
        genres: Optional[str],
        vote_avg_min: float,
        country: Optional[str],
        lang: str,
    ) -> MovieCard | ApiError:
        params: dict[str, object] = {
            "include_adult": "false",
            "include_video": "false",
            "sort_by": "popularity.desc",
            "vote_count.gte": 50,
            "vote_average.gte": vote_avg_min,
        }
        if genres:
            params["with_genres"] = genres
        if year_from:
            params["primary_release_date.gte"] = f"{year_from}-01-01"
        if year_to:
            params["primary_release_date.lte"] = f"{year_to}-12-31"
        if country:
            iso_countries = self._normalize_iso_country_filter(country)
            if iso_countries:
                params["with_origin_country"] = iso_countries

        fkey = self.cache.filters_key(lang, year_from, year_to, genres, vote_avg_min, country)
        recent_key = f"recent:tmdb:{fkey}"
        first = await self.tmdb.get("/discover/movie", {**params, "page": 1, "language": lang})
        total_pages = min(int(first.get("total_pages", 1) or 1), 500)
        if total_pages == 0 or not first.get("results"):
            return ApiError(error="No results for the current filters.")

        page = random.randint(1, max(1, total_pages))
        if page == 1:
            page_data = first
        else:
            page_data = await self.tmdb.get(
                "/discover/movie", {**params, "page": page, "language": lang}
            )
        results = page_data.get("results", [])
        if not results:
            return ApiError(error="Empty page. Try loosening the filters.")

        candidate_id, pool = await self.recent.choose_not_recent(
            recent_key, (r["id"] for r in results if isinstance(r, dict) and "id" in r)
        )
        if candidate_id is None:
            await self.recent.redis.delete(recent_key)
            candidate_id = random.choice(pool)

        movie = await self.movie_resolver.resolve(lang=lang, tmdb_id=candidate_id)
        await self.recent.add(
            recent_key, str(candidate_id), ttl=TTL_RECENT, limit=RECENT_LIMIT
        )
        return movie

    async def random_ru(
        self,
        *,
        year_from: Optional[int],
        year_to: Optional[int],
        genres: Optional[str],
        vote_avg_min: float,
        country: Optional[str],
    ) -> MovieCard | ApiError:
        params: dict[str, object] = {"type": "movie"}
        if year_from and year_to:
            params["year"] = f"{year_from}-{year_to}"
        elif year_from:
            params["year"] = str(year_from)
        elif year_to:
            params["year"] = str(year_to)
        if vote_avg_min and float(vote_avg_min) > 0:
            params["rating.kp"] = f"{float(vote_avg_min)}-10"
        if genres:
            params["genres.name"] = genres.replace(",", "|").split("|")
        if country:
            params["countries.name"] = country.split("|")

        fkey = self.cache.filters_key(year_from, year_to, genres, vote_avg_min, country)
        recent_key = f"recent:kp:{fkey}"
        recent_ids = await self.recent.members(recent_key)

        attempts = 6
        last_cand: dict[str, object] | None = None
        kp_id: Optional[int] = None
        while attempts > 0:
            cand = await self.poiskkino.get("/v1.4/movie/random", params=params)
            last_cand = cand
            cid = cand.get("id")
            if cid is None:
                attempts -= 1
                continue
            if str(cid) in recent_ids:
                attempts -= 1
                continue
            kp_id = int(cid)
            break

        if kp_id is None and isinstance(last_cand, dict):
            cid = last_cand.get("id")
            kp_id = int(cid) if cid is not None else None

        movie = await self.movie_resolver.resolve(lang="ru-RU", kp_id=kp_id)
        if kp_id:
            await self.recent.add(recent_key, str(kp_id), ttl=TTL_RECENT, limit=RECENT_LIMIT)
        return movie

    @staticmethod
    def _normalize_iso_country_filter(raw: str) -> str:
        parts = [p.strip().upper() for p in re.split(r"[|,]", raw or "") if p.strip()]
        iso = [p for p in parts if len(p) == 2 and p.isalpha()]
        # Preserve order while removing duplicates.
        unique = list(dict.fromkeys(iso))
        return ",".join(unique)
