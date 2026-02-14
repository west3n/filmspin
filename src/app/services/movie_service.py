from typing import Any, Optional

from ..clients import OmdbClient, PoiskkinoClient, TmdbClient
from ..core.config import TTL_MOVIE_DETAIL
from ..repositories import CacheRepository, MappingRepository
from ..schemas import MovieCard


class MovieResolverService:
    def __init__(
        self,
        *,
        cache: CacheRepository,
        mappings: MappingRepository,
        tmdb: TmdbClient,
        poiskkino: PoiskkinoClient,
        omdb: OmdbClient,
    ) -> None:
        self.cache = cache
        self.mappings = mappings
        self.tmdb = tmdb
        self.poiskkino = poiskkino
        self.omdb = omdb

    async def resolve(
        self,
        *,
        lang: str,
        tmdb_id: Optional[int] = None,
        kp_id: Optional[int] = None,
        imdb_id: Optional[str] = None,
    ) -> MovieCard:
        if not tmdb_id and kp_id:
            mapping = await self.mappings.get_by_kp(kp_id)
            tmdb_id = mapping.get("tmdb_id")
            imdb_id = imdb_id or mapping.get("imdb_id")
            if not tmdb_id:
                kp_raw = await self._get_kp_details(kp_id)
                tmdb_id = (kp_raw.get("externalId") or {}).get("tmdb")
                imdb_id = imdb_id or (kp_raw.get("externalId") or {}).get("imdb")
                await self.mappings.set_map(tmdb_id, kp_id, imdb_id)

        if tmdb_id:
            norm_key = f"norm:movie:{tmdb_id}:{lang}"
            hit, cached = await self.cache.get_json_hit(norm_key)
            if hit and isinstance(cached, dict):
                return MovieCard.model_validate(cached)

        if lang.startswith("ru"):
            return await self._resolve_ru(tmdb_id=tmdb_id, kp_id=kp_id, imdb_id=imdb_id)
        return await self._resolve_default(
            lang=lang, tmdb_id=tmdb_id, kp_id=kp_id, imdb_id=imdb_id
        )

    async def _resolve_ru(
        self,
        *,
        tmdb_id: Optional[int],
        kp_id: Optional[int],
        imdb_id: Optional[str],
    ) -> MovieCard:
        if not kp_id:
            if tmdb_id:
                mapping = await self.mappings.get_by_tmdb(tmdb_id)
                kp_id = mapping.get("kp_id")
                imdb_id = imdb_id or mapping.get("imdb_id")
            if not kp_id:
                kp_id = await self._kp_lookup_by_external(tmdb_id=tmdb_id, imdb_id=imdb_id)

        if kp_id:
            kp_raw = await self._get_kp_details(kp_id)
            tmdb_id = tmdb_id or (kp_raw.get("externalId") or {}).get("tmdb")
            imdb_id = imdb_id or (kp_raw.get("externalId") or {}).get("imdb")
            await self.mappings.set_map(tmdb_id, kp_id, imdb_id)
            card = self._normalize_kp(kp_raw)
        else:
            if not tmdb_id:
                raise ValueError("Cannot resolve movie: missing both tmdb_id and kp_id for ru")
            tmdb_raw = await self._get_tmdb_details(tmdb_id, "ru-RU")
            imdb_id = imdb_id or (tmdb_raw.get("external_ids") or {}).get("imdb_id")
            await self.mappings.set_map(tmdb_id, None, imdb_id)
            imdb_extra = await self._get_omdb_rating(imdb_id)
            card = self._normalize_tmdb(tmdb_raw, imdb_extra)

        if tmdb_id:
            await self.cache.set_json(
                f"norm:movie:{tmdb_id}:ru-RU", card.model_dump(), TTL_MOVIE_DETAIL
            )
        return card

    async def _resolve_default(
        self,
        *,
        lang: str,
        tmdb_id: Optional[int],
        kp_id: Optional[int],
        imdb_id: Optional[str],
    ) -> MovieCard:
        if not tmdb_id and kp_id:
            mapping = await self.mappings.get_by_kp(kp_id)
            tmdb_id = mapping.get("tmdb_id")
            imdb_id = imdb_id or mapping.get("imdb_id")
            if not tmdb_id:
                kp_raw = await self._get_kp_details(kp_id)
                tmdb_id = (kp_raw.get("externalId") or {}).get("tmdb")
                imdb_id = imdb_id or (kp_raw.get("externalId") or {}).get("imdb")
                await self.mappings.set_map(tmdb_id, kp_id, imdb_id)

        if not tmdb_id:
            if not kp_id:
                raise ValueError("Cannot resolve movie: missing tmdb_id/kp_id")
            kp_raw = await self._get_kp_details(kp_id)
            tmdb_id = (kp_raw.get("externalId") or {}).get("tmdb")
            imdb_id = imdb_id or (kp_raw.get("externalId") or {}).get("imdb")
            await self.mappings.set_map(tmdb_id, kp_id, imdb_id)

        tmdb_raw = await self._get_tmdb_details(tmdb_id, lang)
        imdb_id = imdb_id or (tmdb_raw.get("external_ids") or {}).get("imdb_id")
        await self.mappings.set_map(tmdb_id, kp_id, imdb_id)
        imdb_extra = await self._get_omdb_rating(imdb_id)
        card = self._normalize_tmdb(tmdb_raw, imdb_extra)
        await self.cache.set_json(
            f"norm:movie:{tmdb_id}:{lang}", card.model_dump(), TTL_MOVIE_DETAIL
        )
        return card

    async def _get_tmdb_details(self, tmdb_id: int, lang: str) -> dict[str, Any]:
        key = f"raw:tmdb:{tmdb_id}:{lang}"
        hit, cached = await self.cache.get_json_hit(key)
        if hit and isinstance(cached, dict):
            return cached
        details = await self.tmdb.get(
            f"/movie/{tmdb_id}",
            {"append_to_response": "external_ids", "language": lang},
        )
        await self.cache.set_json(key, details, TTL_MOVIE_DETAIL)
        return details

    async def _get_kp_details(self, kp_id: int) -> dict[str, Any]:
        key = f"raw:kp:{kp_id}"
        hit, cached = await self.cache.get_json_hit(key)
        if hit and isinstance(cached, dict):
            return cached
        payload = await self.poiskkino.get(f"/v1.4/movie/{kp_id}")
        await self.cache.set_json(key, payload, TTL_MOVIE_DETAIL)
        return payload

    async def _kp_lookup_by_external(
        self, *, tmdb_id: Optional[int], imdb_id: Optional[str]
    ) -> Optional[int]:
        if not tmdb_id and not imdb_id:
            return None
        params: dict[str, Any] = {"limit": 1}
        if tmdb_id:
            params["externalId.tmdb"] = tmdb_id
        if imdb_id:
            params["externalId.imdb"] = imdb_id
        payload = await self.poiskkino.get("/v1.4/movie", params=params)
        docs = payload.get("docs") or []
        if not docs or not isinstance(docs[0], dict):
            return None
        doc_id = docs[0].get("id")
        try:
            return int(doc_id) if doc_id is not None else None
        except (TypeError, ValueError):
            return None

    async def _get_omdb_rating(self, imdb_id: Optional[str]) -> Optional[dict[str, Any]]:
        if not imdb_id:
            return None
        key = f"omdb:{imdb_id}"
        hit, cached = await self.cache.get_json_hit(key)
        if hit:
            return cached if isinstance(cached, dict) else None
        data = await self.omdb.rating(imdb_id)
        await self.cache.set_json(key, data, TTL_MOVIE_DETAIL)
        return data

    @staticmethod
    def _normalize_tmdb(details: dict[str, Any], imdb_extra: Optional[dict[str, Any]]) -> MovieCard:
        imdb_id = (details.get("external_ids") or {}).get("imdb_id")
        prod = details.get("production_countries") or []
        countries = (
            [(c.get("name") or c.get("iso_3166_1")) for c in prod]
            or details.get("origin_country")
            or []
        )
        poster = (
            f"https://image.tmdb.org/t/p/w500{details.get('poster_path')}"
            if details.get("poster_path")
            else None
        )
        backdrop = (
            f"https://image.tmdb.org/t/p/w780{details.get('backdrop_path')}"
            if details.get("backdrop_path")
            else None
        )
        return MovieCard(
            title=details.get("title") or "",
            year=(details.get("release_date") or "")[:4] or None,
            overview=details.get("overview") or "",
            genres=[
                g.get("name")
                for g in details.get("genres", [])
                if isinstance(g, dict) and g.get("name")
            ],
            countries=[str(c) for c in countries if c],
            poster=poster,
            backdrop=backdrop,
            tmdb_id=details.get("id"),
            tmdb_vote=details.get("vote_average"),
            imdb_id=imdb_id,
            imdb_url=f"https://www.imdb.com/title/{imdb_id}/" if imdb_id else None,
            imdb_rating=(imdb_extra or {}).get("imdb_rating"),
            imdb_votes=(imdb_extra or {}).get("imdb_votes"),
            kp_id=None,
            kp_rating=None,
            kp_votes=None,
            kp_url=None,
            tmdb_url=f"https://www.themoviedb.org/movie/{details.get('id')}",
        )

    @staticmethod
    def _normalize_kp(movie: dict[str, Any]) -> MovieCard:
        external = movie.get("externalId") if isinstance(movie.get("externalId"), dict) else {}
        rating = movie.get("rating") if isinstance(movie.get("rating"), dict) else {}
        votes = movie.get("votes") if isinstance(movie.get("votes"), dict) else {}
        imdb_id = external.get("imdb")
        kp_id = movie.get("id")
        return MovieCard(
            title=movie.get("name") or movie.get("alternativeName") or movie.get("enName") or "",
            year=movie.get("year"),
            overview=movie.get("description") or movie.get("shortDescription") or "",
            genres=[
                g.get("name")
                for g in (movie.get("genres") or [])
                if isinstance(g, dict) and g.get("name")
            ],
            countries=[
                c.get("name")
                for c in (movie.get("countries") or [])
                if isinstance(c, dict) and c.get("name")
            ],
            poster=((movie.get("poster") or {}).get("url") if isinstance(movie.get("poster"), dict) else None),
            backdrop=((movie.get("backdrop") or {}).get("url") if isinstance(movie.get("backdrop"), dict) else None),
            tmdb_id=external.get("tmdb"),
            tmdb_vote=None,
            imdb_id=imdb_id,
            imdb_url=f"https://www.imdb.com/title/{imdb_id}/" if imdb_id else None,
            imdb_rating=rating.get("imdb"),
            imdb_votes=votes.get("imdb"),
            kp_id=kp_id,
            kp_rating=rating.get("kp"),
            kp_votes=votes.get("kp"),
            kp_url=f"https://www.kinopoisk.ru/film/{kp_id}/" if kp_id else None,
            tmdb_url=None,
        )
