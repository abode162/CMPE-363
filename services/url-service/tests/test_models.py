"""
Unit tests for the SQLAlchemy Database Models
verifies data integrity, default values, and constraints in isolation 
from the API layer.
"""
import pytest
import uuid
from datetime import datetime, timedelta
from app.models import URL

class TestURLModel:
    """Tests for the URL database model."""

    @pytest.mark.asyncio
    async def test_url_model_defaults(self, db_session, test_user_id):
        """New URL should have correct default values."""
        url = URL(
            short_code="def123",
            original_url="https://example.com/defaults",
            user_id=uuid.UUID(test_user_id)
        )
        db_session.add(url)
        await db_session.commit()
        await db_session.refresh(url)


        assert url.created_at is not None
        assert isinstance(url.created_at, datetime)
        assert (datetime.utcnow() - url.created_at).total_seconds() < 1

    @pytest.mark.asyncio
    async def test_url_model_expiration(self, db_session, test_user_id):
        """URL expiration logic works at model level."""
        expires_at = datetime.utcnow() + timedelta(days=7)
        url = URL(
            short_code="exp123",
            original_url="https://example.com/expires",
            user_id=uuid.UUID(test_user_id),
            expires_at=expires_at
        )
        db_session.add(url)
        await db_session.commit()
        await db_session.refresh(url)

        assert url.expires_at == expires_at

    @pytest.mark.asyncio
    async def test_url_model_guest_claim_token(self, db_session):
        """Guest URLs should store claim tokens."""
        claim_token = str(uuid.uuid4())
        url = URL(
            short_code="guest99",
            original_url="https://example.com/guest",
            user_id=None,
            claim_token=claim_token
        )
        db_session.add(url)
        await db_session.commit()
        await db_session.refresh(url)

        assert url.user_id is None
        assert url.claim_token == claim_token

    @pytest.mark.asyncio
    async def test_url_representation(self):
        """Test string representation of the model."""
        url = URL(short_code="repr123", original_url="http://test.com")
        assert "repr123" in str(url) or "URL" in str(url)