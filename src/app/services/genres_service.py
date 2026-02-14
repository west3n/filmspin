from ..clients import PoiskkinoClient, TmdbClient
from ..core.config import TTL_GENRES
from ..repositories import CacheRepository
from ..schemas import GenreItem


class GenresService:
    def __init__(
        self, *, cache: CacheRepository, tmdb: TmdbClient, poiskkino: PoiskkinoClient
    ) -> None:
        self.cache = cache
        self.tmdb = tmdb
        self.poiskkino = poiskkino

    async def get_genres(self, lang: str) -> list[GenreItem]:
        key = f"genres:{lang}"
        hit, cached = await self.cache.get_json_hit(key)
        if hit and isinstance(cached, list):
            return [GenreItem.model_validate(x) for x in cached]
        data = await self.tmdb.get("/genre/movie/list", {"language": lang})
        payload = data.get("genres", [])
        items = [GenreItem.model_validate(x) for x in payload if isinstance(x, dict)]
        await self.cache.set_json(key, [x.model_dump() for x in items], TTL_GENRES)
        return items

    async def get_genres_ru(self) -> list[GenreItem]:
        key = "genres:ru"
        hit, cached = await self.cache.get_json_hit(key)
        if hit and isinstance(cached, list):
            return [GenreItem.model_validate(x) for x in cached]
        values = await self.poiskkino.get_list(
            "/v1/movie/possible-values-by-field", {"field": "genres.name"}
        )
        items = [
            GenreItem(id=v["name"].lower(), name=self._ucfirst(v["name"]))
            for v in values
            if v.get("name")
        ]
        await self.cache.set_json(key, [x.model_dump() for x in items], TTL_GENRES)
        return items

    @staticmethod
    def _ucfirst(value: str) -> str:
        return value[:1].upper() + value[1:] if value else value
