import httpx
import pytest

import src.app.clients.omdb_client as omdb_module
from src.app.clients.omdb_client import OmdbClient


@pytest.mark.anyio
async def test_omdb_rotates_to_second_key_when_primary_limit_reached(monkeypatch):
    seen_keys: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        key = str(request.url.params.get("apikey") or "")
        seen_keys.append(key)
        if key == "key_primary":
            return httpx.Response(
                status_code=200,
                json={"Response": "False", "Error": "Request limit reached!"},
            )
        return httpx.Response(
            status_code=200,
            json={"Response": "True", "imdbRating": "8.1", "imdbVotes": "12,345"},
        )

    monkeypatch.setattr(omdb_module, "OMDB_BASE", "http://omdb.test/")
    monkeypatch.setattr(omdb_module, "OMDB_API_KEYS", ("key_primary", "key_backup"))
    monkeypatch.setattr(omdb_module, "OMDB_MOCK_ENABLED", False)
    transport = httpx.MockTransport(handler)

    async with httpx.AsyncClient(transport=transport, base_url="http://omdb.test") as client:
        omdb = OmdbClient(client)
        payload = await omdb.rating("tt0365748")

    assert payload == {"imdb_rating": 8.1, "imdb_votes": 12345}
    assert seen_keys == ["key_primary", "key_backup"]


@pytest.mark.anyio
async def test_omdb_does_not_rotate_on_regular_movie_miss(monkeypatch):
    seen_keys: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        key = str(request.url.params.get("apikey") or "")
        seen_keys.append(key)
        return httpx.Response(
            status_code=200,
            json={"Response": "False", "Error": "Movie not found!"},
        )

    monkeypatch.setattr(omdb_module, "OMDB_BASE", "http://omdb.test/")
    monkeypatch.setattr(omdb_module, "OMDB_API_KEYS", ("key_primary", "key_backup"))
    monkeypatch.setattr(omdb_module, "OMDB_MOCK_ENABLED", False)
    transport = httpx.MockTransport(handler)

    async with httpx.AsyncClient(transport=transport, base_url="http://omdb.test") as client:
        omdb = OmdbClient(client)
        payload = await omdb.rating("tt0365748")

    assert payload is None
    assert seen_keys == ["key_primary"]


@pytest.mark.anyio
async def test_omdb_returns_mock_payload_without_http_when_enabled(monkeypatch):
    def handler(_: httpx.Request) -> httpx.Response:
        raise AssertionError("HTTP should not be called when OMDB mock is enabled")

    monkeypatch.setattr(omdb_module, "OMDB_MOCK_ENABLED", True)
    monkeypatch.setattr(omdb_module, "OMDB_API_KEYS", ("key_primary",))
    transport = httpx.MockTransport(handler)

    async with httpx.AsyncClient(transport=transport, base_url="http://omdb.test") as client:
        omdb = OmdbClient(client)
        payload_1 = await omdb.rating("tt0365748")
        payload_2 = await omdb.rating("tt0365748")

    assert payload_1 == payload_2
    assert payload_1 is not None
    assert isinstance(payload_1["imdb_rating"], float)
    assert isinstance(payload_1["imdb_votes"], int)
