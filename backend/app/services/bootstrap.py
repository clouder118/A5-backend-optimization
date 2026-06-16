from __future__ import annotations

import hashlib
import json
from pathlib import Path
import zipfile
import xml.etree.ElementTree as ET

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import (
    ApprovedWebSource,
    ApprovedWebFact,
    EntityAlias,
    KnowledgeChunk,
    KnowledgeDoc,
    Route,
    RouteSpot,
    ScenicSpot,
    SourceRef,
    SpotFact,
    TagAlias,
)


LING_SHAN_SPOTS = [
    {
        "id": "spot_ling_shan_buddha",
        "name": "灵山大佛",
        "summary": "灵山胜境的核心地标，适合礼佛、文化讲解和远景拍摄。",
        "story": "灵山大佛是景区最具代表性的景点，适合围绕佛教文化、造像艺术和祈福体验展开讲解。",
        "tags": ["佛教文化", "地标", "摄影"],
        "visit_minutes": 40,
        "crowd_types": ["历史文化游", "摄影游", "轻松游"],
        "image_url": "",
        "sort_order": 10,
    },
    {
        "id": "spot_nine_dragons",
        "name": "九龙灌浴",
        "summary": "以动态演艺呈现佛教故事，是亲子游客容易理解的互动景点。",
        "story": "九龙灌浴适合用故事化方式介绍佛教传说和景区仪式感。",
        "tags": ["演艺", "亲子", "佛教文化"],
        "visit_minutes": 25,
        "crowd_types": ["亲子游", "历史文化游"],
        "image_url": "",
        "sort_order": 20,
    },
    {
        "id": "spot_brahma_palace",
        "name": "梵宫",
        "summary": "融合建筑、艺术和文化展示的室内核心景点。",
        "story": "梵宫适合讲解建筑空间、艺术装饰和佛教文化展示。",
        "tags": ["建筑", "艺术", "室内"],
        "visit_minutes": 45,
        "crowd_types": ["历史文化游", "摄影游", "轻松游"],
        "image_url": "",
        "sort_order": 30,
    },
    {
        "id": "spot_five_mudra_mandala",
        "name": "五印坛城",
        "summary": "适合深度文化游览的藏传佛教文化展示空间。",
        "story": "五印坛城可用于介绍坛城意象、文化符号和沉浸式参观体验。",
        "tags": ["藏传佛教", "文化", "室内"],
        "visit_minutes": 35,
        "crowd_types": ["历史文化游", "轻松游"],
        "image_url": "",
        "sort_order": 40,
    },
    {
        "id": "spot_xiangfu_temple",
        "name": "祥符禅寺",
        "summary": "景区中的禅寺空间，适合安静游览和文化讲解。",
        "story": "祥符禅寺适合讲解禅意空间、礼佛动线和静态游览体验。",
        "tags": ["禅寺", "礼佛", "安静"],
        "visit_minutes": 30,
        "crowd_types": ["历史文化游", "轻松游"],
        "image_url": "",
        "sort_order": 50,
    },
]

LING_SHAN_ROUTES = [
    {
        "id": "route_classic",
        "name": "灵山经典礼佛路线",
        "theme": "历史文化游",
        "duration_minutes": 150,
        "suitable_crowd": ["历史文化游", "轻松游"],
        "description": "覆盖灵山大佛、九龙灌浴和梵宫，适合第一次到访的游客。",
        "spots": [
            ("spot_nine_dragons", 25, "先用动态演艺进入灵山文化语境。"),
            ("spot_ling_shan_buddha", 45, "核心地标，适合礼佛和拍照。"),
            ("spot_brahma_palace", 45, "室内参观，补充建筑与艺术体验。"),
        ],
    },
    {
        "id": "route_culture_deep",
        "name": "灵山文化深度路线",
        "theme": "深度文化游",
        "duration_minutes": 180,
        "suitable_crowd": ["历史文化游", "摄影游"],
        "description": "串联核心文化空间，适合想深入了解佛教文化和建筑艺术的游客。",
        "spots": [
            ("spot_ling_shan_buddha", 45, "从核心地标理解景区主题。"),
            ("spot_brahma_palace", 50, "重点看建筑空间与艺术装饰。"),
            ("spot_five_mudra_mandala", 40, "补充坛城文化和沉浸式体验。"),
            ("spot_xiangfu_temple", 30, "以安静禅寺空间收束路线。"),
        ],
    },
]

_KNOWLEDGE_CHUNK_CACHE: dict[tuple[str, str], list[str]] = {}


