"""
Comprehensive route tests for the URL service.

Tests all API endpoints with various scenarios including:
- Authentication (authenticated vs guest)
- Error handling (404, 401, 403, 410)
- Edge cases (custom codes, expiration, claiming)
"""
import pytest
from unittest.mock import AsyncMock, patch


class TestHealthEndpoint:
    """Tests for the /health endpoint."""

    @pytest.mark.asyncio
    async def test_health_check_returns_healthy(self, client):
        """Health check should return healthy status."""
        response = await client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "url-service"
        assert data["version"] == "1.0.0"
        assert "redis_healthy" in data


class TestCreateURLEndpoint:
    """Tests for POST /api/urls endpoint."""

    @pytest.mark.asyncio
    async def test_create_url_authenticated(self, client, auth_headers):
        """Authenticated user can create a URL."""
        response = await client.post(
            "/api/urls",
            json={"original_url": "https://example.com/test"},
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert "short_code" in data
        assert data["original_url"] == "https://example.com/test"
        assert "short_url" in data
        assert data["expires_at"] is None

    @pytest.mark.asyncio
    async def test_create_url_guest(self, client, guest_claim_token):
        """Guest can create a URL with claim token."""
        response = await client.post(
            "/api/urls",
            json={"original_url": "https://example.com/guest-url"},
            headers={"X-Guest-Claim-Token": guest_claim_token},
        )

        assert response.status_code == 201
        data = response.json()
        assert "short_code" in data
        assert data["original_url"] == "https://example.com/guest-url"

    @pytest.mark.asyncio
    async def test_create_url_with_custom_code(self, client, auth_headers):
        """Can create URL with custom short code."""
        response = await client.post(
            "/api/urls",
            json={
                "original_url": "https://example.com/custom",
                "custom_code": "mycustom",
            },
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["short_code"] == "mycustom"

    @pytest.mark.asyncio
    async def test_create_url_custom_code_conflict(self, client, auth_headers, sample_url):
        """Cannot create URL with existing custom code."""
        response = await client.post(
            "/api/urls",
            json={
                "original_url": "https://example.com/another",
                "custom_code": sample_url.short_code,
            },
            headers=auth_headers,
        )

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_create_url_invalid_custom_code(self, client, auth_headers):
        """Cannot create URL with invalid custom code."""
        response = await client.post(
            "/api/urls",
            json={
                "original_url": "https://example.com/test",
                "custom_code": "ab",  # Too short
            },
            headers=auth_headers,
        )

        assert response.status_code == 400
        assert "invalid custom code" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_create_url_with_expiration(self, client, auth_headers):
        """Can create URL with expiration date."""
        response = await client.post(
            "/api/urls",
            json={
                "original_url": "https://example.com/expiring",
                "expires_in_days": 7,
            },
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["expires_at"] is not None

    @pytest.mark.asyncio
    async def test_create_url_invalid_expiration(self, client, auth_headers):
        """Cannot create URL with invalid expiration."""
        response = await client.post(
            "/api/urls",
            json={
                "original_url": "https://example.com/test",
                "expires_in_days": 400,  # > 365
            },
            headers=auth_headers,
        )

        assert response.status_code == 422  
    @pytest.mark.asyncio
    async def test_create_url_invalid_url(self, client, auth_headers):
        """Cannot create URL with invalid original URL."""
        response = await client.post(
            "/api/urls",
            json={"original_url": "not-a-valid-url"},
            headers=auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="DB mock doesn't work with client fixture's dependency override")
    async def test_create_url_db_error(self, client, auth_headers):
        """API should return 500 if database commit fails."""
        with patch("app.routes.get_db") as mock_get_db:
            mock_session = AsyncMock()
            mock_session.commit.side_effect = Exception("DB Connection Lost")
            mock_get_db.return_value = iter([mock_session])

            response = await client.post(
                "/api/urls",
                json={"original_url": "https://example.com/fail"},
                headers=auth_headers,
            )

            assert response.status_code == 500

class TestGetURLInfoEndpoint:
    """Tests for GET /api/urls/{short_code} endpoint."""

    @pytest.mark.asyncio
    async def test_get_url_info(self, client, sample_url, auth_headers):
        """Can get URL info for existing URL."""
        with patch("app.routes.get_click_count", new_callable=AsyncMock) as mock_clicks:
            mock_clicks.return_value = 42

            response = await client.get(
                f"/api/urls/{sample_url.short_code}",
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["short_code"] == sample_url.short_code
        assert data["original_url"] == sample_url.original_url
        assert data["click_count"] == 42
        assert data["is_owner"] is True

    @pytest.mark.asyncio
    async def test_get_url_info_not_owner(self, client, sample_url, another_auth_headers):
        """Non-owner can see URL info but is_owner is False."""
        with patch("app.routes.get_click_count", new_callable=AsyncMock) as mock_clicks:
            mock_clicks.return_value = 10

            response = await client.get(
                f"/api/urls/{sample_url.short_code}",
                headers=another_auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["is_owner"] is False

    @pytest.mark.asyncio
    async def test_get_url_info_not_found(self, client, auth_headers):
        """Returns 404 for non-existent URL."""
        response = await client.get(
            "/api/urls/nonexist",
            headers=auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_url_info_expired(self, client, expired_url, auth_headers):
        """Returns 410 for expired URL."""
        response = await client.get(
            f"/api/urls/{expired_url.short_code}",
            headers=auth_headers,
        )

        assert response.status_code == 410
        assert "expired" in response.json()["detail"].lower()


class TestDeleteURLEndpoint:
    """Tests for DELETE /api/urls/{short_code} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_url_owner(self, client, sample_url, auth_headers):
        """Owner can delete their URL."""
        response = await client.delete(
            f"/api/urls/{sample_url.short_code}",
            headers=auth_headers,
        )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_url_not_owner(self, client, sample_url, another_auth_headers):
        """Non-owner cannot delete URL."""
        response = await client.delete(
            f"/api/urls/{sample_url.short_code}",
            headers=another_auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_url_not_authenticated(self, client, sample_url):
        """Unauthenticated user cannot delete URL."""
        response = await client.delete(f"/api/urls/{sample_url.short_code}")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_url_not_found(self, client, auth_headers):
        """Returns 404 when URL doesn't exist."""
        response = await client.delete(
            "/api/urls/nonexist",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestRedirectEndpoint:
    """Tests for GET /{short_code} redirect endpoint."""

    @pytest.mark.asyncio
    async def test_redirect_success(self, client, sample_url):
        """Redirect returns 307 to original URL."""
        with patch("app.routes.track_click", new_callable=AsyncMock):
            response = await client.get(
                f"/{sample_url.short_code}",
                follow_redirects=False,
            )

        assert response.status_code == 307
        assert response.headers["location"] == sample_url.original_url

    @pytest.mark.asyncio
    async def test_redirect_not_found(self, client):
        """Returns 404 for non-existent short code."""
        response = await client.get("/nonexist", follow_redirects=False)

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_redirect_expired_url(self, client, expired_url):
        """Returns 410 for expired URL."""
        response = await client.get(
            f"/{expired_url.short_code}",
            follow_redirects=False,
        )

        assert response.status_code == 410


class TestListURLsEndpoint:
    """Tests for GET /api/urls endpoint."""

    @pytest.mark.asyncio
    async def test_list_urls_authenticated(self, client, sample_url, auth_headers):
        """Authenticated user can list their URLs."""
        response = await client.get(
            "/api/urls",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert any(url["short_code"] == sample_url.short_code for url in data)

    @pytest.mark.asyncio
    async def test_list_urls_not_authenticated(self, client):
        """Unauthenticated user cannot list URLs."""
        response = await client.get("/api/urls")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_urls_pagination(self, client, auth_headers, sample_url):
        """Can paginate URL list."""
        response = await client.get(
            "/api/urls?skip=0&limit=10",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 10

    @pytest.mark.asyncio
    async def test_list_urls_empty(self, client, another_auth_headers):
        """Returns empty list for user with no URLs."""
        response = await client.get(
            "/api/urls",
            headers=another_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data == []


class TestClaimURLsEndpoint:
    """Tests for POST /api/urls/claim endpoint."""

    @pytest.mark.asyncio
    async def test_claim_guest_urls(self, client, guest_url, guest_claim_token, auth_headers):
        """Authenticated user can claim guest URLs."""
        response = await client.post(
            "/api/urls/claim",
            json={"claim_token": guest_claim_token},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["claimed"] >= 1
        assert "successfully claimed" in data["message"].lower()

    @pytest.mark.asyncio
    async def test_claim_urls_invalid_token(self, client, auth_headers):
        """Claiming with invalid token returns 0 claimed."""
        response = await client.post(
            "/api/urls/claim",
            json={"claim_token": "nonexistent-token"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["claimed"] == 0

    @pytest.mark.asyncio
    async def test_claim_urls_not_authenticated(self, client, guest_claim_token):
        """Unauthenticated user cannot claim URLs."""
        response = await client.post(
            "/api/urls/claim",
            json={"claim_token": guest_claim_token},
        )

        assert response.status_code == 401


class TestQRCodeEndpoint:
    """Tests for GET /api/urls/{short_code}/qr endpoint."""

    @pytest.mark.asyncio
    async def test_generate_qr_code(self, client, sample_url):
        """Can generate QR code for existing URL."""
        response = await client.get(f"/api/urls/{sample_url.short_code}/qr")

        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"

    @pytest.mark.asyncio
    async def test_qr_code_custom_size(self, client, sample_url):
        """Can generate QR code with custom size."""
        response = await client.get(f"/api/urls/{sample_url.short_code}/qr?size=300")

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_qr_code_invalid_size(self, client, sample_url):
        """Returns 400 for invalid QR code size."""
        response = await client.get(f"/api/urls/{sample_url.short_code}/qr?size=50")

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_qr_code_not_found(self, client):
        """Returns 404 for non-existent URL."""
        response = await client.get("/api/urls/nonexist/qr")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_qr_code_expired_url(self, client, expired_url):
        """Returns 410 for expired URL."""
        response = await client.get(f"/api/urls/{expired_url.short_code}/qr")

        assert response.status_code == 410


class TestAuthenticationErrors:
    """Tests for authentication error handling."""

    @pytest.mark.asyncio
    async def test_expired_token(self, client, expired_token):
        """Expired token returns 401."""
        response = await client.get(
            "/api/urls",
            headers={"Authorization": f"Bearer {expired_token}"},
        )

        assert response.status_code == 401
        assert "expired" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_invalid_token(self, client, invalid_token):
        """Invalid token returns 401."""
        response = await client.get(
            "/api/urls",
            headers={"Authorization": f"Bearer {invalid_token}"},
        )

        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_malformed_auth_header(self, client):
        """Malformed auth header returns 401."""
        response = await client.get(
            "/api/urls",
            headers={"Authorization": "NotBearer token"},
        )
        assert response.status_code == 401


class TestMetricsEndpoint:
    """Tests for /metrics endpoint."""

    @pytest.mark.asyncio
    async def test_metrics_endpoint(self, client):
        """Metrics endpoint returns Prometheus metrics."""
        response = await client.get("/metrics")

        assert response.status_code == 200
        assert "text/plain" in response.headers["content-type"] or \
               "text/plain; version=0.0.4" in response.headers.get("content-type", "")
