from fastapi import APIRouter, Request

from app.core.errors import ApiError
from app.schemas import TtsJobResponse

router = APIRouter(prefix="/api/tts", tags=["tts"])


@router.get("/jobs/{job_id}", response_model=TtsJobResponse)
def get_tts_job(job_id: str, request: Request) -> TtsJobResponse:
    job = request.app.state.tts_jobs.get(job_id)
    if job is None:
        raise ApiError("语音任务不存在", "TTS_JOB_NOT_FOUND", 404)
    return TtsJobResponse(id=job.id, status=job.status, audio_url=job.audio_url)