def bootstrap_ling_shan_data(
    session: Session,
    source_package_path: str,
    derived_knowledge_path: str | None = None,
) -> None:
    derived_path = Path(derived_knowledge_path) if derived_knowledge_path else None
    has_curated_spots = bool(
        _read_json_list(derived_path / "curated" / "spots.json")
        if derived_path
        else []
    )
    existing_spot = session.scalar(select(ScenicSpot.id).limit(1))
    if existing_spot is None and not has_curated_spots:
        for spot_data in LING_SHAN_SPOTS:
            session.add(ScenicSpot(**spot_data))

    existing_route = session.scalar(select(Route.id).limit(1))
    if existing_route is None:
        for route_data in LING_SHAN_ROUTES:
            spots = route_data["spots"]
            route_fields = {
                key: value
                for key, value in route_data.items()
                if key != "spots"
            }
            session.add(Route(**route_fields))
            for sequence, (spot_id, stay_minutes, reason) in enumerate(spots, start=1):
                session.add(
                    RouteSpot(
                        route_id=route_fields["id"],
                        spot_id=spot_id,
                        sequence=sequence,
                        stay_minutes=stay_minutes,
                        reason=reason,
                    )
                )

    _import_knowledge_docs(session, Path(source_package_path))
    if derived_path:
        _import_curated_structured_data(session, derived_path)
        _import_derived_markdown_docs(session, derived_path)
    session.commit()


def _import_knowledge_docs(session: Session, source_package_path: Path) -> None:
    if not source_package_path.exists():
        return

    source_files = [
        file_path
        for file_path in sorted(source_package_path.iterdir())
        if file_path.is_file()
        and file_path.suffix.lower() == ".docx"
        and not file_path.name.startswith("~$")
    ]
    imported_doc_ids = {f"doc_{index:03d}" for index in range(1, len(source_files) + 1)}

    for index, file_path in enumerate(source_files, start=1):
        doc_id = f"doc_{index:03d}"
        title = file_path.stem
        content_hash = _file_hash(file_path)
        doc = session.get(KnowledgeDoc, doc_id)
        if doc is None:
            doc = KnowledgeDoc(
                id=doc_id,
                title=title,
                source_type=file_path.suffix.removeprefix(".").lower(),
                path=str(file_path),
                content_hash=content_hash,
            )
            session.add(doc)
            should_refresh = True
        else:
            should_refresh = (
                doc.content_hash != content_hash
                or doc.path != str(file_path)
                or _raw_doc_needs_refresh(session, doc_id)
            )
            doc.title = title
            doc.source_type = file_path.suffix.removeprefix(".").lower()
            doc.path = str(file_path)
            doc.content_hash = content_hash

        if not should_refresh:
            continue

        session.execute(delete(KnowledgeChunk).where(KnowledgeChunk.doc_id == doc_id))
        for chunk_index, chunk_text in enumerate(_knowledge_chunks(file_path)):
            session.add(
                KnowledgeChunk(
                    doc_id=doc_id,
                    chunk_text=chunk_text,
                    chunk_index=chunk_index,
                    spot_id=None,
                    vector_id=None,
                )
            )

    stale_docs = select(KnowledgeDoc.id).where(
        KnowledgeDoc.id.like("doc_%"),
        KnowledgeDoc.id.not_in(imported_doc_ids),
    )
    session.execute(delete(KnowledgeChunk).where(KnowledgeChunk.doc_id.in_(stale_docs)))
    session.execute(
        delete(KnowledgeDoc).where(
            KnowledgeDoc.id.like("doc_%"),
            KnowledgeDoc.id.not_in(imported_doc_ids),
        )
    )


def _raw_doc_needs_refresh(session: Session, doc_id: str) -> bool:
    chunk_count = session.scalar(
        select(func.count(KnowledgeChunk.id)).where(KnowledgeChunk.doc_id == doc_id)
    )
    if not chunk_count:
        return True
    first_chunk = session.scalar(
        select(KnowledgeChunk.chunk_text)
        .where(KnowledgeChunk.doc_id == doc_id)
        .order_by(KnowledgeChunk.chunk_index)
        .limit(1)
    )
    return bool(first_chunk and first_chunk.startswith("资料文件："))


def _knowledge_chunks(file_path: Path) -> list[str]:
    cache_key = (str(file_path), _file_hash(file_path))
    if cache_key in _KNOWLEDGE_CHUNK_CACHE:
        return _KNOWLEDGE_CHUNK_CACHE[cache_key]
    text = _extract_knowledge_text(file_path)
    chunks = _chunk_text(text, limit=1200) or [f"资料文件：{file_path.name}"]
    _KNOWLEDGE_CHUNK_CACHE[cache_key] = chunks
    return chunks


