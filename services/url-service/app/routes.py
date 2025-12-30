"""URL Service API routes."""
import io
import logging
import time
from datetime import datetime, timedelta
from typing import Optional

import qrcode
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request, status
from fastapi.responses import RedirectResponse, StreamingResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.aggregator import get_click_count, track_click
from app.auth import get_current_user, get_optional_user, OptionalUser, TokenData
from app.cache import cache_url, get_cached_url, invalidate_url, cache_health_check
from app.config import get_settings
from app.database import get_db
from app.models import URL
from app.schemas import (
    ClaimRequest,
    ClaimResponse,
    HealthResponse,
    URLCreate,
    URLInfo,
    URLListItem,
    URLResponse,
)
from app.utils import generate_short_code, is_valid_short_code
from app.metrics import (
    urls_created_total,
    redirects_total,
    redirect_latency,
    url_lookups_total,
    qr_codes_generated_total,
    urls_claimed_total,
)

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)


@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint."""
    redis_healthy = await cache_health_check()
    return HealthResponse(
        status="healthy",
        service="url-service",
        version="1.0.0",
        redis_healthy=redis_healthy,
    )


@router.post("/api/urls", response_model=URLResponse, status_code=status.HTTP_201_CREATED, tags=["URLs"])
async def create_short_url(
    url_data: URLCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: OptionalUser = Depends(get_optional_user),
    x_guest_claim_token: Optional[str] = Header(None),
):
    """
    Create a short URL.

    - Authenticated users: URL is associated with their account
    - Guests: URL is associated with a claim token for later claiming
    """
    
    if url_data.custom_code:
        if not is_valid_short_code(url_data.custom_code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid custom code. Must be 3-10 alphanumeric characters.",
            )
        existing = await db.execute(
            select(URL).where(URL.short_code == url_data.custom_code)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Custom code already exists.",
            )
        short_code = url_data.custom_code
    else:
        # Generate unique short code
        short_code = generate_short_code()
        while True:
            existing = await db.execute(
                select(URL).where(URL.short_code == short_code)
            )
            if not existing.scalar_one_or_none():
                break
            short_code = generate_short_code()

    # Calculate expiration if specified
    expires_at = None
    if url_data.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=url_data.expires_in_days)

    # Create URL record
    url = URL(
        short_code=short_code,
        original_url=str(url_data.original_url),
        user_id=user.user_id if user.is_authenticated else None,
        claim_token=x_guest_claim_token if not user.is_authenticated else None,
        expires_at=expires_at,
    )
    db.add(url)
    await db.commit()
    await db.refresh(url)

    # Cache the URL
    await cache_url(
        short_code,
        url.original_url,
        expires_at=expires_at.isoformat() if expires_at else None,
    )

    # Track successful URL creation
    urls_created_total.labels(status="success").inc()

    return URLResponse(
        id=url.id,
        short_code=url.short_code,
        original_url=url.original_url,
        short_url=f"{settings.base_url}/s/{url.short_code}",
        created_at=url.created_at,
        expires_at=url.expires_at,
    )


@router.post("/api/urls/claim", response_model=ClaimResponse, tags=["URLs"])
async def claim_guest_urls(
    claim_data: ClaimRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Claim guest URLs created with a claim token.

    Associates all URLs with the given claim token to the authenticated user.
    """
    # Update all URLs with matching claim token
    result = await db.execute(
        update(URL)
        .where(URL.claim_token == claim_data.claim_token)
        .where(URL.user_id.is_(None))
        .values(user_id=current_user.user_id, claim_token=None)
    )
    await db.commit()

    claimed_count = result.rowcount

    # Track claimed URLs
    if claimed_count > 0:
        urls_claimed_total.inc(claimed_count)

    return ClaimResponse(
        claimed=claimed_count,
        message=f"Successfully claimed {claimed_count} URL(s)",
    )


