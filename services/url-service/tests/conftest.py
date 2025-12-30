"""
Pytest fixtures for URL service tests.

Uses the actual PostgreSQL and Redis from Docker Compose for realistic testing.
"""
import asyncio
import os
import uuid
from datetime import datetime, timedelta
from typing import AsyncGenerator

import jwt
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from unittest.mock import AsyncMock, patch

from app.database import Base, get_db
from app.main import app
from app.config import get_settings
from app.models import URL

# Test configuration
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/urlshortener_test"
)
TEST_REDIS_URL = os.environ.get("TEST_REDIS_URL", "redis://localhost:6379/1")


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def test_engine():
    """Create a test database engine."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Drop all tables after tests
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    async_session = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    async with async_session() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture(scope="function")
async def client(db_session) -> AsyncGenerator[AsyncClient, None]:
    """Create a test HTTP client with database session override."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    # Mock Redis cache to avoid needing actual Redis in tests
    with patch("app.routes.cache_url", new_callable=AsyncMock) as mock_cache, \
         patch("app.routes.get_cached_url", new_callable=AsyncMock) as mock_get_cache, \
         patch("app.routes.invalidate_url", new_callable=AsyncMock) as mock_invalidate, \
         patch("app.routes.cache_health_check", new_callable=AsyncMock) as mock_health:

        mock_cache.return_value = None
        mock_get_cache.return_value = None  
        mock_invalidate.return_value = None
        mock_health.return_value = True

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client_with_cache(db_session) -> AsyncGenerator[AsyncClient, None]:
    """Create a test HTTP client with mocked cache that returns data."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
def settings():
    """Get application settings."""
    return get_settings()


@pytest.fixture
def test_user_id() -> str:
    """Generate a test user ID."""
    return str(uuid.uuid4())


@pytest.fixture
def another_user_id() -> str:
    """Generate another test user ID for permission tests."""
    return str(uuid.uuid4())


@pytest.fixture
def auth_token(settings, test_user_id) -> str:
    """Generate a valid JWT token for testing."""
    payload = {
        "userId": test_user_id,
        "exp": datetime.utcnow() + timedelta(hours=1),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


@pytest.fixture
def another_auth_token(settings, another_user_id) -> str:
    """Generate a JWT token for another user."""
    payload = {
        "userId": another_user_id,
        "exp": datetime.utcnow() + timedelta(hours=1),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


@pytest.fixture
def expired_token(settings, test_user_id) -> str:
    """Generate an expired JWT token for testing."""
    payload = {
        "userId": test_user_id,
        "exp": datetime.utcnow() - timedelta(hours=1),
        "iat": datetime.utcnow() - timedelta(hours=2),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


@pytest.fixture
def invalid_token() -> str:
    """Generate an invalid JWT token for testing."""
    return "invalid.token.here"


@pytest.fixture
def auth_headers(auth_token) -> dict:
    """Get authorization headers for authenticated requests."""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def another_auth_headers(another_auth_token) -> dict:
    """Get authorization headers for another user."""
    return {"Authorization": f"Bearer {another_auth_token}"}


@pytest.fixture
def guest_claim_token() -> str:
    """Generate a claim token for guest URLs."""
    return str(uuid.uuid4())


@pytest_asyncio.fixture
async def sample_url(db_session, test_user_id) -> URL:
    """Create a sample URL for testing."""
    url = URL(
        short_code="test123",
        original_url="https://example.com/test",
        user_id=uuid.UUID(test_user_id),
    )
    db_session.add(url)
    await db_session.commit()
    await db_session.refresh(url)
    return url


@pytest_asyncio.fixture
async def guest_url(db_session, guest_claim_token) -> URL:
    """Create a guest URL (no user_id) for testing."""
    url = URL(
        short_code="guest1",
        original_url="https://example.com/guest",
        user_id=None,
        claim_token=guest_claim_token,
    )
    db_session.add(url)
    await db_session.commit()
    await db_session.refresh(url)
    return url


@pytest_asyncio.fixture
async def expired_url(db_session, test_user_id) -> URL:
    """Create an expired URL for testing."""
    url = URL(
        short_code="exprd1",
        original_url="https://example.com/expired",
        user_id=uuid.UUID(test_user_id),
        expires_at=datetime.utcnow() - timedelta(days=1),
    )
    db_session.add(url)
    await db_session.commit()
    await db_session.refresh(url)
    return url


@pytest_asyncio.fixture
async def future_expiring_url(db_session, test_user_id) -> URL:
    """Create a URL that expires in the future."""
    url = URL(
        short_code="future1",
        original_url="https://example.com/future",
        user_id=uuid.UUID(test_user_id),
        expires_at=datetime.utcnow() + timedelta(days=30),
    )
    db_session.add(url)
    await db_session.commit()
    await db_session.refresh(url)
    return url
