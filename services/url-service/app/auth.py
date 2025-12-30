"""Authentication and authorization for URL service."""
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from app.config import get_settings

settings = get_settings()
security = HTTPBearer(auto_error=False)


class TokenData(BaseModel):
    """Decoded JWT token data."""
    user_id: str


class OptionalUser(BaseModel):
    """User info that may or may not be authenticated."""
    user_id: Optional[str] = None
    is_authenticated: bool = False


def decode_token(token: str) -> TokenData:
    """
    Decode and validate JWT token.

    Raises:
        HTTPException: If token is invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"]
        )
        user_id = payload.get("userId")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
        return TokenData(user_id=str(user_id))
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TokenData:
    """
    Require authentication - raises 401 if not authenticated.

    Use this for endpoints that require login.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return decode_token(credentials.credentials)


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> OptionalUser:
    """
    Optional authentication - returns user if authenticated, empty user otherwise.

    Use this for endpoints that work for both guests and logged-in users.
    """
    if credentials is None:
        return OptionalUser(is_authenticated=False)

    try:
        token_data = decode_token(credentials.credentials)
        return OptionalUser(user_id=token_data.user_id, is_authenticated=True)
    except HTTPException:
        return OptionalUser(is_authenticated=False)


def verify_internal_api_key(x_internal_api_key: Optional[str] = Header(None)) -> bool:
    """
    Verify internal service API key.

    Used for service-to-service communication.
    """
    if x_internal_api_key is None:
        return False
    return x_internal_api_key == settings.internal_api_key


async def require_internal_or_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_internal_api_key: Optional[str] = Header(None),
) -> Optional[TokenData]:
    """
    Allow either internal service or authenticated user.

    Returns TokenData if user is authenticated, None if internal service.
    Raises 401 if neither.
    """
    if verify_internal_api_key(x_internal_api_key):
        return None  

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    return decode_token(credentials.credentials)