@router.get("/api/urls/{short_code}", response_model=URLInfo, tags=["URLs"])
async def get_url_info(
    short_code: str,
    db: AsyncSession = Depends(get_db),
    user: OptionalUser = Depends(get_optional_user),
):
    """Get URL info with click statistics."""
    result = await db.execute(
        select(URL).where(URL.short_code == short_code)
    )
    url = result.scalar_one_or_none()

    if not url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Short URL not found.",
        )


    if url.is_expired:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This short URL has expired.",
        )

    click_count = await get_click_count(short_code)

    is_owner = False
    if user.is_authenticated and url.user_id:
        is_owner = str(url.user_id) == user.user_id

    return URLInfo(
        id=url.id,
        short_code=url.short_code,
        original_url=url.original_url,
        created_at=url.created_at,
        expires_at=url.expires_at,
        click_count=click_count,
        is_owner=is_owner,
    )


@router.delete("/api/urls/{short_code}", status_code=status.HTTP_204_NO_CONTENT, tags=["URLs"])
async def delete_url(
    short_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Delete a URL. Only the owner can delete."""
    result = await db.execute(
        select(URL).where(URL.short_code == short_code)
    )
    url = result.scalar_one_or_none()

    if not url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Short URL not found.",
        )


    if not url.user_id or str(url.user_id) != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this URL.",
        )

    await db.delete(url)
    await db.commit()


    await invalidate_url(short_code)


@router.get("/{short_code}", tags=["Redirect"])
async def redirect_to_url(
    short_code: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Redirect to the original URL."""
    start_time = time.time()

    cached = await get_cached_url(short_code)

    if cached:
        url_lookups_total.labels(source="cache").inc()
        original_url = cached["original_url"]
        if cached.get("expires_at"):
            expires_at = datetime.fromisoformat(cached["expires_at"])
            if datetime.utcnow() > expires_at:
                redirects_total.labels(status="expired").inc()
                raise HTTPException(
                    status_code=status.HTTP_410_GONE,
                    detail="This short URL has expired.",
                )
    else:
        url_lookups_total.labels(source="database").inc()
        result = await db.execute(
            select(URL).where(URL.short_code == short_code)
        )
        url = result.scalar_one_or_none()

        if not url:
            redirects_total.labels(status="not_found").inc()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Short URL not found.",
            )


        if url.is_expired:
            redirects_total.labels(status="expired").inc()
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This short URL has expired.",
            )

        original_url = url.original_url


        await cache_url(
            short_code,
            original_url,
            expires_at=url.expires_at.isoformat() if url.expires_at else None,
        )

    background_tasks.add_task(track_click, short_code, original_url)
    redirects_total.labels(status="success").inc()
    redirect_latency.observe(time.time() - start_time)

    return RedirectResponse(
        url=original_url,
        status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    )


@router.get("/api/urls", response_model=list[URLListItem], tags=["URLs"])
async def list_urls(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """List URLs owned by the authenticated user."""
    limit = min(limit, 100)

    result = await db.execute(
        select(URL)
        .where(URL.user_id == current_user.user_id)
        .offset(skip)
        .limit(limit)
        .order_by(URL.created_at.desc())
    )
    urls = result.scalars().all()

    return [
        URLListItem(
            id=url.id,
            short_code=url.short_code,
            original_url=url.original_url,
            short_url=f"{settings.base_url}/s/{url.short_code}",
            created_at=url.created_at,
            expires_at=url.expires_at,
        )
        for url in urls
    ]


@router.get("/api/urls/{short_code}/qr", tags=["URLs"])
async def get_qr_code(
    short_code: str,
    size: int = 200,
    db: AsyncSession = Depends(get_db),
):
    """Generate QR code for a short URL."""
    # Validate size
    if size < 100 or size > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Size must be between 100 and 1000 pixels.",
        )

    # Verify URL exists
    result = await db.execute(
        select(URL).where(URL.short_code == short_code)
    )
    url = result.scalar_one_or_none()

    if not url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Short URL not found.",
        )

    if url.is_expired:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This short URL has expired.",
        )

    # Generate QR code
    short_url = f"{settings.base_url}/s/{short_code}"
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(short_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    # Resize if needed
    img = img.resize((size, size))

    img_bytes = io.BytesIO()
    img.save(img_bytes, format="PNG")
    img_bytes.seek(0)

    # Track QR code generation
    qr_codes_generated_total.inc()

    return StreamingResponse(
        img_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f"inline; filename=qr-{short_code}.png"},
    )
