from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.models import ChatMessage, ChatSession
from app.schemas import ChatLogDeleteRequest

router = APIRouter(
    prefix="/api/logs",
    tags=["logs"],
    dependencies=[Depends(require_admin)],
)


@router.get("/chats")
def list_chat_logs(db: Session = Depends(get_db)) -> dict:
    rows = db.execute(
        select(ChatMessage, ChatSession)
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
    ).all()
    items = [
        {
            "id": message.id,
            "session_id": message.session_id,
            "question": message.question,
            "answer": message.answer,
            "sources": message.sources_json or [],
            "source_count": len(message.sources_json or []),
            "visitor_type": session.visitor_type,
            "preference": session.preference,
            "metrics": message.metrics_json or {},
            "created_at": message.created_at.isoformat(),
        }
        for message, session in rows
    ]
    return {"items": items, "total": len(items)}


@router.post("/chats/delete")
def delete_chat_logs(
    payload: ChatLogDeleteRequest,
    db: Session = Depends(get_db),
) -> dict:
    if payload.delete_all:
        result = db.execute(delete(ChatMessage))
    else:
        ids = sorted(set(payload.ids))
        if not ids:
            raise HTTPException(status_code=400, detail="ids 不能为空")
        result = db.execute(delete(ChatMessage).where(ChatMessage.id.in_(ids)))
    db.commit()
    return {"status": "deleted", "deleted_count": result.rowcount or 0}


@router.delete("/chats/{chat_id}")
def delete_chat_log(chat_id: int, db: Session = Depends(get_db)) -> dict:
    result = db.execute(delete(ChatMessage).where(ChatMessage.id == chat_id))
    db.commit()
    if not result.rowcount:
        raise HTTPException(status_code=404, detail="问答日志不存在")
    return {"status": "deleted", "deleted_count": 1}
