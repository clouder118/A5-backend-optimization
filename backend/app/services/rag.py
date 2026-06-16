from dataclasses import dataclass
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ApprovedWebFact, KnowledgeChunk, KnowledgeDoc, ScenicSpot, SpotFact
from app.schemas import KnowledgeSource


CHINESE_STOP_TERMS = {
    "什么",
    "有什么",
    "看点",
    "特色",
    "适合",
    "哪里",
    "怎么",
    "比较",
    "可以",
    "请问",
    "介绍",
    "一下",
    "吗",
    "呢",
}


@dataclass(frozen=True)
class RetrievedContext:
    source: KnowledgeSource
    text: str


def retrieve_context(
    db: Session,
    question: str,
    spot_id: str | None = None,
    top_k: int = 4,
    classification: dict | None = None,
) -> list[RetrievedContext]:
    candidates = (
        _structured_candidates(db, classification)
        + _spot_candidates(db, spot_id)
        + _knowledge_chunk_candidates(db)
    )
    scored = [
        (
            candidate,
            _score(question, candidate.text)
            + _spot_context_score(candidate, spot_id)
            + _structured_context_score(candidate)
            + _document_fact_context_score(candidate, classification),
        )
        for candidate in candidates
    ]
    ranked = [
        (candidate, score)
        for candidate, score in sorted(scored, key=lambda item: item[1], reverse=True)
        if score > 0
    ]

    unique_ranked: list[tuple[RetrievedContext, int]] = []
    seen_source_keys: set[tuple[str, str, str]] = set()
    for candidate, score in ranked:
        source_key = _source_dedupe_key(candidate, classification)
        if source_key in seen_source_keys:
            continue
        seen_source_keys.add(source_key)
        unique_ranked.append((candidate, score))
        if len(unique_ranked) >= top_k:
            break

    return [
        RetrievedContext(
            source=KnowledgeSource(
                title=candidate.source.title,
                spot_name=candidate.source.spot_name,
                section=candidate.source.section,
                snippet=_context_snippet(candidate, classification),
                score=float(score),
                source_type=candidate.source.source_type,
                source_url=candidate.source.source_url,
                source_level=candidate.source.source_level,
            ),
            text=candidate.text,
        )
        for candidate, score in unique_ranked
    ]


def _structured_candidates(db: Session, classification: dict | None) -> list[RetrievedContext]:
    if not classification:
        return []

    candidates: list[RetrievedContext] = []
    entities = classification.get("entities", [])
    fact_keys = classification.get("fact_keys", [])
    for entity in entities:
        if entity.get("entity_type") != "spot":
            continue
        spot = db.get(ScenicSpot, entity.get("entity_id"))
        if spot is None:
            continue
        for fact_key in fact_keys:
            candidates.extend(_fact_candidates(db, spot, fact_key))
            if fact_key == "suitability":
                candidates.append(_suitability_candidate(spot))
        if classification.get("intent") == "scenic_explanation":
            candidates.append(_spot_overview_candidate(spot))
    return candidates


def _fact_candidates(db: Session, spot: ScenicSpot, fact_key: str) -> list[RetrievedContext]:
    contexts: list[RetrievedContext] = []
    facts = db.scalars(
        select(SpotFact).where(
            SpotFact.spot_id == spot.id,
            SpotFact.fact_key == fact_key,
        )
    ).all()
    for fact in facts:
        snippet = _fact_snippet(fact.fact_label, fact.fact_value, fact.fact_unit)
        contexts.append(
            RetrievedContext(
                source=KnowledgeSource(
                    title="景区资料库",
                    spot_name=spot.name,
                    section="结构化事实",
                    snippet=snippet,
                    score=0,
                    source_type=fact.source_type,
                    source_url=fact.source_url,
                ),
                text=f"{spot.name} {fact.fact_label} {snippet}",
            )
        )

    approved_facts = db.scalars(
        select(ApprovedWebFact).where(
            ApprovedWebFact.entity_id == spot.id,
            ApprovedWebFact.fact_key == fact_key,
        )
    ).all()
    for fact in approved_facts:
        snippet = _fact_snippet(fact.fact_label, fact.fact_value, fact.fact_unit)
        contexts.append(
            RetrievedContext(
                source=KnowledgeSource(
                    title="已审核联网补充",
                    spot_name=spot.name,
                    section="结构化事实",
                    snippet=snippet,
                    score=0,
                    source_type="approved_web",
                    source_url=fact.source_url,
                ),
                text=f"{spot.name} {fact.fact_label} {snippet}",
            )
        )
    return contexts


def _suitability_candidate(spot: ScenicSpot) -> RetrievedContext:
    snippet = (
        f"标签：{'、'.join(spot.tags)}；"
        f"适合人群：{'、'.join(spot.crowd_types)}"
    )
    return RetrievedContext(
        source=KnowledgeSource(
            title="景区资料库",
            spot_name=spot.name,
            section="结构化标签",
            snippet=snippet,
            score=0,
            source_type="database",
        ),
        text=f"{spot.name} {snippet}",
    )


