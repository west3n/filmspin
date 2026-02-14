import hashlib
import json
from typing import Any, Optional, Tuple

from redis.asyncio import Redis


class CacheRepository:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    @staticmethod
    def filters_key(*parts: Any) -> str:
        raw = "|".join("" if p is None else str(p) for p in parts)
        return hashlib.sha1(raw.encode("utf-8")).hexdigest()

    async def get_json(self, key: str) -> Optional[Any]:
        raw = await self.redis.get(key)
        return json.loads(raw) if raw else None

    async def get_json_hit(self, key: str) -> Tuple[bool, Optional[Any]]:
        raw = await self.redis.get(key)
        if raw is None:
            return False, None
        return True, json.loads(raw)

    async def set_json(self, key: str, value: Any, ttl: int) -> None:
        await self.redis.set(key, json.dumps(value, ensure_ascii=False), ex=ttl)
