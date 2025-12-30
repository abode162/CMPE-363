"""
Tests for the authentication module.

Tests JWT token decoding and user authentication functions.
"""
import pytest
from datetime import datetime, timedelta
import uuid

import jwt
from fastapi import HTTPException

from app.auth import decode_token, TokenData, OptionalUser
from app.config import get_settings


class TestDecodeToken:
    """Tests for decode_token function."""

    def test_decode_valid_token(self, settings):
        """Valid token should decode successfully."""
        user_id = str(uuid.uuid4())
        payload = {
            "userId": user_id,
            "exp": datetime.utcnow() + timedelta(hours=1),
            "iat": datetime.utcnow(),
        }
        token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")

        result = decode_token(token)

        assert isinstance(result, TokenData)
        assert result.user_id == user_id

    def test_decode_expired_token(self, settings):
        """Expired token should raise HTTPException with 401."""
        user_id = str(uuid.uuid4())
        payload = {
            "userId": user_id,
            "exp": datetime.utcnow() - timedelta(hours=1),
            "iat": datetime.utcnow() - timedelta(hours=2),
        }
        token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")

        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)

        assert exc_info.value.status_code == 401
        assert "expired" in exc_info.value.detail.lower()

    def test_decode_invalid_token(self, settings):
        """Invalid token should raise HTTPException with 401."""
        with pytest.raises(HTTPException) as exc_info:
            decode_token("invalid.token.here")

        assert exc_info.value.status_code == 401
        assert "invalid" in exc_info.value.detail.lower()

    def test_decode_token_wrong_secret(self, settings):
        """Token with wrong secret should fail."""
        user_id = str(uuid.uuid4())
        payload = {
            "userId": user_id,
            "exp": datetime.utcnow() + timedelta(hours=1),
            "iat": datetime.utcnow(),
        }
        token = jwt.encode(payload, "wrong-secret", algorithm="HS256")

        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)

        assert exc_info.value.status_code == 401

    def test_decode_token_missing_user_id(self, settings):
        """Token without userId should raise HTTPException."""
        payload = {
            "exp": datetime.utcnow() + timedelta(hours=1),
            "iat": datetime.utcnow(),
        }
        token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")

        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)

        assert exc_info.value.status_code == 401
        assert "invalid" in exc_info.value.detail.lower()
    
    def test_decode_token_none_algorithm(self, settings):
        """Token with 'none' algorithm should be rejected."""
        user_id = str(uuid.uuid4())
        # Manually create a header with 'none' alg
        token = jwt.encode(
            {"userId": user_id}, 
            key=None, 
            algorithm="none"
        )

        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)

        # Should fail because your decoder expects HS256/Secret
        assert exc_info.value.status_code == 401
        assert "invalid" in exc_info.value.detail.lower()

class TestTokenDataModel:
    """Tests for TokenData Pydantic model."""

    def test_token_data_creation(self):
        """TokenData should accept user_id."""
        token_data = TokenData(user_id="test-user-123")
        assert token_data.user_id == "test-user-123"

    def test_token_data_uuid_string(self):
        """TokenData should accept UUID as string."""
        user_id = str(uuid.uuid4())
        token_data = TokenData(user_id=user_id)
        assert token_data.user_id == user_id


class TestOptionalUserModel:
    """Tests for OptionalUser Pydantic model."""

    def test_optional_user_authenticated(self):
        """OptionalUser for authenticated user."""
        user_id = str(uuid.uuid4())
        user = OptionalUser(user_id=user_id, is_authenticated=True)
        assert user.user_id == user_id
        assert user.is_authenticated is True

    def test_optional_user_guest(self):
        """OptionalUser for guest (unauthenticated)."""
        user = OptionalUser(is_authenticated=False)
        assert user.user_id is None
        assert user.is_authenticated is False

    def test_optional_user_default(self):
        """OptionalUser default values."""
        user = OptionalUser()
        assert user.user_id is None
        assert user.is_authenticated is False
