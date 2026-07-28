from html import unescape
import hashlib
from io import BytesIO
from pathlib import Path
import re
from uuid import uuid4
import xml.etree.ElementTree as ET
import zipfile

from app.core.config import BACKEND_ROOT
from app.core.errors import ApiError
from app.models import (
    KnowledgeChunk,
    KnowledgeChunkEmbedding,
    KnowledgeDoc,
    KnowledgeDocTombstone,
    utc_now,
)
from app.services.rag import clear_retrieval_cache
from app.services.rag_index import rebuild_knowledge_fts_index
from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin

router = APIRouter(
    prefix="/api/knowledge",
    tags=["knowledge"],
    dependencies=[Depends(require_admin)],
)

UPLOAD_DIR = BACKEND_ROOT / "data" / "knowledge_uploads"
SUPPORTED_UPLOAD_SUFFIXES = {".md", ".markdown", ".txt", ".docx"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
CHUNK_SIZE = 700
CHUNK_OVERLAP = 100


def _knowledge_doc_payload(doc: KnowledgeDoc, chunk_count: int) -> dict:
    return {
        "id": doc.id,
        "title": doc.title,
        "source_type": doc.source_type,
        "path": doc.path,
        "chunk_count": chunk_count,
        "indexed": doc.indexed_at is not None,
    }


@router.get("/docs")
def list_knowledge_docs(db: Session = Depends(get_db)) -> dict:
    rows = db.execute(
        select(KnowledgeDoc, func.count(KnowledgeChunk.id))
        .outerjoin(KnowledgeChunk, KnowledgeChunk.doc_id == KnowledgeDoc.id)
        .group_by(KnowledgeDoc.id)
        .order_by(KnowledgeDoc.id)
    ).all()
    items = [_knowledge_doc_payload(doc, chunk_count) for doc, chunk_count in rows]
    return {"items": items, "total": len(items)}


@router.post("/docs")
async def upload_knowledge_doc(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    filename = Path(file.filename or "").name
    if not filename:
        raise ApiError("请选择要上传的知识文档", "KNOWLEDGE_UPLOAD_EMPTY_FILENAME", 400)

    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED_UPLOAD_SUFFIXES:
        raise ApiError(
            "暂只支持上传 .md、.txt、.docx 文档",
            "KNOWLEDGE_UPLOAD_UNSUPPORTED_TYPE",
            400,
        )

    content = await file.read()
    if not content:
        raise ApiError("上传文档内容为空", "KNOWLEDGE_UPLOAD_EMPTY_CONTENT", 400)
    if len(content) > MAX_UPLOAD_BYTES:
        raise ApiError("上传文档不能超过 10MB", "KNOWLEDGE_UPLOAD_TOO_LARGE", 400)

    text = _extract_upload_text(content, suffix)
    if not text.strip():
        raise ApiError("未能从文档中解析出有效文本", "KNOWLEDGE_UPLOAD_NO_TEXT", 400)

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored_path = UPLOAD_DIR / _stored_upload_filename(filename)
    stored_path.write_bytes(content)

    now = utc_now()
    chunks = _chunk_text(text)
    content_hash = hashlib.sha256(content).hexdigest()
    doc = KnowledgeDoc(
        id=_unique_doc_id(db, filename, content_hash),
        title=Path(filename).stem,
        source_type=suffix.removeprefix(".") or "file",
        path=_relative_backend_path(stored_path),
        content_hash=content_hash,
        created_at=now,
        indexed_at=now,
    )
    db.add(doc)
    for index, chunk_text in enumerate(chunks):
        db.add(
            KnowledgeChunk(
                doc_id=doc.id,
                chunk_text=chunk_text,
                chunk_index=index,
            )
        )
    rebuild_knowledge_fts_index(db)
    clear_retrieval_cache()
    db.commit()
    db.refresh(doc)
    return _knowledge_doc_payload(doc, len(chunks))


@router.delete("/docs/{doc_id}")
def delete_knowledge_doc(doc_id: str, db: Session = Depends(get_db)) -> dict:
    doc = db.get(KnowledgeDoc, doc_id)
    if doc is None:
        raise ApiError("知识文档不存在", "KNOWLEDGE_DOC_NOT_FOUND", 404)

    chunk_ids = db.scalars(
        select(KnowledgeChunk.id).where(KnowledgeChunk.doc_id == doc_id)
    ).all()
    if chunk_ids:
        db.execute(
            delete(KnowledgeChunkEmbedding).where(
                KnowledgeChunkEmbedding.chunk_id.in_(chunk_ids)
            )
        )
    db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.doc_id == doc_id))
    upload_file = _uploaded_file_path(doc.path)
    if upload_file is None:
        _record_knowledge_doc_tombstone(db, doc)
    db.delete(doc)
    rebuild_knowledge_fts_index(db)
    clear_retrieval_cache()
    db.commit()
    if upload_file is not None and upload_file.exists():
        upload_file.unlink()
    return {"status": "deleted", "deleted_id": doc_id}


