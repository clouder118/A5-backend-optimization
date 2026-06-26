from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app

SOURCE_PACKAGE_PATH = (
    Path(__file__).resolve().parents[2] / "Scenic Area Public Information Package"
)


def create_test_client(tmp_path):
    app = create_app(
        Settings(
            database_url=f"sqlite:///{tmp_path / 'app.db'}",
            source_package_path=str(SOURCE_PACKAGE_PATH),
            llm_api_key="",
            tts_mode="disabled",
        )
    )
    return TestClient(app)


def admin_headers(client):
    response = client.post(
        "/api/auth/admin/login",
        json={"username": "admin", "password": "123456"},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_chat_logs_return_sources_and_session_profile(tmp_path):
    with create_test_client(tmp_path) as client:
        chat_response = client.post(
            "/api/chat",
            json={
                "question": "Ling Shan Buddha highlights?",
                "spot_id": "spot_ling_shan_buddha",
                "profile": {
                    "visitor_type": "culture",
                    "preference": "history and photo spots",
                },
            },
        )
        logs_response = client.get("/api/logs/chats", headers=admin_headers(client))

    assert chat_response.status_code == 200
    assert logs_response.status_code == 200
    item = logs_response.json()["items"][0]
    assert item["sources"]
    assert item["source_count"] == len(item["sources"])
    assert item["visitor_type"] == "culture"
    assert item["preference"] == "history and photo spots"


def test_admin_dashboard_returns_p1_operational_summary(tmp_path):
    with create_test_client(tmp_path) as client:
        client.post(
            "/api/chat",
            json={
                "question": "Ling Shan Buddha highlights?",
                "spot_id": "spot_ling_shan_buddha",
                "profile": {"visitor_type": "family"},
            },
        )
        response = client.get("/api/admin/dashboard", headers=admin_headers(client))

    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["total_questions"] == 1
    assert body["summary"]["today_questions"] == 1
    assert body["summary"]["spot_count"] > 0
    assert body["summary"]["route_count"] > 0
    assert body["summary"]["knowledge_doc_count"] >= 0
    assert body["qa_trend"]
    assert body["top_questions"][0]["count"] == 1
    assert body["preference_distribution"][0]["label"] == "family"
    assert body["recent_logs"][0]["source_count"] >= 0
    assert body["behavior_summary"]["record_count"] > 100000
    assert body["behavior_summary"]["attraction_type_distribution"]
    assert body["behavior_summary"]["insights"]
