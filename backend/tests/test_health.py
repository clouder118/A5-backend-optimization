from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint_reports_service_status():
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "a5-ai-guide-backend",
    }


def test_swagger_docs_are_available():
    client = TestClient(app)

    response = client.get("/docs")

    assert response.status_code == 200
    assert "swagger-ui" in response.text
