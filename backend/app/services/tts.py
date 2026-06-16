from __future__ import annotations

import hashlib
from pathlib import Path

from app.core.config import Settings
from app.services.mimo import MimoClient


def synthesize_answer_audio(settings: Settings, answer: str) -> tuple[str | None, str]:
    if settings.tts_mode == "disabled":
        return None, "disabled"
    if not settings.tts_api_key:
        return None, "failed"

    try:
        audio_bytes = _synthesize_provider_audio(settings, answer)
        file_name = _audio_file_name(answer, settings.tts_audio_format)
        output_path = Path(settings.tts_output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        (output_path / file_name).write_bytes(audio_bytes)
        return f"/static/tts/{file_name}", "ready"
    except Exception:
        return None, "failed"


def _synthesize_provider_audio(settings: Settings, answer: str) -> bytes:
    if settings.tts_provider == "fake":
        return b"fake-tts-audio"

    client = MimoClient(settings.tts_base_url, settings.tts_api_key)
    return client.synthesize_speech(
        model=settings.tts_model,
        text=answer,
        voice=settings.tts_voice,
        audio_format=settings.tts_audio_format,
    )


def _audio_file_name(answer: str, audio_format: str) -> str:
    digest = hashlib.sha256(answer.encode("utf-8")).hexdigest()[:24]
    extension = "wav" if audio_format == "wav" else audio_format
    return f"{digest}.{extension}"