@router.post("/rebuild")
def rebuild_knowledge_index(db: Session = Depends(get_db)) -> dict:
    now = utc_now()
    docs = db.scalars(select(KnowledgeDoc)).all()
    for doc in docs:
        doc.indexed_at = now
    chunk_count = db.scalar(select(func.count(KnowledgeChunk.id))) or 0
    rebuild_knowledge_fts_index(db)
    clear_retrieval_cache()
    db.commit()
    return {
        "status": "rebuilt",
        "doc_count": len(docs),
        "chunk_count": chunk_count,
    }


def _extract_upload_text(content: bytes, suffix: str) -> str:
    if suffix == ".docx":
        return _extract_docx_text(content)
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return content.decode("gb18030", errors="ignore")


def _extract_docx_text(content: bytes) -> str:
    try:
        with zipfile.ZipFile(BytesIO(content)) as archive:
            document_xml = archive.read("word/document.xml")
    except Exception as exc:
        raise ApiError("Word 文档解析失败，请确认文件未损坏", "KNOWLEDGE_DOCX_PARSE_FAILED", 400) from exc

    try:
        root = ET.fromstring(document_xml)
    except ET.ParseError as exc:
        raise ApiError("Word 文档结构解析失败", "KNOWLEDGE_DOCX_XML_INVALID", 400) from exc

    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs: list[str] = []
    for paragraph in root.findall(".//w:p", namespace):
        text = "".join(
            node.text or ""
            for node in paragraph.findall(".//w:t", namespace)
            if node.text
        ).strip()
        if text:
            paragraphs.append(text)
    return "\n".join(paragraphs)


def _chunk_text(text: str) -> list[str]:
    normalized = re.sub(r"\n{3,}", "\n\n", unescape(text)).strip()
    if len(normalized) <= CHUNK_SIZE:
        return [normalized]

    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(len(normalized), start + CHUNK_SIZE)
        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(normalized):
            break
        start = max(0, end - CHUNK_OVERLAP)
    return chunks


def _stored_upload_filename(filename: str) -> str:
    stem = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff._-]+", "_", Path(filename).stem).strip("._")
    if not stem:
        stem = "knowledge"
    suffix = Path(filename).suffix.lower()
    return f"{utc_now().strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:8]}-{stem}{suffix}"


def _unique_doc_id(db: Session, filename: str, content_hash: str) -> str:
    stem = re.sub(r"[^0-9A-Za-z_-]+", "_", Path(filename).stem.lower()).strip("_")
    if not stem:
        stem = "doc"
    base_id = f"uploaded_{stem}_{content_hash[:8]}"[:60]
    doc_id = base_id
    counter = 2
    while db.get(KnowledgeDoc, doc_id) is not None:
        suffix = f"_{counter}"
        doc_id = f"{base_id[:64 - len(suffix)]}{suffix}"
        counter += 1
    return doc_id


def _relative_backend_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(BACKEND_ROOT.resolve())).replace("\\", "/")
    except ValueError:
        return str(path)


def _uploaded_file_path(path_value: str) -> Path | None:
    try:
        path = (BACKEND_ROOT / path_value).resolve()
        upload_root = UPLOAD_DIR.resolve()
    except OSError:
        return None
    if path == upload_root or upload_root not in path.parents:
        return None
    return path


def _record_knowledge_doc_tombstone(db: Session, doc: KnowledgeDoc) -> None:
    tombstone = db.get(KnowledgeDocTombstone, doc.id)
    if tombstone is None:
        tombstone = KnowledgeDocTombstone(doc_id=doc.id)
        db.add(tombstone)
    tombstone.title = doc.title
    tombstone.path = doc.path
    tombstone.deleted_at = utc_now()
