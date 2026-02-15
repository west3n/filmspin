import asyncio
import logging
import random
import re
from typing import Optional

from ..clients import PoiskkinoClient, TmdbClient
from ..core.config import RECENT_LIMIT, TTL_RECENT
from ..repositories import CacheRepository, RecentRepository
from ..schemas import ApiError, FiltersPreviewOut, MovieCard
from .movie_service import MovieResolverService

logger = logging.getLogger("uvicorn.error")
TTL_PREVIEW_ESTIMATE = min(TTL_RECENT, 60 * 15)


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
        runtime_min: Optional[int],
        runtime_max: Optional[int],
        genres: Optional[str],
        vote_avg_min: float,
        country: Optional[str],
        exclude_tmdb: Optional[str],
        exclude_kp: Optional[str],
        lang: str,
    ) -> MovieCard | ApiError:
        strategy = self._discover_strategy(vote_avg_min)
        params: dict[str, object] = {
            "include_adult": "false",
            "include_video": "false",
            "sort_by": strategy["sort_by"],
            "vote_count.gte": strategy["vote_count_gte"],
        }
        if genres:
            params["with_genres"] = genres
        if year_from:
            params["primary_release_date.gte"] = f"{year_from}-01-01"
        if year_to:
            params["primary_release_date.lte"] = f"{year_to}-12-31"
        if runtime_min:
            params["with_runtime.gte"] = runtime_min
        if runtime_max:
            params["with_runtime.lte"] = runtime_max
        if country:
            iso_countries = self._normalize_iso_country_filter(country)
            if iso_countries:
                params["with_origin_country"] = iso_countries

        excluded_tmdb_ids = self._parse_int_set(exclude_tmdb)
        excluded_kp_ids = self._parse_int_set(exclude_kp)

        fkey = self.cache.filters_key(
            lang, year_from, year_to, runtime_min, runtime_max, genres, vote_avg_min, country
        )
        recent_key = f"recent:tmdb:{fkey}"
        first = await self.tmdb.get("/discover/movie", {**params, "page": 1, "language": lang})
        total_pages = min(int(first.get("total_pages", 1) or 1), 500)
        if total_pages == 0 or not first.get("results"):
            return ApiError(error="No results for the current filters.")

        page_plan = self._build_page_plan(total_pages, strategy["probe_pages"])
        candidate_pool: list[dict[str, object]] = []
        seen_ids: set[int] = set()

        for page in page_plan:
            page_data = first if page == 1 else await self.tmdb.get(
                "/discover/movie", {**params, "page": page, "language": lang}
            )
            results = page_data.get("results", [])
            if not isinstance(results, list):
                continue
            for item in results:
                if not isinstance(item, dict):
                    continue
                mid = item.get("id")
                if mid is None:
                    continue
                try:
                    tmdb_id = int(mid)
                except (TypeError, ValueError):
                    continue
                if tmdb_id in seen_ids or tmdb_id in excluded_tmdb_ids:
                    continue
                seen_ids.add(tmdb_id)
                candidate_pool.append(item)

        if not candidate_pool:
            return ApiError(error="No results for the current filters.")

        id_to_item: dict[int, dict[str, object]] = {}
        for item in candidate_pool:
            movie_id = self._safe_int(item.get("id"))
            if movie_id is None:
                continue
            id_to_item[movie_id] = item

        candidate_ids = await self._order_by_recentness(
            recent_key, list(id_to_item.keys()), prefer_shuffle=False
        )
        candidate_ids = self._weighted_order_candidates(
            candidate_ids,
            id_to_item=id_to_item,
            min_rating=vote_avg_min,
            year_from=year_from,
            year_to=year_to,
            runtime_min=runtime_min,
            runtime_max=runtime_max,
            prefer_shuffle=strategy["shuffle_candidates"],
        )
        candidate_ids = candidate_ids[: strategy["max_resolve_candidates"]]
        watch_region = self._watch_region_for_request(lang=lang, country=country)

        checked = 0
        with_imdb = 0
        for tmdb_id in candidate_ids:
            checked += 1
            movie = await self.movie_resolver.resolve(
                lang=lang,
                tmdb_id=tmdb_id,
                watch_region=watch_region,
            )
            if movie.imdb_rating is not None:
                with_imdb += 1
            if not self._passes_imdb_filter(movie.imdb_rating, vote_avg_min):
                continue
            kp_movie_id = self._safe_int(movie.kp_id)
            if kp_movie_id is not None and kp_movie_id in excluded_kp_ids:
                continue
            movie.recommendation_reason = self._build_recommendation_reason(
                lang=lang,
                movie=movie,
                year_from=year_from,
                year_to=year_to,
                runtime_min=runtime_min,
                runtime_max=runtime_max,
                genres=genres,
                vote_avg_min=vote_avg_min,
                country=country,
            )
            await self.recent.add(
                recent_key, str(tmdb_id), ttl=TTL_RECENT, limit=RECENT_LIMIT
            )
            return movie

        logger.info(
            "[FilmSpin] imdb filter miss: min=%.1f checked=%s with_imdb=%s total_candidates=%s",
            vote_avg_min,
            checked,
            with_imdb,
            len(candidate_pool),
        )
        return ApiError(
            error="No movies found for the selected IMDb rating filter. Try lowering the minimum rating."
        )

    async def random_ru(
        self,
        *,
        year_from: Optional[int],
        year_to: Optional[int],
        runtime_min: Optional[int],
        runtime_max: Optional[int],
        genres: Optional[str],
        vote_avg_min: float,
        country: Optional[str],
        exclude_tmdb: Optional[str],
        exclude_kp: Optional[str],
    ) -> MovieCard | ApiError:
        params: dict[str, object] = {"type": "movie"}
        if year_from and year_to:
            params["year"] = f"{year_from}-{year_to}"
        elif year_from:
            params["year"] = str(year_from)
        elif year_to:
            params["year"] = str(year_to)
        if genres:
            params["genres.name"] = genres.replace(",", "|").split("|")
        if country:
            params["countries.name"] = country.split("|")
        self._apply_ru_runtime_filter(params, runtime_min=runtime_min, runtime_max=runtime_max)

        excluded_tmdb_ids = self._parse_int_set(exclude_tmdb)
        excluded_kp_ids = self._parse_int_set(exclude_kp)

        fkey = self.cache.filters_key(
            year_from, year_to, runtime_min, runtime_max, genres, vote_avg_min, country
        )
        recent_key = f"recent:kp:{fkey}"
        recent_ids = await self.recent.members(recent_key)
        watch_region = self._watch_region_for_request(lang="ru-RU", country=country)

        attempts = self._ru_attempt_budget(vote_avg_min)
        checked = 0
        with_imdb = 0
        seen_this_round: set[str] = set()
        while attempts > 0:
            cand = await self.poiskkino.get("/v1.4/movie/random", params=params)
            cid = cand.get("id")
            if cid is None:
                attempts -= 1
                continue
            sid = str(cid)
            if sid in recent_ids or sid in seen_this_round or self._safe_int(cid) in excluded_kp_ids:
                attempts -= 1
                continue
            seen_this_round.add(sid)
            kp_id = int(cid)
            checked += 1
            movie = await self.movie_resolver.resolve(
                lang="ru-RU",
                kp_id=kp_id,
                watch_region=watch_region,
            )
            if movie.imdb_rating is not None:
                with_imdb += 1
            if not self._passes_imdb_filter(movie.imdb_rating, vote_avg_min):
                recent_ids.add(str(kp_id))
                attempts -= 1
                continue
            tmdb_movie_id = self._safe_int(movie.tmdb_id)
            if tmdb_movie_id is not None and tmdb_movie_id in excluded_tmdb_ids:
                attempts -= 1
                continue
            movie.recommendation_reason = self._build_recommendation_reason(
                lang="ru-RU",
                movie=movie,
                year_from=year_from,
                year_to=year_to,
                runtime_min=runtime_min,
                runtime_max=runtime_max,
                genres=genres,
                vote_avg_min=vote_avg_min,
                country=country,
            )
            await self.recent.add(
                recent_key, str(kp_id), ttl=TTL_RECENT, limit=RECENT_LIMIT
            )
            return movie

        logger.info(
            "[FilmSpin] ru imdb filter miss: min=%.1f checked=%s with_imdb=%s attempt_budget=%s",
            vote_avg_min,
            checked,
            with_imdb,
            self._ru_attempt_budget(vote_avg_min),
        )
        return ApiError(
            error="No movies found for the selected IMDb rating filter. Try lowering the minimum rating."
        )

    async def preview_en(
        self,
        *,
        year_from: Optional[int],
        year_to: Optional[int],
        runtime_min: Optional[int],
        runtime_max: Optional[int],
        genres: Optional[str],
        vote_avg_min: float,
        country: Optional[str],
        exclude_tmdb: Optional[str],
        exclude_kp: Optional[str],
        lang: str,
    ) -> FiltersPreviewOut:
        excluded_tmdb_ids = self._parse_int_set(exclude_tmdb)
        excluded_kp_ids = self._parse_int_set(exclude_kp)

        cache_key = (
            "preview:en:"
            f"{self.cache.filters_key(lang, year_from, year_to, runtime_min, runtime_max, genres, vote_avg_min, country, exclude_tmdb, exclude_kp)}"
        )
        hit, cached = await self.cache.get_json_hit(cache_key)
        if hit and isinstance(cached, dict):
            try:
                return FiltersPreviewOut.model_validate(cached)
            except Exception:
                pass

        strategy = self._discover_strategy(vote_avg_min)
        params: dict[str, object] = {
            "include_adult": "false",
            "include_video": "false",
            "sort_by": strategy["sort_by"],
            "vote_count.gte": strategy["vote_count_gte"],
        }
        if genres:
            params["with_genres"] = genres
        if year_from:
            params["primary_release_date.gte"] = f"{year_from}-01-01"
        if year_to:
            params["primary_release_date.lte"] = f"{year_to}-12-31"
        if runtime_min:
            params["with_runtime.gte"] = runtime_min
        if runtime_max:
            params["with_runtime.lte"] = runtime_max
        if country:
            iso_countries = self._normalize_iso_country_filter(country)
            if iso_countries:
                params["with_origin_country"] = iso_countries

        first = await self.tmdb.get("/discover/movie", {**params, "page": 1, "language": lang})
        total = max(0, self._safe_int(first.get("total_results")) or 0)
        total_pages = min(int(first.get("total_pages", 1) or 1), 500)

        if total_pages == 0 or total == 0:
            result = FiltersPreviewOut(estimated_total=0, low_results=True, unavailable=False)
            await self.cache.set_json(cache_key, result.model_dump(), TTL_PREVIEW_ESTIMATE)
            return result

        if vote_avg_min <= 1.05:
            adjusted = max(0, total - len(excluded_tmdb_ids))
            result = FiltersPreviewOut(
                estimated_total=adjusted,
                low_results=adjusted < 25,
                unavailable=False,
            )
            await self.cache.set_json(cache_key, result.model_dump(), TTL_PREVIEW_ESTIMATE)
            return result

        sample_target = self._preview_sample_target(vote_avg_min, total)
        probe_pages = self._preview_probe_pages(vote_avg_min, total_pages, sample_target)
        candidate_ids = await self._collect_preview_candidates(
            params=params,
            lang=lang,
            first_page=first,
            total_pages=total_pages,
            probe_pages=probe_pages,
            sample_target=sample_target,
        )
        if not candidate_ids:
            result = FiltersPreviewOut(unavailable=True)
            await self.cache.set_json(cache_key, result.model_dump(), TTL_PREVIEW_ESTIMATE)
            return result

        if excluded_tmdb_ids:
            candidate_ids = [x for x in candidate_ids if x not in excluded_tmdb_ids]
            if not candidate_ids:
                result = FiltersPreviewOut(estimated_total=0, low_results=True, unavailable=False)
                await self.cache.set_json(cache_key, result.model_dump(), TTL_PREVIEW_ESTIMATE)
                return result

        pass_stats = await self._count_imdb_preview_hits(
            lang=lang,
            tmdb_ids=candidate_ids,
            min_rating=vote_avg_min,
            excluded_kp_ids=excluded_kp_ids,
        )
        if pass_stats is None:
            result = FiltersPreviewOut(unavailable=True)
            await self.cache.set_json(cache_key, result.model_dump(), TTL_PREVIEW_ESTIMATE)
            return result

        passed, checked = pass_stats
        estimated = int(round(total * (passed / checked))) if checked > 0 else 0
        if passed > 0 and estimated == 0:
            estimated = 1

        result = FiltersPreviewOut(
            estimated_total=max(0, estimated),
            low_results=estimated < 25,
            unavailable=False,
        )
        await self.cache.set_json(cache_key, result.model_dump(), TTL_PREVIEW_ESTIMATE)
        return result

    async def preview_ru(
        self,
        *,
        year_from: Optional[int],
        year_to: Optional[int],
        runtime_min: Optional[int],
        runtime_max: Optional[int],
        genres: Optional[str],
        vote_avg_min: float,
        country: Optional[str],
        exclude_tmdb: Optional[str],
        exclude_kp: Optional[str],
    ) -> FiltersPreviewOut:
        excluded_kp_ids = self._parse_int_set(exclude_kp)
        cache_key = (
            "preview:ru:"
            f"{self.cache.filters_key(year_from, year_to, runtime_min, runtime_max, genres, vote_avg_min, country, exclude_tmdb, exclude_kp)}"
        )
        hit, cached = await self.cache.get_json_hit(cache_key)
        if hit and isinstance(cached, dict):
            try:
                return FiltersPreviewOut.model_validate(cached)
            except Exception:
                pass

        params: dict[str, object] = {"type": "movie", "page": 1, "limit": 1}
        if year_from and year_to:
            params["year"] = f"{year_from}-{year_to}"
        elif year_from:
            params["year"] = str(year_from)
        elif year_to:
            params["year"] = str(year_to)
        if genres:
            params["genres.name"] = genres.replace(",", "|").split("|")
        if country:
            params["countries.name"] = country.split("|")
        self._apply_ru_runtime_filter(params, runtime_min=runtime_min, runtime_max=runtime_max)

        payload = await self.poiskkino.get("/v1.4/movie", params=params)
        total = self._extract_poiskkino_total(payload)
        if total is None:
            result = FiltersPreviewOut(unavailable=True)
            await self.cache.set_json(cache_key, result.model_dump(), TTL_PREVIEW_ESTIMATE)
            return result
        adjusted = max(0, total - len(excluded_kp_ids))
        result = FiltersPreviewOut(
            estimated_total=adjusted,
            low_results=adjusted < 25,
            unavailable=False,
        )
        await self.cache.set_json(cache_key, result.model_dump(), TTL_PREVIEW_ESTIMATE)
        return result

    @staticmethod
    def _normalize_iso_country_filter(raw: str) -> str:
        parts = [p.strip().upper() for p in re.split(r"[|,]", raw or "") if p.strip()]
        iso = [p for p in parts if len(p) == 2 and p.isalpha()]
        # Preserve order while removing duplicates.
        unique = list(dict.fromkeys(iso))
        return ",".join(unique)

    @staticmethod
    def _passes_imdb_filter(imdb_rating: Optional[float], min_rating: float) -> bool:
        if min_rating <= 0:
            return True
        if imdb_rating is None:
            return False
        try:
            return float(imdb_rating) >= float(min_rating)
        except (TypeError, ValueError):
            return False

    @staticmethod
    def _discover_strategy(min_rating: float) -> dict[str, object]:
        if min_rating >= 8.5:
            return {
                "sort_by": "vote_average.desc",
                "vote_count_gte": 250,
                "probe_pages": 18,
                "max_resolve_candidates": 160,
                "shuffle_candidates": False,
            }
        if min_rating >= 7.5:
            return {
                "sort_by": "vote_average.desc",
                "vote_count_gte": 120,
                "probe_pages": 12,
                "max_resolve_candidates": 120,
                "shuffle_candidates": False,
            }
        if min_rating >= 6.5:
            return {
                "sort_by": "popularity.desc",
                "vote_count_gte": 80,
                "probe_pages": 8,
                "max_resolve_candidates": 90,
                "shuffle_candidates": True,
            }
        return {
            "sort_by": "popularity.desc",
            "vote_count_gte": 50,
            "probe_pages": 5,
            "max_resolve_candidates": 70,
            "shuffle_candidates": True,
        }

    @staticmethod
    def _build_page_plan(total_pages: int, probe_pages: int) -> list[int]:
        if total_pages <= 1:
            return [1]
        max_probe = max(1, min(probe_pages, total_pages))
        if max_probe == 1:
            return [1]
        candidates = list(range(2, total_pages + 1))
        extras = random.sample(candidates, k=max_probe - 1)
        return [1, *extras]

    async def _collect_preview_candidates(
        self,
        *,
        params: dict[str, object],
        lang: str,
        first_page: dict[str, object],
        total_pages: int,
        probe_pages: int,
        sample_target: int,
    ) -> list[int]:
        if sample_target <= 0:
            return []

        page_plan = self._build_page_plan(total_pages, probe_pages)
        pages = [page for page in page_plan if page != 1]
        payloads: list[dict[str, object]] = [first_page]

        if pages:
            tasks = [
                self.tmdb.get("/discover/movie", {**params, "page": page, "language": lang})
                for page in pages
            ]
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            for response in responses:
                if isinstance(response, Exception):
                    continue
                payloads.append(response)

        candidate_ids: list[int] = []
        seen_ids: set[int] = set()

        for payload in payloads:
            results = payload.get("results")
            if not isinstance(results, list):
                continue
            for item in results:
                if not isinstance(item, dict):
                    continue
                movie_id = self._safe_int(item.get("id"))
                if movie_id is None or movie_id in seen_ids:
                    continue
                seen_ids.add(movie_id)
                candidate_ids.append(movie_id)
                if len(candidate_ids) >= sample_target:
                    return candidate_ids
        return candidate_ids

    async def _count_imdb_preview_hits(
        self,
        *,
        lang: str,
        tmdb_ids: list[int],
        min_rating: float,
        excluded_kp_ids: set[int],
    ) -> Optional[tuple[int, int]]:
        if not tmdb_ids:
            return None

        semaphore = asyncio.Semaphore(6)

        async def inspect(tmdb_id: int) -> Optional[bool]:
            async with semaphore:
                try:
                    movie = await self.movie_resolver.resolve(lang=lang, tmdb_id=tmdb_id)
                except Exception:
                    return None
                kp_movie_id = self._safe_int(movie.kp_id)
                if kp_movie_id is not None and kp_movie_id in excluded_kp_ids:
                    return False
                return self._passes_imdb_filter(movie.imdb_rating, min_rating)

        checks = await asyncio.gather(*(inspect(tmdb_id) for tmdb_id in tmdb_ids))
        usable = [item for item in checks if item is not None]
        min_usable = min(len(tmdb_ids), max(8, len(tmdb_ids) // 3))
        if len(usable) < min_usable:
            return None

        passed = sum(1 for item in usable if item is True)
        checked = len(usable)
        return passed, checked

    @staticmethod
    def _parse_int_set(raw: Optional[str]) -> set[int]:
        if not raw:
            return set()
        values: set[int] = set()
        for part in re.split(r"[|,]", raw):
            chunk = part.strip()
            if not chunk:
                continue
            try:
                values.add(int(chunk))
            except (TypeError, ValueError):
                continue
        return values

    @staticmethod
    def _watch_region_for_request(*, lang: str, country: Optional[str]) -> str:
        normalized = RandomService._normalize_iso_country_filter(country or "")
        if normalized:
            return normalized.split(",")[0]
        return "RU" if lang.startswith("ru") else "US"

    @staticmethod
    def _apply_ru_runtime_filter(
        params: dict[str, object], *, runtime_min: Optional[int], runtime_max: Optional[int]
    ) -> None:
        if runtime_min and runtime_max and runtime_min <= runtime_max:
            params["movieLength"] = f"{runtime_min}-{runtime_max}"
            return
        if runtime_min:
            params["movieLength"] = f"{runtime_min}-500"
            return
        if runtime_max:
            params["movieLength"] = f"1-{runtime_max}"

    def _weighted_order_candidates(
        self,
        candidate_ids: list[int],
        *,
        id_to_item: dict[int, dict[str, object]],
        min_rating: float,
        year_from: Optional[int],
        year_to: Optional[int],
        runtime_min: Optional[int],
        runtime_max: Optional[int],
        prefer_shuffle: bool,
    ) -> list[int]:
        if not candidate_ids:
            return []
        weights = [
            max(
                0.05,
                self._candidate_weight(
                    id_to_item.get(movie_id) or {},
                    min_rating=min_rating,
                    year_from=year_from,
                    year_to=year_to,
                    runtime_min=runtime_min,
                    runtime_max=runtime_max,
                ),
            )
            for movie_id in candidate_ids
        ]

        if not prefer_shuffle:
            paired = sorted(
                zip(candidate_ids, weights, strict=False),
                key=lambda row: row[1],
                reverse=True,
            )
            # Keep variety among similarly scored candidates.
            out: list[int] = []
            chunk = 7
            for i in range(0, len(paired), chunk):
                batch = [x[0] for x in paired[i:i + chunk]]
                random.shuffle(batch)
                out.extend(batch)
            return out

        ids = candidate_ids[:]
        ws = weights[:]
        out: list[int] = []
        while ids:
            idx = random.choices(range(len(ids)), weights=ws, k=1)[0]
            out.append(ids.pop(idx))
            ws.pop(idx)
        return out

    @staticmethod
    def _candidate_weight(
        item: dict[str, object],
        *,
        min_rating: float,
        year_from: Optional[int],
        year_to: Optional[int],
        runtime_min: Optional[int],
        runtime_max: Optional[int],
    ) -> float:
        tmdb_vote = float(item.get("vote_average") or 0.0)
        popularity = float(item.get("popularity") or 0.0)
        vote_count = float(item.get("vote_count") or 0.0)
        rating_component = max(0.0, tmdb_vote / 10.0)
        pop_component = min(1.0, popularity / 80.0)
        votes_component = min(1.0, vote_count / 1400.0)
        score = 0.45 + rating_component * 1.35 + pop_component * 0.7 + votes_component * 0.55

        release_date = str(item.get("release_date") or "")
        release_year = RandomService._safe_int(release_date[:4])
        if release_year is not None and year_from and year_to and year_from <= year_to:
            mid = (year_from + year_to) / 2.0
            span = max(1.0, (year_to - year_from) / 2.0)
            proximity = max(0.0, 1.0 - abs(release_year - mid) / (span * 1.5))
            score += proximity * 0.25

        if runtime_min or runtime_max:
            # Discover runtime isn't available in result payload; leave a slight
            # stochastic variance to avoid deterministic loops on strict filters.
            score *= random.uniform(0.9, 1.07)
        else:
            score *= random.uniform(0.95, 1.12)

        if min_rating >= 8.0:
            score *= 1.08 + rating_component * 0.2
        return score

    @staticmethod
    def _build_recommendation_reason(
        *,
        lang: str,
        movie: MovieCard,
        year_from: Optional[int],
        year_to: Optional[int],
        runtime_min: Optional[int],
        runtime_max: Optional[int],
        genres: Optional[str],
        vote_avg_min: float,
        country: Optional[str],
    ) -> str:
        is_ru = lang.startswith("ru")
        parts: list[str] = []
        if year_from or year_to:
            start = year_from or "—"
            end = year_to or "—"
            parts.append(f"{'Годы' if is_ru else 'Year'} {start}-{end}")
        if runtime_min or runtime_max:
            if runtime_min and runtime_max:
                rt = f"{runtime_min}-{runtime_max} {'мин' if is_ru else 'min'}"
            elif runtime_min:
                rt = f"{'>=' if not is_ru else 'от'} {runtime_min} {'мин' if is_ru else 'min'}"
            else:
                rt = f"{'<=' if not is_ru else 'до'} {runtime_max} {'мин' if is_ru else 'min'}"
            parts.append(f"{'Длительность' if is_ru else 'Runtime'} {rt}")
        if vote_avg_min > 1.01:
            value = movie.imdb_rating if movie.imdb_rating is not None else vote_avg_min
            parts.append(f"IMDb {value:.1f} {'≥' if not is_ru else 'не ниже'} {vote_avg_min:.1f}")
        if genres:
            parts.append("Совпадение по жанру" if is_ru else "Genre match")
        if country:
            parts.append("Совпадение по стране" if is_ru else "Country match")
        if movie.watch_providers:
            parts.append("Есть где смотреть" if is_ru else "Available to stream")
        if not parts:
            return "Под ваш запрос" if is_ru else "Picked for your request"
        return " • ".join(parts[:4])

    async def _order_by_recentness(
        self, recent_key: str, candidate_pool: list[int], *, prefer_shuffle: bool
    ) -> list[int]:
        if not candidate_pool:
            return []
        recent = await self.recent.members(recent_key)
        fresh = [x for x in candidate_pool if str(x) not in recent]
        stale = [x for x in candidate_pool if str(x) in recent]

        if not fresh:
            await self.recent.redis.delete(recent_key)
            ordered = candidate_pool[:]
        else:
            ordered = [*fresh, *stale]

        if prefer_shuffle:
            random.shuffle(ordered)
        return ordered

    @staticmethod
    def _ru_attempt_budget(min_rating: float) -> int:
        if min_rating >= 8.5:
            return 32
        if min_rating >= 7.5:
            return 22
        return 12

    @staticmethod
    def _preview_sample_target(min_rating: float, total_results: int) -> int:
        if total_results <= 120:
            return max(1, total_results)
        if min_rating >= 8.5:
            return 90
        if min_rating >= 7.5:
            return 72
        if min_rating >= 6.5:
            return 56
        if min_rating >= 5.5:
            return 44
        return 32

    @staticmethod
    def _preview_probe_pages(min_rating: float, total_pages: int, sample_target: int) -> int:
        if total_pages <= 1:
            return 1
        pages_for_sample = max(1, (sample_target + 19) // 20)
        if min_rating >= 8.5:
            base = 16
        elif min_rating >= 7.5:
            base = 12
        elif min_rating >= 6.5:
            base = 9
        else:
            base = 7
        return min(total_pages, max(base, pages_for_sample))

    @staticmethod
    def _safe_int(value: object) -> Optional[int]:
        try:
            parsed = int(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None
        return parsed

    @classmethod
    def _extract_poiskkino_total(cls, payload: dict[str, object]) -> Optional[int]:
        for key in ("total", "totalDocs", "total_docs", "totalCount", "count"):
            parsed = cls._safe_int(payload.get(key))
            if parsed is not None:
                return parsed

        docs = payload.get("docs")
        if isinstance(docs, list):
            return len(docs)
        return None
