"""Aggregator for fetching data from other services."""
import logging
from typing import Optional

import httpx

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


async def get_click_count(short_code: str) -> int:
    """
    Fetch click count from Analytics service.

    Args:
        short_code: The short URL code

    Returns:
        Total click count, or 0 if fetch fails
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{settings.analytics_service_url}/api/analytics/{short_code}",
                headers={"X-Internal-API-Key": settings.internal_api_key},
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("totalClicks", 0)
            logger.warning(f"Analytics service returned {response.status_code} for {short_code}")
    except httpx.TimeoutException:
        logger.warning(f"Timeout fetching click count for {short_code}")
    except Exception as e:
        logger.warning(f"Error fetching click count for {short_code}: {e}")

    return 0


async def track_click(short_code: str, original_url: str) -> bool:
    """
    Track a click in the Analytics service.

    Args:
        short_code: The short URL code
        original_url: The destination URL

    Returns:
        True if tracking succeeded, False otherwise
    """
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.post(
                f"{settings.analytics_service_url}/api/analytics/track",
                json={
                    "short_code": short_code,
                    "original_url": original_url,
                },
                headers={"X-Internal-API-Key": settings.internal_api_key},
            )
            if response.status_code == 201:
                logger.debug(f"Click tracked for {short_code}")
                return True
            logger.warning(f"Analytics tracking returned {response.status_code}")
    except httpx.TimeoutException:
        logger.warning(f"Timeout tracking click for {short_code}")
    except Exception as e:
        logger.error(f"Error tracking click for {short_code}: {e}")

    return False
