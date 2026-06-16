from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app

SOURCE_PACKAGE_PATH = (
    Path(__file__).resolve().parents[2] / "Scenic Area Public Information Package"
)


def create_test_client(tmp_path):
    db_path = tmp_path / "app.db"
    app = create_app(
        Settings(
            database_url=f"sqlite:///{db_path}",
            source_package_path=str(SOURCE_PACKAGE_PATH),
        )
    )
    return TestClient(app)


def test_get_spots_returns_seeded_ling_shan_spots(tmp_path):
    with create_test_client(tmp_path) as client:
        response = client.get("/api/spots")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 22
    assert {
        "id": "spot_ling_shan_buddha",
        "name": "灵山大佛",
        "tags": ["佛教文化"],
        "summary": "灵山大佛位于祥符禅寺北侧，秦履峰南侧，矗立在景区最高处，是整个灵山胜境的核心地标，可俯瞰整个景区及太湖风光。",
        "visit_minutes": 45,
        "image_url": "",
    } in body["items"]
    assert any(item["id"] == "spot_nh_001" and item["name"] == "拈花广场" for item in body["items"])
    assert body["items"][-1]["name"] == "鹿鸣谷"


def test_get_spot_summary_counts_derived_ling_shan_spot_docs(tmp_path):
    with create_test_client(tmp_path) as client:
        response = client.get("/api/spots/summary")

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "listed_spot_count": 22,
        "collected_spot_count": 22,
    }


def test_get_spot_detail_returns_story_and_crowd_types(tmp_path):
    with create_test_client(tmp_path) as client:
        response = client.get("/api/spots/spot_brahma_palace")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "spot_brahma_palace"
    assert body["name"] == "灵山梵宫"
    assert "东方卢浮宫" in body["story"]
    assert "佛教文化" in body["tags"]
    assert body["visit_minutes"] == 45
    assert {"历史文化游", "摄影游", "轻松游"}.issubset(body["crowd_types"])


def test_get_spot_detail_returns_unified_not_found_error(tmp_path):
    with create_test_client(tmp_path) as client:
        response = client.get("/api/spots/missing-spot")

    assert response.status_code == 404
    assert response.json() == {
        "message": "景点不存在",
        "code": "SPOT_NOT_FOUND",
        "status": 404,
    }


def test_recommend_routes_returns_explainable_rule_based_routes(tmp_path):
    with create_test_client(tmp_path) as client:
        response = client.post(
            "/api/routes/recommend",
            json={
                "visitor_type": "历史文化游",
                "duration_minutes": 180,
                "physical_level": "中",
                "interest_tags": ["佛教文化", "建筑"],
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert 1 <= len(body["items"]) <= 3
    first_route = body["items"][0]
    assert first_route["id"] == "route_culture_deep"
    assert first_route["total_minutes"] == 180
    assert first_route["recommendation_reason"]
    assert len(first_route["spots"]) >= 3
    assert first_route["spots"][0] == {
        "id": "spot_ling_shan_buddha",
        "name": "灵山大佛",
        "stay_minutes": 45,
        "reason": "从核心地标理解景区主题。",
    }