def _spot_overview_candidate(spot: ScenicSpot) -> RetrievedContext:
    return RetrievedContext(
        source=KnowledgeSource(
            title="景区资料库",
            spot_name=spot.name,
            section="景点简介",
            snippet=_snippet(f"{spot.summary}{spot.story}"),
            score=0,
            source_type="database",
        ),
        text=" ".join([spot.name, spot.summary, spot.story, " ".join(spot.tags)]),
    )


def _spot_candidates(db: Session, spot_id: str | None) -> list[RetrievedContext]:
    statement = select(ScenicSpot)
    if spot_id:
        statement = statement.where(ScenicSpot.id == spot_id)
    spots = db.scalars(statement).all()
    return [
        RetrievedContext(
            source=KnowledgeSource(
                title="灵山胜境景点资料",
                spot_name=spot.name,
                section="景点简介",
                snippet=_snippet(f"{spot.summary}{spot.story}"),
                score=0,
                source_type="database",
            ),
            text=" ".join(
                [
                    spot.name,
                    spot.summary,
                    spot.story,
                    " ".join(spot.tags),
                    " ".join(spot.crowd_types),
                ]
            ),
        )
        for spot in spots
    ]


def _knowledge_chunk_candidates(db: Session) -> list[RetrievedContext]:
    rows = db.execute(
        select(KnowledgeChunk, KnowledgeDoc)
        .join(KnowledgeDoc, KnowledgeDoc.id == KnowledgeChunk.doc_id)
    ).all()
    return [
        RetrievedContext(
            source=KnowledgeSource(
                title=doc.title,
                spot_name=None,
                section="资料片段",
                snippet=_snippet(chunk.chunk_text),
                score=0,
                source_type="document",
            ),
            text=chunk.chunk_text,
        )
        for chunk, doc in rows
    ]


def _score(question: str, text: str) -> int:
    terms = _terms(question)
    return sum(1 for term in terms if term in text)


def _spot_context_score(candidate: RetrievedContext, spot_id: str | None) -> int:
    if spot_id and candidate.source.section == "景点简介":
        return 100
    return 0


def _structured_context_score(candidate: RetrievedContext) -> int:
    if candidate.source.section == "结构化事实" and candidate.source.source_type == "database":
        return 1000
    if candidate.source.section == "结构化事实":
        return 900
    if candidate.source.section == "结构化标签":
        return 850
    return 0


def _document_fact_context_score(
    candidate: RetrievedContext,
    classification: dict | None,
) -> int:
    if not classification or candidate.source.source_type != "document":
        return 0
    fact_terms = {
        "height_meters": ["高度", "米"],
        "opening_time": ["开放时间", "营业时间", "几点开", "几点关"],
        "ticket": ["门票", "票价", "票种", "成人票", "半价票", "免票", "收费"],
        "visit_minutes": ["游览", "停留", "多久"],
    }
    score = 0
    for fact_key in classification.get("fact_keys", []):
        matched_terms = [term for term in fact_terms.get(fact_key, []) if term in candidate.text]
        if matched_terms:
            score += 500 + len(matched_terms) * 40
    return score


def _context_snippet(candidate: RetrievedContext, classification: dict | None) -> str:
    if not classification or candidate.source.source_type != "document":
        return candidate.source.snippet
    fact_terms = {
        "height_meters": ["高度", "米"],
        "opening_time": ["开放时间", "营业时间", "几点开", "几点关"],
        "ticket": ["成人票", "门票", "票价", "票种", "半价票", "免票", "收费"],
        "visit_minutes": ["游览", "停留", "多久"],
    }
    terms = [
        term
        for fact_key in classification.get("fact_keys", [])
        for term in fact_terms.get(fact_key, [])
    ]
    indexes = [candidate.text.find(term) for term in terms if term in candidate.text]
    if not indexes:
        return candidate.source.snippet
    start = max(0, min(indexes) - 30)
    return _snippet(candidate.text[start:])


def _source_dedupe_key(
    candidate: RetrievedContext,
    classification: dict | None,
) -> tuple[str, str, str]:
    source = candidate.source
    return (
        source.spot_name or "",
        " ".join(_context_snippet(candidate, classification).split()),
        source.source_url or "",
    )


def _fact_snippet(label: str, value: str, unit: str) -> str:
    return f"{label}：{value}{unit}"


def _terms(text: str) -> list[str]:
    terms: set[str] = set()
    for token in re.split(r"[\s，。！？、,.!?：:；;（）()]+", text):
        token = token.strip()
        if not token:
            continue
        _add_term(terms, token)
        for cjk_text in re.findall(r"[\u4e00-\u9fff]+", token):
            for size in range(2, min(6, len(cjk_text)) + 1):
                for index in range(0, len(cjk_text) - size + 1):
                    _add_term(terms, cjk_text[index : index + size])
    return sorted(terms, key=lambda term: (-len(term), term))


def _add_term(terms: set[str], term: str) -> None:
    if term and term not in CHINESE_STOP_TERMS:
        terms.add(term)


def _snippet(text: str, limit: int = 120) -> str:
    compact = " ".join(text.split())
    return compact[:limit]
