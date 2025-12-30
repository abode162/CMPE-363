"""Redis caching layer for URL lookups."""
import json
import logging
from typing import Optional

import redis.asyncio as redis

from app.config import get_settings
from app.metrics import cache_hits_total, cache_misses_total

settings = get_settings()
logger = logging.getLogger(__name__)

# Redis client singleton
_redis_client: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    """Get or create Redis client."""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


async def close_redis():
    """Close Redis connection."""
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None


async def get_cached_url(short_code: str) -> Optional[dict]:
    """
    Get URL data from cache.

    Returns:
        dict with 'original_url' and optionally 'expires_at', or None if not cached.
    """
    try:
        client = await get_redis()
        data = await client.get(f"url:{short_code}")
        if data:
            logger.debug(f"Cache HIT for {short_code}")
            cache_hits_total.inc()
            return json.loads(data)
        logger.debug(f"Cache MISS for {short_code}")
        cache_misses_total.inc()
        return None
    except Exception as e:
        logger.warning(f"Redis error on get: {e}")
        return None


async def cache_url(short_code: str, original_url: str, expires_at: Optional[str] = None, ttl: int = 3600):
    """
    Cache URL data.

    Args:
        short_code: The short URL code
        original_url: The destination URL
        expires_at: Optional expiration datetime (ISO format string)
        ttl: Cache TTL in seconds (default 1 hour)
    """
    try:
        client = await get_redis()
        data = {"original_url": original_url}
        if expires_at:
            data["expires_at"] = expires_at

        await client.setex(
            f"url:{short_code}",
            ttl,
            json.dumps(data),
        )
        logger.debug(f"Cached URL {short_code} with TTL {ttl}s")
    except Exception as e:
        logger.warning(f"Redis error on set: {e}")


async def invalidate_url(short_code: str):
    """Remove URL from cache."""
    try:
        client = await get_redis()
        await client.delete(f"url:{short_code}")
        logger.debug(f"Invalidated cache for {short_code}")
    except Exception as e:
        logger.warning(f"Redis error on delete: {e}")


async def cache_health_check() -> bool:
    """Check if Redis is healthy."""
    try:
        client = await get_redis()
        await client.ping()
        return True
    except Exception:
        return False
