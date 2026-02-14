from typing import Any, Optional

from redis.asyncio import Redis


class MappingRepository:
    MAP_TTL = 60 * 60 * 24 * 30

    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    @staticmethod
    def _tmdb_key(tmdb_id: int) -> str:
        return f"hmap:tmdb:{tmdb_id}"

    @staticmethod
    def _kp_key(kp_id: int) -> str:
        return f"hmap:kp:{kp_id}"

    @staticmethod
    def _as_int(v: Any) -> Optional[int]:
        try:
            return int(v) if v is not None else None
        except (TypeError, ValueError):
            return None

    async def get_by_tmdb(self, tmdb_id: int) -> dict[str, Any]:
        raw = await self.redis.hgetall(self._tmdb_key(tmdb_id))
        out: dict[str, Any] = {}
        if kp_id := self._as_int(raw.get("kp_id")):
            out["kp_id"] = kp_id
        if imdb_id := raw.get("imdb_id"):
            out["imdb_id"] = imdb_id
        return out

    async def get_by_kp(self, kp_id: int) -> dict[str, Any]:
        raw = await self.redis.hgetall(self._kp_key(kp_id))
        out: dict[str, Any] = {}
        if tmdb_id := self._as_int(raw.get("tmdb_id")):
            out["tmdb_id"] = tmdb_id
        if imdb_id := raw.get("imdb_id"):
            out["imdb_id"] = imdb_id
        return out

    async def set_map(
        self, tmdb_id: Optional[int], kp_id: Optional[int], imdb_id: Optional[str]
    ) -> None:
        pipe = self.redis.pipeline()
        if tmdb_id:
            data: dict[str, str] = {}
            if kp_id:
                data["kp_id"] = str(kp_id)
            if imdb_id:
                data["imdb_id"] = imdb_id
            if data:
                key = self._tmdb_key(tmdb_id)
                pipe.hset(key, mapping=data)
                pipe.expire(key, self.MAP_TTL)
        if kp_id:
            data = {}
            if tmdb_id:
                data["tmdb_id"] = str(tmdb_id)
            if imdb_id:
                data["imdb_id"] = imdb_id
            if data:
                key = self._kp_key(kp_id)
                pipe.hset(key, mapping=data)
                pipe.expire(key, self.MAP_TTL)
        if pipe.command_stack:
            await pipe.execute()
