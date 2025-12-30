import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class URL(Base):
    __tablename__ = "urls"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    short_code: Mapped[str] = mapped_column(
        String(10),
        unique=True,
        index=True,
        nullable=False,
    )
    original_url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    claim_token: Mapped[Optional[str]] = mapped_column(
        String(36),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
        index=True,
    )

    @property
    def is_expired(self) -> bool:
        """Check if URL has expired."""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    def __repr__(self) -> str:
        return f"<URL(short_code={self.short_code}, original_url={self.original_url[:50]}...)>"
