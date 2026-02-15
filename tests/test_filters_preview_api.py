import httpx
import pytest

from src.app import dependencies
from src.app.main import app


class _FakeRandomService:
    async def preview_en(
        self,
        *,
        year_from,
        year_to,
        genres,
        vote_avg_min,
        country,
        lang,
    ):
        return {
            "estimated_total": 77,
            "low_results": False,
            "unavailable": False,
        }

    async def preview_ru(
        self,
        *,
        year_from,
        year_to,
        genres,
        vote_avg_min,
        country,
    ):
        return {
            "estimated_total": 5,
            "low_results": True,
            "unavailable": False,
        }


async def _fake_get_random_service():
    return _FakeRandomService()


@pytest.mark.anyio
async def test_filters_preview_endpoint_shape():
    app.dependency_overrides[dependencies.get_random_service] = _fake_get_random_service
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/filters_preview?year_from=2000&year_to=2010")
            assert response.status_code == 200
            payload = response.json()
            assert payload["estimated_total"] == 77
            assert payload["low_results"] is False
            assert payload["unavailable"] is False
    finally:
        app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_filters_preview_ru_endpoint_shape(monkeypatch):
    monkeypatch.setattr(dependencies, "RU_ENABLED", True)
    app.dependency_overrides[dependencies.get_random_service] = _fake_get_random_service
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/filters_preview_ru?year_from=2000&year_to=2010")
            assert response.status_code == 200
            payload = response.json()
            assert payload["estimated_total"] == 5
            assert payload["low_results"] is True
            assert payload["unavailable"] is False
    finally:
        app.dependency_overrides.clear()
