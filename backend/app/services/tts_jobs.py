from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from threading import Lock
from uuid import uuid4

from app.core.config import Settings
from app.services.tts import synthesize_answer_audio


@dataclass
class TtsJob:
    id: str
    status: str
    audio_url: str | None = None


class TtsJobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, TtsJob] = {}
        self._lock = Lock()
        self._executor = ThreadPoolExecutor(max_workers=2)

    def enqueue(self, settings: Settings, answer: str) -> TtsJob:
        job = TtsJob(id=f"tts_{uuid4().hex}", status="pending")
        with self._lock:
            self._jobs[job.id] = job
        self._executor.submit(self._run, job.id, settings, answer)
        return job

    def get(self, job_id: str) -> TtsJob | None:
        with self._lock:
            return self._jobs.get(job_id)

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)

    def _run(self, job_id: str, settings: Settings, answer: str) -> None:
        audio_url, status = synthesize_answer_audio(settings, answer)
        with self._lock:
            self._jobs[job_id] = TtsJob(
                id=job_id,
                status=status,
                audio_url=audio_url,
            )
