import random
from typing import Iterable, Optional

from redis.asyncio import Redis


class RecentRepository:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    async def add(self, key: str, movie_id: str, *, ttl: int, limit: int) -> None:
        pipe = self.redis.pipeline()
        pipe.sadd(key, movie_id)
        pipe.expire(key, ttl)
        pipe.scard(key)
        _, _, size = await pipe.execute()
        if isinstance(size, int) and size > limit:
            await self.redis.spop(key, size - limit)

    async def members(self, key: str) -> set[str]:
        return await self.redis.smembers(key)

    async def choose_not_recent(
        self, key: str, candidates: Iterable[int]
    ) -> tuple[Optional[int], list[int]]:
        pool = list(candidates)
        if not pool:
            return None, []
        recent = await self.redis.smembers(key)
        if not recent:
            return random.choice(pool), pool
        fresh = [c for c in pool if str(c) not in recent]
        return (random.choice(fresh) if fresh else None), pool
