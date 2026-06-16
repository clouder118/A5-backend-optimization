from app.models import KnowledgeChunk, KnowledgeDoc, utc_now
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin

router = APIRouter(
    prefix="/api/knowledge",
    tags=["knowledge"],
    dependencies=[Depends(require_admin)],
)


@router.get("/docs")
def list_knowledge_docs(db: Session = Depends(get_db)) -> dict:
    rows = db.execute(
        select(KnowledgeDoc, func.count(KnowledgeChunk.id))
        .outerjoin(KnowledgeChunk, KnowledgeChunk.doc_id == KnowledgeDoc.id)
        .group_by(KnowledgeDoc.id)
        .order_by(KnowledgeDoc.id)
    ).all()
    items = [
        {
            "id": doc.id,
            "title": doc.title,
            "source_type": doc.source_type,
            "path": doc.path,
            "chunk_count": chunk_count,
            "indexed": doc.indexed_at is not None,
        }
        for doc, chunk_count in rows
    ]
    return {"items": items, "total": len(items)}


@router.post("/rebuild")
def rebuild_knowledge_index(db: Session = Depends(get_db)) -> dict:
    now = utc_now()
    docs = db.scalars(select(KnowledgeDoc)).all()
    for doc in docs:
        doc.indexed_at = now
    chunk_count = db.scalar(select(func.count(KnowledgeChunk.id))) or 0
    db.commit()
    return {
        "status": "rebuilt",
        "doc_count": len(docs),
        "chunk_count": chunk_count,
    }
