from typing import Optional

from fastapi import APIRouter, Depends, Query

from ..dependencies import get_random_service, require_ru_enabled
from ..schemas import ApiError, MovieCard
from ..services.random_service import RandomService

router = APIRouter(prefix="/api", tags=["random"])


@router.get("/random", response_model=MovieCard | ApiError)
async def random_movie(
    year_from: Optional[int] = Query(None, ge=1900, le=2100),
    year_to: Optional[int] = Query(None, ge=1900, le=2100),
    genres: Optional[str] = Query(
        None, description="TMDb genre ids, comma or | separated"
    ),
    vote_avg_min: float = Query(0.0, ge=0.0, le=10.0),
    country: Optional[str] = Query(None, description="ISO 3166-1 code (e.g. US, GB)"),
    lang: str = Query("en-US", description="TMDb language code, e.g. en-US or ru-RU"),
    service: RandomService = Depends(get_random_service),
):
    return await service.random_en(
        year_from=year_from,
        year_to=year_to,
        genres=genres,
        vote_avg_min=vote_avg_min,
        country=country,
        lang=lang,
    )


@router.get("/random_ru", response_model=MovieCard | ApiError)
async def random_movie_ru(
    year_from: Optional[int] = Query(None, ge=1900, le=2100),
    year_to: Optional[int] = Query(None, ge=1900, le=2100),
    genres: Optional[str] = Query(
        None, description="жанры (slug’и) через | или , например: komediya|uzhasy"
    ),
    vote_avg_min: float = Query(0.0, ge=0.0, le=9.0, description="KP rating 0..10"),
    country: Optional[str] = Query(
        None, description="ISO-коды (RU|US|CN) или рус./англ. названия через |"
    ),
    _: None = Depends(require_ru_enabled),
    service: RandomService = Depends(get_random_service),
):
    return await service.random_ru(
        year_from=year_from,
        year_to=year_to,
        genres=genres,
        vote_avg_min=vote_avg_min,
        country=country,
    )
