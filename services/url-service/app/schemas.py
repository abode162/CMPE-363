from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, HttpUrl, ConfigDict, field_validator


class URLCreate(BaseModel):
    """Request schema for creating a short URL."""
    original_url: HttpUrl
    custom_code: Optional[str] = None
    expires_in_days: Optional[int] = None  
    @field_validator("expires_in_days")
    @classmethod
    def validate_expires_in_days(cls, v):
        if v is not None:
            if v < 1:
                raise ValueError("expires_in_days must be at least 1")
            if v > 365:
                raise ValueError("expires_in_days cannot exceed 365")
        return v


class URLResponse(BaseModel):
    """Response schema for created URL."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    short_code: str
    original_url: str
    short_url: str
    created_at: datetime
    expires_at: Optional[datetime] = None


class URLInfo(BaseModel):
    """Response schema for URL info with stats."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    short_code: str
    original_url: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    click_count: int = 0  
    is_owner: bool = False 


class URLListItem(BaseModel):
    """Response schema for URL list item."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    short_code: str
    original_url: str
    short_url: str
    created_at: datetime
    expires_at: Optional[datetime] = None


class ClaimRequest(BaseModel):
    """Request schema for claiming guest URLs."""
    claim_token: str


class ClaimResponse(BaseModel):
    """Response schema for claim operation."""
    claimed: int
    message: str


class HealthResponse(BaseModel):
    """Response schema for health check."""
    status: str
    service: str
    version: str
    redis_healthy: bool = True
