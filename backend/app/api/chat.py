from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, optional_visitor
from app.schemas import ChatRequest, ChatResponse
from app.services.auth import AuthUser
from app.services.chat import answer_chat, stream_chat_events

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat(
    chat_request: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    visitor: AuthUser | None = Depends(optional_visitor),
) -> ChatResponse:
    return answer_chat(
        db,
        request.app.state.settings,
        chat_request,
        request.app.state.tts_jobs,
        visitor_id=visitor.id if visitor else None,
    )


@router.post("/stream")
def stream_chat(
    chat_request: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    visitor: AuthUser | None = Depends(optional_visitor),
) -> StreamingResponse:
    return StreamingResponse(
        stream_chat_events(
            db,
            request.app.state.settings,
            chat_request,
            request.app.state.tts_jobs,
            visitor_id=visitor.id if visitor else None,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
