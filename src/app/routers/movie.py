from typing import Optional
from fastapi import APIRouter, Depends, Query

from ..dependencies import get_movie_service, require_ru_enabled
from ..schemas import ApiError, MovieCard
from ..services.movie_service import MovieResolverService

router = APIRouter(prefix="/api", tags=["movie"])


@router.get("/movie", response_model=MovieCard)
async def movie_by_tmdb(
    tmdb_id: int,
    lang: str = Query("en-US", description="TMDb language code, e.g. en-US or ru-RU"),
    watch_region: Optional[str] = Query(None, description="Watch providers region, e.g. US, RU"),
    service: MovieResolverService = Depends(get_movie_service),
):
    return await service.resolve(lang=lang, tmdb_id=tmdb_id, watch_region=watch_region)


@router.get("/movie_ru", response_model=MovieCard)
async def movie_by_kp(
    id: int,
    watch_region: Optional[str] = Query(None, description="Watch providers region, e.g. US, RU"),
    _: None = Depends(require_ru_enabled),
    service: MovieResolverService = Depends(get_movie_service),
):
    return await service.resolve(lang="ru-RU", kp_id=id, watch_region=watch_region)


@router.get("/movie_ru_by_external", response_model=MovieCard | ApiError)
async def movie_ru_by_external(
    tmdb_id: Optional[int] = None,
    imdb_id: Optional[str] = None,
    watch_region: Optional[str] = Query(None, description="Watch providers region, e.g. US, RU"),
    _: None = Depends(require_ru_enabled),
    service: MovieResolverService = Depends(get_movie_service),
):
    if not tmdb_id and not imdb_id:
        return ApiError(error="Provide tmdb_id or imdb_id")
    return await service.resolve(
        lang="ru-RU",
        tmdb_id=tmdb_id,
        imdb_id=imdb_id,
        watch_region=watch_region,
    )
