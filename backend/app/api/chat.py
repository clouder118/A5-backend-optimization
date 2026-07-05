from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas import ChatRequest, ChatResponse
from app.services.chat import answer_chat, stream_chat_events

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat(
    chat_request: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> ChatResponse:
    return answer_chat(
        db,
        request.app.state.settings,
        chat_request,
        request.app.state.tts_jobs,
    )


@router.post("/stream")
def stream_chat(
    chat_request: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    return StreamingResponse(
        stream_chat_events(
            db,
            request.app.state.settings,
            chat_request,
            request.app.state.tts_jobs,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
