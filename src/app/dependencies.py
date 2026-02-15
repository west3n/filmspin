import asyncio
import httpx
from fastapi import HTTPException
from redis.asyncio import from_url, Redis
from .clients import OmdbClient, PoiskkinoClient, TmdbClient
from .core.config import (
    REDIS_URL,
    HTTP_CONNECT_TIMEOUT,
    HTTP_READ_TIMEOUT,
    HTTP_WRITE_TIMEOUT,
    HTTP_POOL_TIMEOUT,
    HTTP_MAX_CONNECTIONS,
    HTTP_MAX_KEEPALIVE_CONNECTIONS,
    HTTP_ENABLE_HTTP2,
    HTTP_TRUST_ENV,
    RU_ENABLED,
)
from .repositories import CacheRepository, MappingRepository, RecentRepository
from .services.genres_service import GenresService
from .services.movie_service import MovieResolverService
from .services.random_service import RandomService

_redis: Redis | None = None
_redis_lock = asyncio.Lock()
_http: httpx.AsyncClient | None = None
_http_lock = asyncio.Lock()


async def get_redis() -> Redis:
    global _redis
    if _redis is None:
        async with _redis_lock:
            if _redis is None:
                _redis = from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
    return _redis


async def get_http_client() -> httpx.AsyncClient:
    global _http
    if _http is None:
        async with _http_lock:
            if _http is None:
                _http = httpx.AsyncClient(
                    timeout=httpx.Timeout(
                        connect=HTTP_CONNECT_TIMEOUT,
                        read=HTTP_READ_TIMEOUT,
                        write=HTTP_WRITE_TIMEOUT,
                        pool=HTTP_POOL_TIMEOUT,
                    ),
                    limits=httpx.Limits(
                        max_connections=HTTP_MAX_CONNECTIONS,
                        max_keepalive_connections=HTTP_MAX_KEEPALIVE_CONNECTIONS,
                    ),
                    http2=HTTP_ENABLE_HTTP2,
                    trust_env=HTTP_TRUST_ENV,
                )
    return _http


async def get_http() -> httpx.AsyncClient:
    return await get_http_client()


async def close_clients() -> None:
    global _http, _redis
    if _http is not None:
        await _http.aclose()
        _http = None
    if _redis is not None:
        await _redis.aclose()
        _redis = None


def require_ru_enabled() -> None:
    if not RU_ENABLED:
        raise HTTPException(status_code=404, detail="Not found")


async def get_cache_repo() -> CacheRepository:
    redis = await get_redis()
    return CacheRepository(redis)


async def get_mapping_repo() -> MappingRepository:
    redis = await get_redis()
    return MappingRepository(redis)


async def get_recent_repo() -> RecentRepository:
    redis = await get_redis()
    return RecentRepository(redis)


async def get_tmdb_client() -> TmdbClient:
    client = await get_http_client()
    return TmdbClient(client)


async def get_poiskkino_client() -> PoiskkinoClient:
    client = await get_http_client()
    return PoiskkinoClient(client)


async def get_omdb_client() -> OmdbClient:
    client = await get_http_client()
    return OmdbClient(client)


async def get_movie_service() -> MovieResolverService:
    redis = await get_redis()
    client = await get_http_client()
    return MovieResolverService(
        cache=CacheRepository(redis),
        mappings=MappingRepository(redis),
        tmdb=TmdbClient(client),
        poiskkino=PoiskkinoClient(client),
        omdb=OmdbClient(client),
    )


async def get_genres_service() -> GenresService:
    redis = await get_redis()
    client = await get_http_client()
    return GenresService(
        cache=CacheRepository(redis),
        tmdb=TmdbClient(client),
        poiskkino=PoiskkinoClient(client),
    )


async def get_random_service() -> RandomService:
    redis = await get_redis()
    client = await get_http_client()
    cache = CacheRepository(redis)
    return RandomService(
        cache=cache,
        recent=RecentRepository(redis),
        tmdb=TmdbClient(client),
        poiskkino=PoiskkinoClient(client),
        movie_resolver=MovieResolverService(
            cache=cache,
            mappings=MappingRepository(redis),
            tmdb=TmdbClient(client),
            poiskkino=PoiskkinoClient(client),
            omdb=OmdbClient(client),
        ),
    )
