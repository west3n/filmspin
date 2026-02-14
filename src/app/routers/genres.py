from fastapi import APIRouter, Depends, Query

from ..dependencies import get_genres_service, require_ru_enabled
from ..schemas import GenreItem
from ..services.genres_service import GenresService

router = APIRouter(prefix="/api", tags=["genres"])


@router.get("/genres", response_model=list[GenreItem])
async def genres(
    lang: str = Query("en-US"),
    service: GenresService = Depends(get_genres_service),
):
    return await service.get_genres(lang)


@router.get("/genres_ru", response_model=list[GenreItem])
async def genres_ru(
    _: None = Depends(require_ru_enabled),
    service: GenresService = Depends(get_genres_service),
):
    return await service.get_genres_ru()
