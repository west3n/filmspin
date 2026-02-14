from fastapi.testclient import TestClient

from src.app.main import app


def test_config_endpoint_shape():
    client = TestClient(app)
    response = client.get("/api/config")
    assert response.status_code == 200
    payload = response.json()
    assert "ru_enabled" in payload
    assert isinstance(payload["ru_enabled"], bool)


def test_metrics_endpoint_shape():
    client = TestClient(app)
    client.get("/api/config")
    response = client.get("/api/metrics")
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload.get("requests_total"), int)
    assert isinstance(payload.get("by_path"), dict)
    assert isinstance(payload.get("by_status"), dict)
    assert isinstance(payload.get("avg_ms_by_path"), dict)
