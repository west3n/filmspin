import pytest
import httpx

from src.app.main import app


@pytest.mark.anyio
async def test_config_endpoint_shape():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/config")
        assert response.status_code == 200
        payload = response.json()
        assert "ru_enabled" in payload
        assert isinstance(payload["ru_enabled"], bool)


@pytest.mark.anyio
async def test_metrics_endpoint_shape():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await client.get("/api/config")
        response = await client.get("/api/metrics")
        assert response.status_code == 200
        payload = response.json()
        assert isinstance(payload.get("requests_total"), int)
        assert isinstance(payload.get("by_path"), dict)
        assert isinstance(payload.get("by_status"), dict)
        assert isinstance(payload.get("avg_ms_by_path"), dict)
