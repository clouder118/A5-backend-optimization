from pathlib import Path
import time

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app

SOURCE_PACKAGE_PATH = (
    Path(__file__).resolve().parents[2] / "Scenic Area Public Information Package"
)


def test_chat_returns_pending_tts_job_without_waiting_for_audio(tmp_path):
    app = create_app(
        Settings(
            database_url=f"sqlite:///{tmp_path / 'app.db'}",
            source_package_path=str(SOURCE_PACKAGE_PATH),
            llm_mode="fallback",
            tts_mode="provider",
            tts_provider="fake",
            tts_api_key="fake-key",
            tts_audio_format="mp3",
            tts_output_dir=str(tmp_path / "tts"),
        )
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/chat",
            json={
                "question": "灵山大佛适合拍照吗？",
                "spot_id": "spot_ling_shan_buddha",
            },
        )
        body = response.json()

    assert response.status_code == 200
    assert "灵山大佛" in body["answer"]
    assert body["tts_status"] == "pending"
    assert body["audio_url"] is None
    assert body["tts_job_id"]
    assert body["metrics"]["tts_ms"] < 50


def test_tts_job_status_returns_audio_url_when_ready(tmp_path):
    app = create_app(
        Settings(
            database_url=f"sqlite:///{tmp_path / 'app.db'}",
            source_package_path=str(SOURCE_PACKAGE_PATH),
            llm_mode="fallback",
            tts_mode="provider",
            tts_provider="fake",
            tts_api_key="fake-key",
            tts_audio_format="mp3",
            tts_output_dir=str(tmp_path / "tts"),
        )
    )

    with TestClient(app) as client:
        chat = client.post(
            "/api/chat",
            json={
                "question": "灵山大佛适合拍照吗？",
                "spot_id": "spot_ling_shan_buddha",
            },
        ).json()

        status = None
        for _ in range(20):
            status = client.get(f"/api/tts/jobs/{chat['tts_job_id']}").json()
            if status["status"] == "ready":
                break
            time.sleep(0.01)

        audio_response = client.get(status["audio_url"])

    assert status["id"] == chat["tts_job_id"]
    assert status["status"] == "ready"
    assert status["audio_url"].startswith("/static/tts/")
    assert audio_response.status_code == 200
    assert audio_response.content == b"fake-tts-audio"


def test_chat_returns_text_when_tts_provider_has_no_key(tmp_path):
    app = create_app(
        Settings(
            database_url=f"sqlite:///{tmp_path / 'app.db'}",
            source_package_path=str(SOURCE_PACKAGE_PATH),
            llm_mode="fallback",
            tts_mode="provider",
            tts_provider="mimo",
            tts_api_key="",
            tts_output_dir=str(tmp_path / "tts"),
        )
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/chat",
            json={
                "question": "梵宫有什么特色？",
                "spot_id": "spot_brahma_palace",
            },
        )

    body = response.json()
    assert response.status_code == 200
    assert "梵宫" in body["answer"]
    assert body["sources"]
    assert body["audio_url"] is None
    assert body["tts_status"] == "failed"