def _extract_knowledge_text(file_path: Path) -> str:
    suffix = file_path.suffix.lower()
    if suffix == ".md":
        return file_path.read_text(encoding="utf-8")
    if suffix == ".docx":
        return _extract_docx_text(file_path)
    return f"资料文件：{file_path.name}"


def _chunk_text(text: str, limit: int = 1200) -> list[str]:
    paragraphs = [paragraph.strip() for paragraph in text.splitlines() if paragraph.strip()]
    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        if not current:
            current = paragraph
            continue
        if len(current) + len(paragraph) + 1 <= limit:
            current = f"{current}\n{paragraph}"
            continue
        chunks.append(current)
        current = paragraph
    if current:
        chunks.append(current)
    return chunks


def _import_derived_markdown_docs(session: Session, derived_knowledge_path: Path) -> None:
    docs_path = derived_knowledge_path / "docs"
    if not docs_path.exists():
        return

    doc_files = sorted(docs_path.glob("*.md"))
    imported_doc_ids = {f"derived_doc_{index:03d}" for index in range(1, len(doc_files) + 1)}

    for index, file_path in enumerate(doc_files, start=1):
        doc_id = f"derived_doc_{index:03d}"
        content_hash = _file_hash(file_path)
        doc = session.get(KnowledgeDoc, doc_id)
        if doc is None:
            doc = KnowledgeDoc(
                id=doc_id,
                title=file_path.stem,
                source_type="md",
                path=str(file_path),
                content_hash=content_hash,
            )
            session.add(doc)
            should_refresh = True
        else:
            should_refresh = doc.content_hash != content_hash or doc.path != str(file_path)
            doc.title = file_path.stem
            doc.source_type = "md"
            doc.path = str(file_path)
            doc.content_hash = content_hash

        if not should_refresh:
            continue

        session.execute(delete(KnowledgeChunk).where(KnowledgeChunk.doc_id == doc_id))
        for chunk_index, chunk_text in enumerate(_knowledge_chunks(file_path)):
            session.add(
                KnowledgeChunk(
                    doc_id=doc_id,
                    chunk_text=chunk_text,
                    chunk_index=chunk_index,
                    spot_id=None,
                    vector_id=None,
                )
            )

    stale_docs = select(KnowledgeDoc.id).where(
        KnowledgeDoc.id.like("derived_doc_%"),
        KnowledgeDoc.id.not_in(imported_doc_ids),
    )
    session.execute(delete(KnowledgeChunk).where(KnowledgeChunk.doc_id.in_(stale_docs)))
    session.execute(
        delete(KnowledgeDoc).where(
            KnowledgeDoc.id.like("derived_doc_%"),
            KnowledgeDoc.id.not_in(imported_doc_ids),
        )
    )


def _import_curated_structured_data(session: Session, derived_knowledge_path: Path) -> None:
    curated_path = derived_knowledge_path / "curated"
    if not curated_path.exists():
        return

    for item in _read_json_list(curated_path / "source_refs.json"):
        if session.get(SourceRef, item["id"]):
            continue
        session.add(
            SourceRef(
                id=item["id"],
                title=item["title"],
                source_type=item["source_type"],
                path=item.get("path", ""),
            )
        )

    _import_curated_spots(session, curated_path)

    for item in _read_json_list(curated_path / "aliases.json"):
        for alias in item.get("aliases", []):
            existing = session.scalar(
                select(EntityAlias.id).where(
                    EntityAlias.entity_type == item["entity_type"],
                    EntityAlias.entity_id == item["entity_id"],
                    EntityAlias.alias == alias,
                )
            )
            if existing is not None:
                continue
            session.add(
                EntityAlias(
                    entity_type=item["entity_type"],
                    entity_id=item["entity_id"],
                    alias=alias,
                )
            )

    for item in _read_json_list(curated_path / "tags.json"):
        for alias in item.get("aliases", []):
            existing = session.scalar(
                select(TagAlias.id).where(
                    TagAlias.tag == item["tag"],
                    TagAlias.alias == alias,
                )
            )
            if existing is not None:
                continue
            session.add(
                TagAlias(
                    tag=item["tag"],
                    category=item.get("category", ""),
                    alias=alias,
                )
            )

    for item in _read_json_list(curated_path / "facts.json"):
        existing = session.scalar(
            select(SpotFact.id).where(
                SpotFact.spot_id == item["spot_id"],
                SpotFact.fact_key == item["fact_key"],
                SpotFact.source_ref == item.get("source_ref", ""),
                SpotFact.source_url == item.get("source_url", ""),
            )
        )
        if existing is not None:
            continue
        session.add(
            SpotFact(
                spot_id=item["spot_id"],
                fact_key=item["fact_key"],
                fact_label=item["fact_label"],
                fact_value=str(item["fact_value"]),
                fact_unit=item.get("fact_unit", ""),
                confidence=float(item.get("confidence", 1.0)),
                source_type=item.get("source_type", "database"),
                source_ref=item.get("source_ref", ""),
                source_url=item.get("source_url", ""),
            )
        )

    for item in _read_json_list(curated_path / "approved_web_sources.json"):
        existing = session.scalar(
            select(ApprovedWebSource).where(
                ApprovedWebSource.domain == item["domain"],
            )
        )
        if existing is not None:
            existing.title = item.get("title", "")
            existing.source_level = item.get("source_level", "")
            existing.allowed = bool(item.get("allowed", True))
            continue
        session.add(
            ApprovedWebSource(
                domain=item["domain"],
                title=item.get("title", ""),
                source_level=item.get("source_level", ""),
                allowed=bool(item.get("allowed", True)),
            )
        )

    for item in _read_json_list(curated_path / "approved_web_facts.json"):
        existing = session.scalar(
            select(ApprovedWebFact).where(
                ApprovedWebFact.entity_id == item.get("entity_id", ""),
                ApprovedWebFact.fact_key == item["fact_key"],
            )
        )
        if existing is not None:
            existing.entity_type = item.get("entity_type", "spot")
            existing.fact_label = item.get("fact_label", "")
            existing.fact_value = str(item["fact_value"])
            existing.fact_unit = item.get("fact_unit", "")
            existing.source_url = item["source_url"]
            existing.source_level = item.get("source_level", "")
            existing.confidence = float(item.get("confidence", 0.8))
            continue
        session.add(
            ApprovedWebFact(
                entity_type=item.get("entity_type", "spot"),
                entity_id=item.get("entity_id", ""),
                fact_key=item["fact_key"],
                fact_label=item.get("fact_label", ""),
                fact_value=str(item["fact_value"]),
                fact_unit=item.get("fact_unit", ""),
                source_url=item["source_url"],
                source_level=item.get("source_level", ""),
                confidence=float(item.get("confidence", 0.8)),
            )
        )


def _import_curated_spots(session: Session, curated_path: Path) -> None:
    for sort_order, item in enumerate(_read_json_list(curated_path / "spots.json"), start=10):
        spot_id = item.get("entity_id") or _spot_id_from_raw_id(item.get("raw_id", ""))
        if not spot_id:
            continue
        spot = session.get(ScenicSpot, spot_id)
        if spot is None:
            spot = ScenicSpot(id=spot_id)
            session.add(spot)
        spot.name = item["name"]
        spot.summary = item.get("summary", "")
        spot.story = item.get("story", item.get("summary", ""))
        spot.tags = item.get("tags", ["佛教文化"])
        spot.visit_minutes = int(item.get("visit_minutes", 20))
        spot.crowd_types = item.get("crowd_types", ["历史文化游", "轻松游"])
        spot.image_url = item.get("image_url", "")
        spot.sort_order = sort_order * 10


def _spot_id_from_raw_id(raw_id: str) -> str:
    if not raw_id:
        return ""
    return f"spot_{raw_id.lower().replace('-', '_')}"


def _read_json_list(file_path: Path) -> list[dict]:
    if not file_path.exists():
        return []
    return json.loads(file_path.read_text(encoding="utf-8"))


def _file_hash(file_path: Path) -> str:
    return hashlib.sha256(file_path.read_bytes()).hexdigest()


def _knowledge_preview(file_path: Path) -> str:
    if file_path.suffix.lower() == ".md":
        return file_path.read_text(encoding="utf-8")[:800]

    if file_path.suffix.lower() == ".docx":
        text = _extract_docx_text(file_path)
        if text:
            return text[:800]

    return f"资料文件：{file_path.name}"


def _extract_docx_text(file_path: Path) -> str:
    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    try:
        with zipfile.ZipFile(file_path) as docx:
            root = ET.fromstring(docx.read("word/document.xml"))
    except (KeyError, OSError, ET.ParseError, zipfile.BadZipFile):
        return ""

    paragraphs: list[str] = []
    for paragraph in root.iter(namespace + "p"):
        text = "".join(
            node.text or ""
            for node in paragraph.iter(namespace + "t")
        ).strip()
        if text:
            paragraphs.append(text)
    return "\n".join(paragraphs)
