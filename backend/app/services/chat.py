import json
import re
from collections import OrderedDict
from dataclasses import dataclass
from time import perf_counter
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ApiError
from app.models import ChatMessage, ChatSession, MapPoint, ScenicSpot, WebFactCandidate
from app.schemas import (
    ChatMetrics,
    ChatRequest,
    ChatResponse,
    GuideAction,
    GuideRoutePreference,
    KnowledgeSource,
    RouteRecommendRequest,
)
from app.services.mimo import MimoClient
from app.services.question_classifier import classify_question
from app.services.rag import retrieve_context_with_metrics
from app.services.routes import recommend_routes
from app.services.tts import synthesize_answer_audio
from app.services.tts_jobs import TtsJobStore
from app.services.web_search import (
    WebSearchTimeout,
    get_web_search_provider,
    web_results_to_contexts,
)


FACT_EVIDENCE_TERMS = {
    "height_meters": ["高度", "米"],
    "opening_time": ["开放时间", "营业时间", "几点开", "几点关"],
    "ticket": ["门票", "票价", "票务", "多少钱"],
    "visit_minutes": ["游览", "停留", "多久"],
    "suitability": ["适合", "人群", "标签"],
}


SUPPORTED_GUIDE_THEMES = (
    "佛教文化",
    "建筑艺术",
    "演艺亲子",
    "摄影打卡",
    "自然休闲",
    "室内体验",
)
GUIDE_THEME_ALIASES = {
    "佛教": "佛教文化",
    "历史": "佛教文化",
    "文化": "佛教文化",
    "礼佛": "佛教文化",
    "建筑": "建筑艺术",
    "艺术": "建筑艺术",
    "空间": "建筑艺术",
    "亲子": "演艺亲子",
    "孩子": "演艺亲子",
    "老人": "自然休闲",
    "演艺": "演艺亲子",
    "表演": "演艺亲子",
    "摄影": "摄影打卡",
    "拍照": "摄影打卡",
    "出片": "摄影打卡",
    "打卡": "摄影打卡",
    "朋友圈": "摄影打卡",
    "发朋友圈": "摄影打卡",
    "好看": "摄影打卡",
    "自然": "自然休闲",
    "风光": "自然休闲",
    "休闲": "自然休闲",
    "轻松": "自然休闲",
    "花海": "自然休闲",
    "室内": "室内体验",
    "避雨": "室内体验",
}

MAP_NAME_LABELS = {
    "ling-shan": "灵山胜境",
    "nianhua-bay": "拈花湾",
}

ROUTE_STRONG_REQUEST_WORDS = (
    "生成路线",
    "规划路线",
    "安排路线",
    "帮我规划",
    "帮我安排",
    "给我规划",
    "给我安排",
    "排路线",
    "一条路线",
    "走一条",
    "路线怎么安排",
    "路线怎么走",
    "安排行程",
    "规划行程",
)

ROUTE_SOFT_ACTION_WORDS = (
    "怎么逛",
    "怎么玩",
    "怎么游",
    "怎么走",
    "推荐玩法",
    "推荐游览",
)

ROUTE_CONTEXT_WORDS = (
    "分钟",
    "小时",
    "可游览",
    "我有",
    "喜欢",
    "兴趣",
    "偏好",
    "佛教",
    "建筑",
    "自然",
    "风光",
    "摄影",
    "拍照",
    "出片",
    "亲子",
    "老人",
    "轻松",
    "体力",
    "强度",
)

ROUTE_FOLLOWUP_REQUEST_WORDS = (
    "换成",
    "改成",
    "调整成",
    "轻松一点",
    "少走一点",
    "少走路",
    "慢一点",
    "低强度",
    "高强度",
    "自然休闲",
    "自然风光",
    "摄影打卡",
    "建筑艺术",
    "佛教文化",
    "亲子",
)


@dataclass
class DirectGuideResult:
    answer: str
    sources: list[KnowledgeSource]
    mode: str
    degraded: bool = False
    guide_action: GuideAction | None = None
    emotion_cue: str = "warm"
    answer_style: str = "direct"


@dataclass(frozen=True)
class CachedGuideAnswer:
    answer: str
    sources: list[KnowledgeSource]
    mode: str
    degraded: bool
    classification: dict
    retrieval_mode: str
    vector_status: str
    evidence_profile: str
    answer_style: str
    llm_model: str
    embedding_model: str


_ANSWER_CACHE: OrderedDict[tuple, tuple[float, CachedGuideAnswer]] = OrderedDict()


def answer_chat(
    db: Session,
    settings: Settings,
    request: ChatRequest,
    tts_jobs: TtsJobStore | None = None,
) -> ChatResponse:
    total_started = perf_counter()
    session_id = request.session_id or f"s_{uuid4().hex}"
    chat_session = db.get(ChatSession, session_id)
    if chat_session is None:
        chat_session = ChatSession(
            id=session_id,
            visitor_type=str(request.profile.get("visitor_type", "")),
            preference=str(request.profile.get("preference", "")),
        )
        db.add(chat_session)
    else:
        _update_session_profile(chat_session, request.profile)

    classification = classify_question(db, request.question, settings)
    direct_result = _maybe_direct_guide_result(db, settings, request, chat_session, classification)
    if direct_result is not None:
        tts_started = perf_counter()
        audio_url, tts_status, tts_job_id = _start_tts(settings, direct_result.answer, tts_jobs)
        tts_ms = _elapsed_ms(tts_started)
        metrics = ChatMetrics(
            retrieval_ms=0,
            llm_ms=0,
            tts_ms=tts_ms,
            total_ms=_elapsed_ms(total_started),
            cache_hit=False,
            degraded=direct_result.degraded,
            classification=classification,
            web_supplement_required=False,
            web_supplement_status="not_required",
            retrieval_mode="guide_direct",
            context_count=0,
            vector_status="not_required",
            guide_intent=str(classification.get("intent", "")),
            evidence_profile="direct",
            route_triggered=direct_result.guide_action is not None,
            answer_style=direct_result.answer_style,
            llm_model=settings.llm_model,
            embedding_model=settings.rag_embedding_model,
        )
        db.add(
            ChatMessage(
                session_id=session_id,
                question=request.question,
                answer=direct_result.answer,
                sources_json=[source.model_dump() for source in direct_result.sources],
                metrics_json=metrics.model_dump(),
            )
        )
        db.commit()
        return ChatResponse(
            answer=direct_result.answer,
            sources=direct_result.sources,
            session_id=session_id,
            audio_url=audio_url,
            tts_job_id=tts_job_id,
            tts_status=tts_status,
            mode=direct_result.mode,
            degraded=direct_result.degraded,
            metrics=metrics,
            guide_action=direct_result.guide_action,
            emotion_cue=direct_result.emotion_cue,
        )

    answer_cache_key = _answer_cache_key(request.question, request.spot_id, classification, settings)
    cached_answer = _get_answer_cache(answer_cache_key, settings)
    if cached_answer is not None:
        tts_started = perf_counter()
        audio_url, tts_status, tts_job_id = _start_tts(settings, cached_answer.answer, tts_jobs)
        tts_ms = _elapsed_ms(tts_started)
        metrics = ChatMetrics(
            retrieval_ms=0,
            llm_ms=0,
            tts_ms=tts_ms,
            total_ms=_elapsed_ms(total_started),
            cache_hit=True,
            degraded=cached_answer.degraded,
            classification=cached_answer.classification,
            web_supplement_required=False,
            web_supplement_status="not_required",
            retrieval_mode=cached_answer.retrieval_mode,
            context_count=len(cached_answer.sources),
            vector_status=cached_answer.vector_status,
            guide_intent=str(cached_answer.classification.get("intent", "")),
            evidence_profile=cached_answer.evidence_profile,
            route_triggered=False,
            answer_style=cached_answer.answer_style,
            llm_model=cached_answer.llm_model,
            embedding_model=cached_answer.embedding_model,
            answer_cache_hit=True,
        )
        db.add(
            ChatMessage(
                session_id=session_id,
                question=request.question,
                answer=cached_answer.answer,
                sources_json=[source.model_dump() for source in cached_answer.sources],
                metrics_json=metrics.model_dump(),
            )
        )
        db.commit()
        return ChatResponse(
            answer=cached_answer.answer,
            sources=cached_answer.sources,
            session_id=session_id,
            audio_url=audio_url,
            tts_job_id=tts_job_id,
            tts_status=tts_status,
            mode=cached_answer.mode,
            degraded=cached_answer.degraded,
            metrics=metrics,
            emotion_cue=_emotion_cue_for_classification(cached_answer.classification, cached_answer.sources),
        )

    retrieval_started = perf_counter()
    contexts, retrieval_detail = retrieve_context_with_metrics(
        db,
        request.question,
        request.spot_id,
        classification=classification,
        settings=settings,
    )
    retrieval_ms = _elapsed_ms(retrieval_started)
    web_supplement_required = _needs_web_supplement(classification, contexts, request.question)
    web_contexts, web_supplement_status = _web_supplement_contexts(
        settings,
        request.question,
        classification,
        web_supplement_required,
    )
    contexts = web_contexts + contexts
    sources = _visible_sources(
        contexts,
        classification,
        web_supplement_required,
        web_supplement_status,
    )
    llm_started = perf_counter()
    answer, mode, degraded = _answer_text(
        settings,
        request.question,
        contexts,
        classification,
        web_supplement_required,
        web_supplement_status,
    )
    llm_ms = _elapsed_ms(llm_started)
    tts_started = perf_counter()
    audio_url, tts_status, tts_job_id = _start_tts(settings, answer, tts_jobs)
    tts_ms = _elapsed_ms(tts_started)
    _store_web_fact_candidates(db, request.question, answer, classification, contexts)
    metrics = ChatMetrics(
        retrieval_ms=retrieval_ms,
        llm_ms=llm_ms,
        tts_ms=tts_ms,
        total_ms=_elapsed_ms(total_started),
        cache_hit=retrieval_detail.retrieval_cache_hit,
        degraded=degraded,
        classification=classification,
        web_supplement_required=web_supplement_required,
        web_supplement_status=web_supplement_status,
        retrieval_mode=retrieval_detail.retrieval_mode,
        context_count=retrieval_detail.context_count,
        fts_ms=retrieval_detail.fts_ms,
        embedding_ms=retrieval_detail.embedding_ms,
        rerank_ms=retrieval_detail.rerank_ms,
        vector_status=retrieval_detail.vector_status,
        retrieval_cache_hit=retrieval_detail.retrieval_cache_hit,
        embedding_cache_hit=retrieval_detail.embedding_cache_hit,
        guide_intent=str(classification.get("intent", "")),
        evidence_profile=_evidence_profile(classification, contexts),
        route_triggered=False,
        answer_style=_answer_style_for_classification(classification),
        llm_model=settings.llm_model,
        embedding_model=settings.rag_embedding_model,
        warmup_status="retrieval_cache_hit" if retrieval_detail.retrieval_cache_hit else "",
    )

    if _cacheable_answer(classification, web_supplement_required, web_supplement_status):
        _set_answer_cache(
            answer_cache_key,
            CachedGuideAnswer(
                answer=answer,
                sources=sources,
                mode=mode,
                degraded=degraded,
                classification=classification,
                retrieval_mode=retrieval_detail.retrieval_mode,
                vector_status=retrieval_detail.vector_status,
                evidence_profile=_evidence_profile(classification, contexts),
                answer_style=_answer_style_for_classification(classification),
                llm_model=settings.llm_model,
                embedding_model=settings.rag_embedding_model,
            ),
            settings,
        )

    db.add(
        ChatMessage(
            session_id=session_id,
            question=request.question,
            answer=answer,
            sources_json=[source.model_dump() for source in sources],
            metrics_json=metrics.model_dump(),
        )
    )
    db.commit()

    return ChatResponse(
        answer=answer,
        sources=sources,
        session_id=session_id,
        audio_url=audio_url,
        tts_job_id=tts_job_id,
        tts_status=tts_status,
        mode=mode,
        degraded=degraded,
        metrics=metrics,
        emotion_cue=_emotion_cue_for_classification(classification, sources),
    )


def stream_chat_events(
    db: Session,
    settings: Settings,
    request: ChatRequest,
    tts_jobs: TtsJobStore | None = None,
):
    total_started = perf_counter()
    session_id = request.session_id or f"s_{uuid4().hex}"
    chat_session = db.get(ChatSession, session_id)
    if chat_session is None:
        chat_session = ChatSession(
            id=session_id,
            visitor_type=str(request.profile.get("visitor_type", "")),
            preference=str(request.profile.get("preference", "")),
        )
        db.add(chat_session)
    else:
        _update_session_profile(chat_session, request.profile)

    classification = classify_question(db, request.question, settings)
    direct_result = _maybe_direct_guide_result(db, settings, request, chat_session, classification)
    if direct_result is not None:
        llm_started = perf_counter()
        first_delta_ms = 0.0
        for chunk in _chunk_text(direct_result.answer):
            if first_delta_ms == 0:
                first_delta_ms = _elapsed_ms(total_started)
            yield _sse("delta", {"text": chunk})
        llm_ms = _elapsed_ms(llm_started)
        tts_started = perf_counter()
        audio_url, tts_status, tts_job_id = _start_tts(settings, direct_result.answer, tts_jobs)
        tts_ms = _elapsed_ms(tts_started)
        metrics = ChatMetrics(
            retrieval_ms=0,
            llm_ms=llm_ms,
            tts_ms=tts_ms,
            total_ms=_elapsed_ms(total_started),
            cache_hit=False,
            degraded=direct_result.degraded,
            classification=classification,
            web_supplement_required=False,
            web_supplement_status="not_required",
            retrieval_mode="guide_direct",
            context_count=0,
            vector_status="not_required",
            guide_intent=str(classification.get("intent", "")),
            evidence_profile="direct",
            route_triggered=direct_result.guide_action is not None,
            answer_style=direct_result.answer_style,
            llm_model=settings.llm_model,
            embedding_model=settings.rag_embedding_model,
            first_delta_ms=first_delta_ms,
        )
        db.add(
            ChatMessage(
                session_id=session_id,
                question=request.question,
                answer=direct_result.answer,
                sources_json=[source.model_dump() for source in direct_result.sources],
                metrics_json=metrics.model_dump(),
            )
        )
        db.commit()
        response = ChatResponse(
            answer=direct_result.answer,
            sources=direct_result.sources,
            session_id=session_id,
            audio_url=audio_url,
            tts_job_id=tts_job_id,
            tts_status=tts_status,
            mode=direct_result.mode,
            degraded=direct_result.degraded,
            metrics=metrics,
            guide_action=direct_result.guide_action,
            emotion_cue=direct_result.emotion_cue,
        )
        yield _sse("final", response.model_dump())
        return

    answer_cache_key = _answer_cache_key(request.question, request.spot_id, classification, settings)
    cached_answer = _get_answer_cache(answer_cache_key, settings)
    if cached_answer is not None:
        yield _sse("status", {"phase": "cached"})
        llm_started = perf_counter()
        first_delta_ms = 0.0
        for chunk in _chunk_text(cached_answer.answer):
            if first_delta_ms == 0:
                first_delta_ms = _elapsed_ms(total_started)
            yield _sse("delta", {"text": chunk})
        llm_ms = _elapsed_ms(llm_started)
        tts_started = perf_counter()
        audio_url, tts_status, tts_job_id = _start_tts(settings, cached_answer.answer, tts_jobs)
        tts_ms = _elapsed_ms(tts_started)
        metrics = ChatMetrics(
            retrieval_ms=0,
            llm_ms=llm_ms,
            tts_ms=tts_ms,
            total_ms=_elapsed_ms(total_started),
            cache_hit=True,
            degraded=cached_answer.degraded,
            classification=cached_answer.classification,
            web_supplement_required=False,
            web_supplement_status="not_required",
            retrieval_mode=cached_answer.retrieval_mode,
            context_count=len(cached_answer.sources),
            vector_status=cached_answer.vector_status,
            guide_intent=str(cached_answer.classification.get("intent", "")),
            evidence_profile=cached_answer.evidence_profile,
            route_triggered=False,
            answer_style=cached_answer.answer_style,
            llm_model=cached_answer.llm_model,
            embedding_model=cached_answer.embedding_model,
            first_delta_ms=first_delta_ms,
            answer_cache_hit=True,
            warmup_status="answer_cache_hit",
        )
        db.add(
            ChatMessage(
                session_id=session_id,
                question=request.question,
                answer=cached_answer.answer,
                sources_json=[source.model_dump() for source in cached_answer.sources],
                metrics_json=metrics.model_dump(),
            )
        )
        db.commit()
        response = ChatResponse(
            answer=cached_answer.answer,
            sources=cached_answer.sources,
            session_id=session_id,
            audio_url=audio_url,
            tts_job_id=tts_job_id,
            tts_status=tts_status,
            mode=cached_answer.mode,
            degraded=cached_answer.degraded,
            metrics=metrics,
            emotion_cue=_emotion_cue_for_classification(cached_answer.classification, cached_answer.sources),
        )
        yield _sse("final", response.model_dump())
        return

    yield _sse("status", {"phase": "retrieving"})
    retrieval_started = perf_counter()
    contexts, retrieval_detail = retrieve_context_with_metrics(
        db,
        request.question,
        request.spot_id,
        classification=classification,
        settings=settings,
    )
    retrieval_ms = _elapsed_ms(retrieval_started)
    web_supplement_required = _needs_web_supplement(classification, contexts, request.question)
    web_contexts, web_supplement_status = _web_supplement_contexts(
        settings,
        request.question,
        classification,
        web_supplement_required,
    )
    contexts = web_contexts + contexts
    sources = _visible_sources(
        contexts,
        classification,
        web_supplement_required,
        web_supplement_status,
    )

    llm_started = perf_counter()
    answer_parts: list[str] = []
    stream_state = {
        "mode": _mode_for_stream(settings),
        "degraded": settings.llm_mode == "openai_compatible" and not settings.llm_api_key,
    }
    first_delta_ms = 0.0
    yield _sse("status", {"phase": "thinking"})
    for chunk in _answer_text_chunks(
        settings,
        request.question,
        contexts,
        classification,
        web_supplement_required,
        web_supplement_status,
        stream_state,
    ):
        answer_parts.append(chunk)
        if first_delta_ms == 0:
            first_delta_ms = _elapsed_ms(total_started)
        yield _sse("delta", {"text": chunk})
    answer = _stabilize_vague_recommendation_answer(
        _stabilize_entity_name(
            _clean_visitor_answer("".join(answer_parts)),
            classification,
        ),
        request.question,
    )
    llm_ms = _elapsed_ms(llm_started)

    mode = stream_state["mode"]
    degraded = stream_state["degraded"]
    tts_started = perf_counter()
    audio_url, tts_status, tts_job_id = _start_tts(settings, answer, tts_jobs)
    tts_ms = _elapsed_ms(tts_started)
    _store_web_fact_candidates(db, request.question, answer, classification, contexts)
    metrics = ChatMetrics(
        retrieval_ms=retrieval_ms,
        llm_ms=llm_ms,
        tts_ms=tts_ms,
        total_ms=_elapsed_ms(total_started),
        cache_hit=retrieval_detail.retrieval_cache_hit,
        degraded=degraded,
        classification=classification,
        web_supplement_required=web_supplement_required,
        web_supplement_status=web_supplement_status,
        retrieval_mode=retrieval_detail.retrieval_mode,
        context_count=retrieval_detail.context_count,
        fts_ms=retrieval_detail.fts_ms,
        embedding_ms=retrieval_detail.embedding_ms,
        rerank_ms=retrieval_detail.rerank_ms,
        vector_status=retrieval_detail.vector_status,
        retrieval_cache_hit=retrieval_detail.retrieval_cache_hit,
        embedding_cache_hit=retrieval_detail.embedding_cache_hit,
        guide_intent=str(classification.get("intent", "")),
        evidence_profile=_evidence_profile(classification, contexts),
        route_triggered=False,
        answer_style=_answer_style_for_classification(classification),
        llm_model=settings.llm_model,
        embedding_model=settings.rag_embedding_model,
        first_delta_ms=first_delta_ms,
        warmup_status="retrieval_cache_hit" if retrieval_detail.retrieval_cache_hit else "",
    )

    if _cacheable_answer(classification, web_supplement_required, web_supplement_status):
        _set_answer_cache(
            answer_cache_key,
            CachedGuideAnswer(
                answer=answer,
                sources=sources,
                mode=mode,
                degraded=degraded,
                classification=classification,
                retrieval_mode=retrieval_detail.retrieval_mode,
                vector_status=retrieval_detail.vector_status,
                evidence_profile=_evidence_profile(classification, contexts),
                answer_style=_answer_style_for_classification(classification),
                llm_model=settings.llm_model,
                embedding_model=settings.rag_embedding_model,
            ),
            settings,
        )

    db.add(
        ChatMessage(
            session_id=session_id,
            question=request.question,
            answer=answer,
            sources_json=[source.model_dump() for source in sources],
            metrics_json=metrics.model_dump(),
        )
    )
    db.commit()

    response = ChatResponse(
        answer=answer,
        sources=sources,
        session_id=session_id,
        audio_url=audio_url,
        tts_job_id=tts_job_id,
        tts_status=tts_status,
        mode=mode,
        degraded=degraded,
        metrics=metrics,
        emotion_cue=_emotion_cue_for_classification(classification, sources),
    )
    yield _sse("final", response.model_dump())


def _elapsed_ms(started_at: float) -> float:
    return round((perf_counter() - started_at) * 1000, 2)


def _update_session_profile(chat_session: ChatSession, profile: dict) -> None:
    visitor_type = str(profile.get("visitor_type", "")).strip()
    preference = str(profile.get("preference", "")).strip()
    route_preference = profile.get("route_preference")
    if visitor_type:
        chat_session.visitor_type = visitor_type
    if isinstance(route_preference, dict):
        chat_session.preference = json.dumps(route_preference, ensure_ascii=False)
        return
    if preference:
        chat_session.preference = preference


def _answer_cache_key(
    question: str,
    spot_id: str | None,
    classification: dict,
    settings: Settings,
) -> tuple:
    entities = tuple(
        sorted(
            str(entity.get("entity_id", ""))
            for entity in (classification or {}).get("entities", [])
            if isinstance(entity, dict)
        )
    )
    return (
        "guide-answer-v1",
        re.sub(r"\s+", " ", question.strip().lower())[:240],
        spot_id or "",
        classification.get("intent", ""),
        entities,
        settings.llm_model,
        settings.guide_style,
        settings.rag_embedding_model,
        settings.database_url,
        settings.source_package_path,
        settings.derived_knowledge_path,
    )


def _get_answer_cache(
    cache_key: tuple,
    settings: Settings,
) -> CachedGuideAnswer | None:
    if settings.guide_answer_cache_ttl_seconds <= 0:
        return None
    cached = _ANSWER_CACHE.get(cache_key)
    if cached is None:
        return None
    cached_at, answer = cached
    if perf_counter() - cached_at > settings.guide_answer_cache_ttl_seconds:
        _ANSWER_CACHE.pop(cache_key, None)
        return None
    _ANSWER_CACHE.move_to_end(cache_key)
    return answer


def _set_answer_cache(
    cache_key: tuple,
    answer: CachedGuideAnswer,
    settings: Settings,
) -> None:
    if settings.guide_answer_cache_ttl_seconds <= 0:
        return
    _ANSWER_CACHE[cache_key] = (perf_counter(), answer)
    _ANSWER_CACHE.move_to_end(cache_key)
    while len(_ANSWER_CACHE) > max(1, settings.guide_answer_cache_size):
        _ANSWER_CACHE.popitem(last=False)


def _cacheable_answer(
    classification: dict,
    web_supplement_required: bool,
    web_supplement_status: str,
) -> bool:
    intent = classification.get("intent", "")
    if intent in {"route", "casual", "high_risk_realtime", "external_factual"}:
        return False
    if web_supplement_required or web_supplement_status not in {"not_required", ""}:
        return False
    if classification.get("fact_keys") and any(
        key in {"opening_time", "ticket", "weather"} for key in classification.get("fact_keys", [])
    ):
        return False
    return intent in {"scenic_explanation", "scenic_fact", "mixed_emotional_fact", "service", "unknown"}


def warm_answer_cache(
    db: Session,
    settings: Settings,
    question: str,
    spot_id: str | None = None,
) -> bool:
    classification = classify_question(db, question, settings)
    cache_key = _answer_cache_key(question, spot_id, classification, settings)
    if _get_answer_cache(cache_key, settings) is not None:
        return True
    if _maybe_direct_guide_result(
        db,
        settings,
        ChatRequest(question=question, spot_id=spot_id),
        ChatSession(id="warmup"),
        classification,
    ) is not None:
        return False
    contexts, retrieval_detail = retrieve_context_with_metrics(
        db,
        question,
        spot_id,
        classification=classification,
        settings=settings,
    )
    web_supplement_required = _needs_web_supplement(classification, contexts, question)
    if not _cacheable_answer(classification, web_supplement_required, "not_required"):
        return False
    answer, mode, degraded = _answer_text(
        settings,
        question,
        contexts,
        classification,
        False,
        "not_required",
    )
    sources = _visible_sources(contexts, classification, False, "not_required")
    _set_answer_cache(
        cache_key,
        CachedGuideAnswer(
            answer=answer,
            sources=sources,
            mode=mode,
            degraded=degraded,
            classification=classification,
            retrieval_mode=retrieval_detail.retrieval_mode,
            vector_status=retrieval_detail.vector_status,
            evidence_profile=_evidence_profile(classification, contexts),
            answer_style=_answer_style_for_classification(classification),
            llm_model=settings.llm_model,
            embedding_model=settings.rag_embedding_model,
        ),
        settings,
    )
    return True


def _maybe_direct_guide_result(
    db: Session,
    settings: Settings,
    request: ChatRequest,
    chat_session: ChatSession,
    classification: dict,
) -> DirectGuideResult | None:
    question = request.question.strip()
    if _is_scenic_spot_listing_question(question):
        return _scenic_spot_listing_result(db, request, chat_session)
    if _is_route_guide_question(question, classification, chat_session):
        return _route_guide_result(db, settings, request, chat_session)
    if _is_casual_guide_question(question, classification):
        return _casual_guide_result(settings, question)
    return None


def _is_casual_guide_question(question: str, classification: dict) -> bool:
    compact = re.sub(r"\s+", "", question).lower()
    if classification.get("intent") == "casual":
        return True
    casual_phrases = {
        "你好",
        "您好",
        "您好呀",
        "嗨",
        "哈喽",
        "hello",
        "在吗",
        "哈喽在吗",
        "谢谢",
        "谢谢你",
        "你是谁",
        "你是谁？",
        "你叫什么",
        "你叫什么名字",
        "你叫什么名字？",
        "你会干什么",
        "你会干什么？",
        "你能干什么",
        "你能做什么",
        "你能做什么？",
        "介绍一下你自己",
    }
    if compact in casual_phrases:
        return True
    if len(compact) <= 8 and any(phrase in compact for phrase in {"你好", "您好", "嗨", "哈喽", "hello"}):
        return True
    if "你" in compact and any(
        phrase in compact
        for phrase in {
            "你是谁",
            "叫什么",
            "名字",
            "会干什么",
            "能干什么",
            "能做什么",
            "像真人导游",
            "陪我逛",
            "在吗",
        }
    ):
        return True
    if "第一次来" in compact and ("不知道问什么" in compact or "问什么" in compact):
        return True
    return False


def _casual_guide_result(settings: Settings, question: str) -> DirectGuideResult:
    answer = _mimo_style_answer(
        settings,
        system_prompt=_direct_guide_system_prompt(),
        user_prompt=(
            f"游客刚刚说：{question}\n"
            "请用 1 到 3 句自然回应。不要引用资料，不要说“根据资料”。"
            "如果游客问你是谁或会做什么，请说明你能讲景点、给游览建议、在明确请求时生成路线。"
        ),
        answer_style="guide",
    )
    used_mimo = bool(answer)
    if not answer:
        answer = _casual_guide_answer(question)
    return DirectGuideResult(
        answer=answer,
        sources=[],
        mode="guide_casual",
        degraded=not used_mimo,
        emotion_cue="warm",
        answer_style="casual",
    )


def _casual_guide_answer(question: str) -> str:
    compact = re.sub(r"\s+", "", question)
    if "谁" in compact or "叫什么" in compact:
        return "我是你的景区 AI 导游，可以陪你聊景点故事、提醒游览节奏，也能按你的时间和兴趣帮你排一条路线。你就像问真人导游一样问我就行。"
    if "干什么" in compact or "能干什么" in compact:
        return "我能做三件事：讲景点、给建议、排路线。比如你可以问我“梵宫有什么看点”，也可以说“我喜欢自然风光，帮我安排一条轻松路线”。"
    return "你好呀，我在这儿。想听景点故事、问路线怎么走，或者让老人孩子玩得轻松一点，都可以直接告诉我。"


def _mimo_style_answer(
    settings: Settings,
    system_prompt: str,
    user_prompt: str,
    answer_style: str = "guide",
) -> str | None:
    if not _llm_available(settings):
        return None
    try:
        client = MimoClient(settings.llm_base_url, settings.llm_api_key)
        return _clean_visitor_answer(
            _call_mimo_chat_completion(
                client,
                model=settings.llm_model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=_temperature_for_style(settings, answer_style),
                max_completion_tokens=settings.llm_max_completion_tokens,
            )
        )
    except Exception:
        return None


def _call_mimo_chat_completion(
    client: MimoClient,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float | None = None,
    max_completion_tokens: int | None = None,
) -> str:
    try:
        return client.chat_completion(
            model=model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
            max_completion_tokens=max_completion_tokens,
        )
    except TypeError:
        return client.chat_completion(model, system_prompt, user_prompt)


def _call_mimo_chat_stream(
    client: MimoClient,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float | None = None,
    max_completion_tokens: int | None = None,
):
    try:
        yield from client.chat_completion_stream(
            model=model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
            max_completion_tokens=max_completion_tokens,
        )
    except TypeError:
        yield from client.chat_completion_stream(model, system_prompt, user_prompt)


def _temperature_for_style(settings: Settings, answer_style: str) -> float:
    if answer_style == "fact":
        return settings.llm_temperature_fact
    if answer_style == "service":
        return settings.llm_temperature_service
    if answer_style == "route":
        return settings.llm_temperature_route
    return settings.llm_temperature_guide


def _llm_available(settings: Settings) -> bool:
    return settings.llm_mode == "openai_compatible" and bool(settings.llm_api_key)


def _direct_guide_system_prompt() -> str:
    return (
        "你是“游知灵”景区数字人导游。你的语气像一位温柔、有经验的真人导游，"
        "亲切、有一点个性，但不要卖萌。回答要短，适合游客现场听。"
        "不要用“根据资料”“当前资料显示”“关于……”这类资料播报式开头。"
        "没有证据时不要编造景区事实。"
    )


def _is_service_advice_question(question: str) -> bool:
    compact = re.sub(r"\s+", "", question)
    if not any(word in compact for word in ("注意", "提醒", "老人", "孩子", "小朋友", "休息", "累", "方便")):
        return False
    if any(word in compact for word in ("路线", "生成", "规划", "安排行程", "安排路线")):
        return False
    return True


def _service_advice_answer(question: str, profile: dict, chat_session: ChatSession) -> str:
    preference = _route_preference_from_request(
        ChatRequest(question=question, profile=profile),
        chat_session,
    )
    map_name = MAP_NAME_LABELS.get(str(preference.get("map_id")), "景区")
    if "老人" in question:
        if preference.get("map_id") == "nianhua-bay":
            return "带老人来拈花湾，节奏可以放慢一点，别把街区和花海都排得太满。建议先确认休息点和返程位置，遇到需要长走的支线就少走一点，体验会舒服很多。"
        return "带老人来灵山，最重要是别赶路。这里有些点位之间步行距离不短，建议把核心景点放在前面，中间留休息时间；如果觉得累，就优先保留大佛、梵宫这类重点。"
    if any(word in question for word in ("孩子", "小朋友")):
        return f"带孩子游{map_name}，我建议把讲解拆成小故事，不要连续塞太多文化信息。可以选互动性强、画面感明显的点位，中间穿插休息和拍照，孩子会更容易跟上。"
    return f"游{map_name}不用太赶，先抓住你最想看的主题，再把体力留给最后一两个重点点位。要是现场觉得累，就少走支线，把体验感保住会更重要。"


def _is_scenic_spot_listing_question(question: str) -> bool:
    compact = re.sub(r"\s+", "", question)
    listing_words = ("有什么景点", "有哪些景点", "有啥景点", "景点有哪些", "景点有什么")
    return any(word in compact for word in listing_words)


def _scenic_spot_listing_result(
    db: Session,
    request: ChatRequest,
    chat_session: ChatSession,
) -> DirectGuideResult:
    preference = _route_preference_from_request(request, chat_session)
    map_id = str(preference.get("map_id") or "ling-shan")
    map_name = MAP_NAME_LABELS.get(map_id, "景区")
    rows = db.execute(
        select(ScenicSpot)
        .join(MapPoint, MapPoint.spot_id == ScenicSpot.id)
        .where(MapPoint.map_id == map_id)
        .order_by(ScenicSpot.sort_order.asc(), ScenicSpot.name.asc())
    ).scalars()
    spots: list[ScenicSpot] = []
    seen: set[str] = set()
    for spot in rows:
        if spot.id in seen or "入口" in spot.name or spot.id.endswith("_entrance"):
            continue
        spots.append(spot)
        seen.add(spot.id)
    if not spots:
        return DirectGuideResult(
            answer=f"{map_name}的景点清单我这里暂时没拿稳，先不乱说。你可以问我某个具体景点，比如“梵宫有什么看点”，我会讲得更准一点。",
            sources=[],
            mode="guide_scenic_list",
            degraded=True,
        emotion_cue="fallback",
        answer_style="list",
    )
    names = _prioritized_scenic_list_names(map_id, [spot.name for spot in spots])
    highlights = "、".join(names[:10])
    if map_id == "nianhua-bay":
        opening = "拈花湾主要是禅意小镇和自然街区的感觉，节奏比灵山更松弛。"
    else:
        opening = "灵山胜境的景点更像一条文化中轴线，适合边走边理解佛教文化和建筑层次。"
    tail = "如果你想，我也可以再按“拍照、亲子、建筑、自然”帮你挑重点，不一定马上排完整路线。"
    return DirectGuideResult(
        answer=f"{opening}比较值得先认识的点有：{highlights}。{tail}",
        sources=[],
        mode="guide_scenic_list",
        emotion_cue="warm",
        answer_style="list",
    )


def _prioritized_scenic_list_names(map_id: str, names: list[str]) -> list[str]:
    priority = {
        "ling-shan": [
            "灵山大佛",
            "灵山梵宫",
            "九龙灌浴",
            "五印坛城",
            "祥符禅寺",
            "佛足坛",
            "菩提大道",
            "阿育王柱",
            "百子戏弥勒",
            "曼飞龙塔",
        ],
        "nianhua-bay": [
            "拈花广场",
            "梵天花海",
            "香月花街",
            "拈花堂",
            "五灯湖",
            "鹿鸣谷",
        ],
    }.get(map_id, [])
    ordered = [name for name in priority if name in names]
    ordered.extend(name for name in names if name not in ordered)
    return ordered


def _is_route_guide_question(question: str, classification: dict, chat_session: ChatSession) -> bool:
    compact = re.sub(r"\s+", "", question)
    if any(phrase in compact for phrase in ("不需要路线", "不要路线", "不用路线", "不规划路线", "不用规划", "只是想了解")):
        return False
    scenic_info_words = (
        "有什么景点",
        "有哪些景点",
        "有什么看点",
        "有哪些看点",
        "有什么特色",
        "介绍一下",
        "讲讲",
        "说说",
    )
    if any(word in compact for word in scenic_info_words):
        return False
    if _is_service_advice_question(question):
        return False
    if _has_explicit_route_request(compact):
        return True
    route_followup_words = (
        "换成",
        "改成",
        "调整成",
        "轻松一点",
        "少走一点",
        "少走路",
        "多走一点",
        "强度低",
        "强度高",
        "偏自然",
        "偏摄影",
        "偏建筑",
        "偏亲子",
    )
    if _session_route_preference(chat_session) and any(
        word in compact for word in route_followup_words
    ):
        return True
    if _session_route_preference(chat_session) and any(
        word in compact for word in ROUTE_FOLLOWUP_REQUEST_WORDS
    ):
        return True
    return False


def _has_explicit_route_request(compact: str) -> bool:
    if any(word in compact for word in ROUTE_STRONG_REQUEST_WORDS):
        return True
    if "路线" in compact and any(word in compact for word in ("推荐", "生成", "规划", "安排", "怎么", "帮我", "做", "排")):
        return True
    if "行程" in compact and any(word in compact for word in ("推荐", "生成", "规划", "安排", "怎么", "帮我")):
        return True
    if any(word in compact for word in ROUTE_SOFT_ACTION_WORDS):
        return any(word in compact for word in ROUTE_CONTEXT_WORDS)
    if any(word in compact for word in ("我有", "可游览")) and any(word in compact for word in ROUTE_CONTEXT_WORDS):
        return any(word in compact for word in ("怎么", "逛", "游", "玩", "安排", "规划", "推荐"))
    return False


def _route_guide_result(
    db: Session,
    settings: Settings,
    request: ChatRequest,
    chat_session: ChatSession,
) -> DirectGuideResult:
    preference = _route_preference_from_request(request, chat_session)
    _store_route_preference(chat_session, preference)
    try:
        routes = recommend_routes(db, _route_request_from_preference(preference))
    except ApiError:
        routes = []
    except Exception:
        routes = []
    if not routes:
        return DirectGuideResult(
            answer="我刚刚没能从路线系统拿到稳定结果，所以先不替你乱排路线。你可以稍后再试一次，或者告诉我景区、时间和兴趣，我再帮你重新安排。",
            sources=[],
            mode="route_unavailable",
        degraded=True,
        emotion_cue="fallback",
        answer_style="route",
    )
    route = routes[0]
    preference_model = GuideRoutePreference(**preference)
    return DirectGuideResult(
        answer=_route_answer_text(settings, route, preference_model),
        sources=[],
        mode="route_recommendation",
        degraded=False,
        guide_action=GuideAction(
            type="route_recommendation",
            title=route.name,
            route=route,
            preference=preference_model,
        ),
        emotion_cue="success",
        answer_style="route",
    )


def _route_preference_from_request(request: ChatRequest, chat_session: ChatSession) -> dict:
    base = {
        "map_id": "ling-shan",
        "duration_minutes": 120,
        "physical_level": "medium",
        "interest_tags": ["佛教文化", "建筑艺术"],
        "accessible_required": False,
    }
    session_preference = _session_route_preference(chat_session)
    if session_preference:
        base.update(session_preference)
    profile_preference = request.profile.get("route_preference") or request.profile.get("routePreference")
    if isinstance(profile_preference, dict):
        base.update(_normalize_route_preference_dict(profile_preference))
    text_overrides = _route_preference_from_text(request.question)
    base.update({key: value for key, value in text_overrides.items() if value not in (None, [], "")})
    base["interest_tags"] = _normalize_interest_tags(base.get("interest_tags", []))
    if not base["interest_tags"]:
        base["interest_tags"] = ["佛教文化"]
    base["duration_minutes"] = min(1440, max(30, int(base.get("duration_minutes") or 120)))
    if base.get("map_id") not in MAP_NAME_LABELS:
        base["map_id"] = "ling-shan"
    if base.get("physical_level") not in {"low", "medium", "high"}:
        base["physical_level"] = "medium"
    return base


def _normalize_route_preference_dict(value: dict) -> dict:
    return {
        "map_id": value.get("map_id") or value.get("mapId") or "ling-shan",
        "duration_minutes": value.get("duration_minutes") or value.get("durationMinutes") or 120,
        "physical_level": value.get("physical_level") or value.get("physicalLevel") or "medium",
        "interest_tags": value.get("interest_tags") or value.get("interestTags") or [],
        "accessible_required": bool(value.get("accessible_required") or value.get("accessibleRequired") or False),
    }


def _route_preference_from_text(question: str) -> dict:
    compact = re.sub(r"\s+", "", question)
    preference: dict = {}
    if "拈花湾" in compact:
        preference["map_id"] = "nianhua-bay"
    elif "灵山" in compact:
        preference["map_id"] = "ling-shan"
    duration = _duration_from_text(compact)
    if duration:
        preference["duration_minutes"] = duration
    if any(word in compact for word in ("轻松", "少走", "低强度", "老人", "慢一点")):
        preference["physical_level"] = "low"
    elif any(word in compact for word in ("高强度", "多走", "能走", "体力好", "强度高")):
        preference["physical_level"] = "high"
    elif any(word in compact for word in ("中等", "适中", "普通")):
        preference["physical_level"] = "medium"
    tags = _themes_from_text(compact)
    if tags:
        preference["interest_tags"] = tags
    return preference


def _duration_from_text(text: str) -> int | None:
    digit_minutes = re.search(r"(\d{2,4})\s*(?:分钟|分|min|mins)", text, flags=re.IGNORECASE)
    if digit_minutes:
        return int(digit_minutes.group(1))
    digit_hours = re.search(r"(\d+(?:\.\d+)?)\s*(?:小时|小時|h)", text, flags=re.IGNORECASE)
    if digit_hours:
        return round(float(digit_hours.group(1)) * 60)
    chinese_hours = {
        "一小时": 60,
        "一个小时": 60,
        "两小时": 120,
        "两个小时": 120,
        "三小时": 180,
        "三个小时": 180,
        "四小时": 240,
        "四个小时": 240,
    }
    for phrase, minutes in chinese_hours.items():
        if phrase in text:
            return minutes
    return None


def _themes_from_text(text: str) -> list[str]:
    themes: list[str] = []
    for alias, theme in GUIDE_THEME_ALIASES.items():
        if alias in text and theme not in themes:
            themes.append(theme)
    for theme in SUPPORTED_GUIDE_THEMES:
        if theme in text and theme not in themes:
            themes.append(theme)
    return themes[:2]


def _normalize_interest_tags(value) -> list[str]:
    if isinstance(value, str):
        raw_tags = re.split(r"[,，、;；\s]+", value)
    elif isinstance(value, list):
        raw_tags = [str(item) for item in value]
    else:
        raw_tags = []
    tags: list[str] = []
    for raw in raw_tags:
        theme = GUIDE_THEME_ALIASES.get(raw, raw)
        if theme in SUPPORTED_GUIDE_THEMES and theme not in tags:
            tags.append(theme)
    return tags[:2]


def _session_route_preference(chat_session: ChatSession) -> dict:
    try:
        value = json.loads(chat_session.preference or "")
    except Exception:
        return {}
    if not isinstance(value, dict):
        return {}
    return _normalize_route_preference_dict(value)


def _store_route_preference(chat_session: ChatSession, preference: dict) -> None:
    chat_session.preference = json.dumps(preference, ensure_ascii=False)


def _route_request_from_preference(preference: dict) -> RouteRecommendRequest:
    return RouteRecommendRequest(
        map_id=str(preference.get("map_id") or "ling-shan"),
        duration_minutes=int(preference.get("duration_minutes") or 120),
        physical_level=str(preference.get("physical_level") or "medium"),
        interest_tags=[str(item) for item in preference.get("interest_tags", [])],
        accessible_required=bool(preference.get("accessible_required", False)),
    )


def _route_answer_text(settings: Settings, route, preference: GuideRoutePreference) -> str:
    map_name = MAP_NAME_LABELS.get(preference.map_id, "景区")
    themes = "和".join(preference.interest_tags) if preference.interest_tags else "你的兴趣"
    pace = {
        "low": "节奏会放轻一点，少折返、少赶路",
        "medium": "节奏比较均衡，既能看重点也不会太赶",
        "high": "节奏会更充实一些，适合体力比较好的游览",
    }.get(preference.physical_level, "节奏比较均衡")
    spot_names = [spot.name for spot in route.spots if "入口" not in spot.name]
    sequence = "、".join(spot_names[:6])
    if len(spot_names) > 6:
        sequence += "等点位"
    if not sequence:
        sequence = "当前最适合你的核心点位"
    walk_text = f"步行约{route.estimated_walk_minutes}分钟，" if route.estimated_walk_minutes else ""
    mimo_answer = _mimo_style_answer(
        settings,
        system_prompt=_direct_guide_system_prompt()
        + "你正在解释系统已经生成好的路线，只能使用给定顺序，不能增删景点、不能重新排序。",
        user_prompt=(
            f"景区：{map_name}\n"
            f"游客兴趣：{themes}\n"
            f"体力节奏：{pace}\n"
            f"总时长：{route.total_minutes}分钟\n"
            f"预计步行：{route.estimated_walk_minutes}分钟\n"
            f"路线顺序：{sequence}\n\n"
            "请用 3 到 4 句像真人导游一样解释这条路线。"
            "必须提醒用户可以看地图、编辑路线或开始游览。"
            "不要说“根据资料”，不要编造路线之外的景点。"
        ),
        answer_style="route",
    )
    if mimo_answer:
        return mimo_answer
    return (
        f"好呀，我按你这次偏{themes}的喜好，给你排了一条{map_name}路线。"
        f"全程大约{route.total_minutes}分钟，{walk_text}{pace}。"
        f"路线会从景区入口出发，依次去{sequence}。"
        "你可以先看地图确认动线；如果想再轻松一点，点“编辑路线”删掉一两个支线点位就行。"
    )


def _emotion_cue_for_classification(classification: dict, sources) -> str:
    if classification.get("emotional"):
        return "warm"
    if sources:
        return "success"
    return "idle"


def _start_tts(
    settings: Settings,
    answer: str,
    tts_jobs: TtsJobStore | None,
) -> tuple[str | None, str, str | None]:
    if settings.tts_mode == "disabled" or not settings.tts_api_key:
        audio_url, status = synthesize_answer_audio(settings, answer)
        return audio_url, status, None
    if tts_jobs is None:
        audio_url, status = synthesize_answer_audio(settings, answer)
        return audio_url, status, None

    job = tts_jobs.enqueue(settings, answer)
    return None, job.status, job.id


def _answer_text(
    settings: Settings,
    question: str,
    contexts,
    classification: dict,
    web_supplement_required: bool,
    web_supplement_status: str,
) -> tuple[str, str, bool]:
    if settings.llm_mode == "mock":
        return _fallback_answer(
            question,
            contexts,
            web_supplement_required,
            classification,
            web_supplement_status,
        ), "mock", False
    if settings.llm_mode in {"disabled", "fallback"}:
        return _fallback_answer(
            question,
            contexts,
            web_supplement_required,
            classification,
            web_supplement_status,
        ), "fallback", False
    if not settings.llm_api_key:
        if _has_realtime_web_context(contexts):
            return _fallback_answer(
                question,
                contexts,
                web_supplement_required,
                classification,
                web_supplement_status,
            ), "web_supplement", False
        return _fallback_answer(
            question,
            contexts,
            web_supplement_required,
            classification,
            web_supplement_status,
        ), "fallback", True
    if (
        web_supplement_required
        and web_supplement_status != "success"
        and classification.get("intent") != "external_factual"
    ):
        return _fallback_answer(
            question,
            contexts,
            web_supplement_required,
            classification,
            web_supplement_status,
        ), "web_supplement_unavailable", False

    try:
        client = MimoClient(settings.llm_base_url, settings.llm_api_key)
        answer_style = _answer_style_for_classification(classification)
        answer = _call_mimo_chat_completion(
            client,
            model=settings.llm_model,
            system_prompt=_system_prompt(),
            user_prompt=_user_prompt(
                question,
                contexts,
                classification,
                web_supplement_required,
                web_supplement_status,
            ),
            temperature=_temperature_for_style(settings, answer_style),
            max_completion_tokens=settings.llm_max_completion_tokens,
        )
        return _stabilize_vague_recommendation_answer(
            _stabilize_entity_name(
                _clean_visitor_answer(answer),
                classification,
            ),
            question,
        ), settings.llm_mode, False
    except Exception:
        if _has_realtime_web_context(contexts):
            return _fallback_answer(
                question,
                contexts,
                web_supplement_required,
                classification,
                web_supplement_status,
            ), "web_supplement", False
        return _fallback_answer(
            question,
            contexts,
            web_supplement_required,
            classification,
            web_supplement_status,
        ), "fallback", True


def _answer_text_chunks(
    settings: Settings,
    question: str,
    contexts,
    classification: dict,
    web_supplement_required: bool,
    web_supplement_status: str,
    stream_state: dict,
):
    if settings.llm_mode == "mock":
        yield from _chunk_text(
            _fallback_answer(
                question,
                contexts,
                web_supplement_required,
                classification,
                web_supplement_status,
            )
        )
        return
    if settings.llm_mode in {"disabled", "fallback"}:
        yield from _chunk_text(
            _fallback_answer(
                question,
                contexts,
                web_supplement_required,
                classification,
                web_supplement_status,
            )
        )
        return
    if not settings.llm_api_key:
        if _has_realtime_web_context(contexts):
            stream_state["mode"] = "web_supplement"
            stream_state["degraded"] = False
            yield from _chunk_text(
                _fallback_answer(
                    question,
                    contexts,
                    web_supplement_required,
                    classification,
                    web_supplement_status,
                )
            )
            return
        yield from _chunk_text(
            _fallback_answer(
                question,
                contexts,
                web_supplement_required,
                classification,
                web_supplement_status,
            )
        )
        return
    if (
        web_supplement_required
        and web_supplement_status != "success"
        and classification.get("intent") != "external_factual"
    ):
        stream_state["mode"] = "web_supplement_unavailable"
        stream_state["degraded"] = False
        yield from _chunk_text(
            _fallback_answer(
                question,
                contexts,
                web_supplement_required,
                classification,
                web_supplement_status,
            )
        )
        return

    try:
        client = MimoClient(settings.llm_base_url, settings.llm_api_key)
        has_chunk = False
        answer_style = _answer_style_for_classification(classification)
        for chunk in _call_mimo_chat_stream(
            client,
            model=settings.llm_model,
            system_prompt=_system_prompt(),
            user_prompt=_user_prompt(
                question,
                contexts,
                classification,
                web_supplement_required,
                web_supplement_status,
            ),
            temperature=_temperature_for_style(settings, answer_style),
            max_completion_tokens=settings.llm_max_completion_tokens,
        ):
            has_chunk = True
            yield chunk
        return
    except Exception:
        if has_chunk:
            return
        if _has_realtime_web_context(contexts):
            stream_state["mode"] = "web_supplement"
            stream_state["degraded"] = False
            yield from _chunk_text(
                _fallback_answer(
                    question,
                    contexts,
                    web_supplement_required,
                    classification,
                    web_supplement_status,
                )
            )
            return
        stream_state["mode"] = "fallback"
        stream_state["degraded"] = True
        yield from _chunk_text(
            _fallback_answer(
                question,
                contexts,
                web_supplement_required,
                classification,
                web_supplement_status,
            )
        )
        return

def _chunk_text(text: str, size: int = 18):
    for index in range(0, len(text), size):
        yield text[index : index + size]


def _clean_visitor_answer(answer: str) -> str:
    text = answer.strip()
    text = re.sub(r"^关于[“\"].{0,80}[”\"]，?\s*当前资料(?:显示|显示：|中显示：?)", "", text).strip()
    text = re.sub(r"^关于.{1,80}[，,:：]\s*", "", text).strip()
    text = re.sub(r"^根据(?:提供的)?(?:景区)?(?:资料库|资料|证据|信息)[，,:：]\s*", "", text).strip()
    text = re.sub(r"^根据.{0,20}(?:资料库|资料|证据|信息)[，,:：]\s*", "", text).strip()
    text = re.sub(r"^(?:资料|证据|信息)(?:显示|显示：|中显示：?)\s*", "", text).strip()
    text = re.sub(r"^当前资料(?:显示|显示：|中显示：?)\s*", "", text).strip()
    text = re.sub(
        r"\s*[（(][^（）()]{0,80}(?:联网搜索|来源|source|https?://)[^（）()]{0,220}[）)]\s*$",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()
    text = re.sub(
        r"\s*(?:来源|资料来源|信息来源)[:：]\s*(?:\[[^\]]+\]\([^)]*\)|https?://\S+|[^\n。]{1,160})\s*$",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()
    text = re.sub(r"\s*https?://\S+\s*$", "", text).strip()
    return text


def _stabilize_entity_name(answer: str, classification: dict) -> str:
    names = [
        str(entity.get("name", "")).strip()
        for entity in (classification or {}).get("entities", [])
        if isinstance(entity, dict) and str(entity.get("name", "")).strip()
    ]
    if len(answer.strip()) < 12:
        return answer
    for name in dict.fromkeys(names):
        if name and name not in answer:
            return f"{name}最值得看的地方，{answer}"
    return answer


def _stabilize_vague_recommendation_answer(answer: str, question: str) -> str:
    compact_question = re.sub(r"\s+", "", question)
    compact_answer = re.sub(r"\s+", "", answer)
    culture_question = (
        ("灵山" in compact_question and "文化" in compact_question)
        or ("第一次" in compact_question and "理解" in compact_question)
        or ("初次" in compact_question and "理解" in compact_question)
    )
    if culture_question and not any(
        term in compact_answer for term in ("灵山", "文化", "大佛", "九龙灌浴")
    ):
        return f"第一次理解灵山文化，可以先抓住灵山大佛和九龙灌浴这条主线。{answer}"
    if any(term in compact_question for term in ("礼仪", "注意", "禁忌", "安全吗")):
        return answer
    photo_question = any(
        term in compact_question
        for term in ("出片", "拍照", "摄影", "打卡", "朋友圈", "发朋友圈")
    )
    if not photo_question:
        return answer
    if "拈花湾" in compact_question and not any(
        term in compact_answer for term in ("拈花湾", "花海", "五灯湖", "香月花街")
    ):
        return f"拈花湾想拍得有记忆点，我会优先推荐梵天花海、五灯湖和香月花街。{answer}"
    if not any(term in compact_answer for term in ("拍照", "摄影", "出片", "打卡", "花海", "梵宫")):
        return f"{answer} 如果你是想拍照出片，可以优先看梵宫、五印坛城和梵天花海。"
    return answer


def _mode_for_stream(settings: Settings) -> str:
    if settings.llm_mode == "mock":
        return "mock"
    if settings.llm_mode in {"disabled", "fallback"}:
        return "fallback"
    if not settings.llm_api_key:
        return "fallback"
    return settings.llm_mode


def _sse(event: str, data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


def _needs_web_supplement(classification: dict, contexts, question: str = "") -> bool:
    fact_keys = set(classification.get("fact_keys", []))
    if not fact_keys:
        return classification.get("intent") == "high_risk_realtime"
    if "weather" in fact_keys:
        return True
    if classification.get("intent") == "high_risk_realtime" and _is_explicit_realtime_change_question(question):
        return True
    if classification.get("intent") not in {
        "scenic_fact",
        "mixed_emotional_fact",
        "high_risk_realtime",
        "external_factual",
    }:
        return False
    if any(
        context.source.section == "结构化事实"
        and context.source.source_type in {"database", "approved_web"}
        for context in contexts
    ):
        return False
    if any(
        context.source.section == "结构化标签"
        and context.source.source_type == "database"
        for context in contexts
    ):
        return False
    if _has_document_fact_evidence(classification, contexts):
        return False
    return True


def _is_explicit_realtime_change_question(question: str) -> bool:
    compact = re.sub(r"\s+", "", question or "")
    realtime_terms = (
        "今天",
        "今日",
        "现在",
        "实时",
        "最新",
        "当天",
        "临时",
        "最近",
        "变了吗",
        "有变化",
        "变化吗",
        "调整了吗",
        "有没有调整",
        "还开放吗",
    )
    return any(term in compact for term in realtime_terms)


def _has_realtime_web_context(contexts) -> bool:
    return any(context.source.source_type == "realtime_web" for context in contexts)


def _visible_sources(
    contexts,
    classification: dict,
    web_supplement_required: bool,
    web_supplement_status: str,
):
    realtime_sources = [
        context.source
        for context in contexts
        if context.source.source_type == "realtime_web"
    ]
    if _is_external_realtime_question(classification) and realtime_sources:
        return realtime_sources
    if web_supplement_required and web_supplement_status == "success" and realtime_sources:
        curated_non_realtime = [
            context.source
            for context in _curated_evidence_contexts(contexts, classification)
            if context.source.source_type != "realtime_web"
        ]
        return realtime_sources + curated_non_realtime
    if (
        web_supplement_required
        and web_supplement_status != "success"
        and _is_external_realtime_question(classification)
    ):
        return realtime_sources
    return [context.source for context in _curated_evidence_contexts(contexts, classification)]


def _web_supplement_contexts(
    settings: Settings,
    question: str,
    classification: dict,
    web_supplement_required: bool,
):
    if not web_supplement_required:
        return [], "not_required"
    if settings.web_search_mode == "disabled":
        return [], "disabled"

    provider = get_web_search_provider(settings)
    saw_timeout = False
    saw_failure = False
    saw_untrusted_results = False
    for search_query in _web_search_queries(question, classification):
        try:
            results = provider.search(search_query, settings.web_search_timeout_seconds)
        except (TimeoutError, WebSearchTimeout):
            saw_timeout = True
            continue
        except Exception:
            saw_failure = True
            continue

        contexts = web_results_to_contexts(
            results,
            classification,
            settings.web_search_max_results,
        )
        if contexts:
            return contexts, "success"
        saw_untrusted_results = bool(results)

    if saw_untrusted_results:
        return [], "no_trusted_results"
    if saw_failure:
        return [], "failed"
    if saw_timeout:
        return [], "timeout"
    return [], "no_trusted_results"


def _web_search_queries(question: str, classification: dict) -> list[str]:
    entities = classification.get("entities", [])
    entity_names = [
        str(entity.get("name", "")).strip()
        for entity in entities
        if entity.get("entity_type") == "spot" and entity.get("name")
    ]
    if not entity_names:
        return [question]

    fact_terms = {
        "height_meters": "高度 官方",
        "opening_time": "开放时间 官方",
        "ticket": "门票 官方 票价",
        "visit_minutes": "游览时长 官方",
        "suitability": "适合人群 官方",
    }
    terms = [
        fact_terms[fact_key]
        for fact_key in classification.get("fact_keys", [])
        if fact_key in fact_terms
    ]
    if any(term in question for term in ["冲突", "不同来源", "差异"]):
        terms.append("冲突 不同来源")
    focused_query = " ".join(["灵山胜境", *entity_names, *terms]).strip()
    local_query = " ".join(["无锡", "灵山大佛景区", *entity_names, *terms]).strip()
    return list(dict.fromkeys([focused_query, local_query, question]))


def _fallback_answer(
    question: str,
    contexts,
    web_supplement_required: bool = False,
    classification: dict | None = None,
    web_supplement_status: str = "not_required",
) -> str:
    web_contexts = [
        context for context in contexts if context.source.source_type == "realtime_web"
    ]
    if web_contexts:
        primary = web_contexts[0].source
        reminder = _official_reminder(classification or {})
        conflict_note = ""
        if len({context.source.snippet for context in web_contexts}) > 1:
            conflict_note = "不同联网来源可能存在差异，建议以更高优先级来源为准。"
        return (
            f"我帮你查到的最新信息是：{primary.snippet}。"
            f"{conflict_note}{reminder}"
        )

    if web_supplement_required:
        if _is_external_realtime_question(classification or {}):
            status_text = _web_unavailable_text(web_supplement_status)
            advice = _external_realtime_unavailable_advice(classification or {})
            return (
                f"这个我现在不能替你确认最新版本，刚刚尝试联网时{status_text}。"
                f"{advice}"
            )
        return (
            "这个信息我现在不能直接确认，所以不乱说。"
            "如果涉及开放时间、票价或现场服务变化，建议你优先看景区官方公告，到了现场也可以问服务台。"
        )

    if not contexts:
        return "这个我还不能确定，先不硬编给你。你可以换个更具体的问题，比如问某个景点的看点、路线怎么安排，或者到现场问工作人员确认最新信息。"

    primary = contexts[0].source
    subject = primary.spot_name or primary.title
    subject_label = _friendly_subject_label(subject)
    if (classification or {}).get("intent") == "service" or any(word in question for word in ["老人", "孩子", "休息", "轻松"]):
        if "老人" in question:
            return (
                "带老人来玩，最重要的是别把行程排得太满。"
                f"如果你们正在{subject_label}附近，我会建议先确认休息点和返程动线，"
                "核心景点慢慢看，支线点位觉得累就果断少走一点。"
            )
        if any(word in question for word in ["孩子", "小朋友"]):
            return (
                "带孩子游览，可以把讲解拆成小故事，别连续塞太多文化信息。"
                f"如果你们在{subject_label}附近，建议穿插拍照、休息和互动感强的点位，孩子会更容易跟上。"
            )
        return (
            f"这类现场服务问题，我建议你先以舒适和安全为主。"
            f"如果你正在{subject_label}附近，可以先找好休息点或服务点，再决定要不要继续往下一个点走。"
        )
    return f"{primary.snippet}。如果你正在{subject_label}附近，可以边看现场导览标识，边把这里留作一个重点停留点。"


def _friendly_subject_label(subject: str) -> str:
    cleaned = (subject or "").strip()
    if not cleaned:
        return "当前区域"
    if len(cleaned) > 16 or "：" in cleaned or ":" in cleaned:
        return "当前区域"
    return cleaned


def _official_reminder(classification: dict) -> str:
    fact_keys = set(classification.get("fact_keys", []))
    if classification.get("intent") == "high_risk_realtime" or fact_keys.intersection(
        {"opening_time", "ticket"}
    ):
        return "涉及开放时间、票价或现场服务变化时，请以景区官方公告或现场工作人员说明为准。"
    return ""


def _is_external_realtime_question(classification: dict) -> bool:
    if classification.get("entities"):
        return False
    return classification.get("intent") == "high_risk_realtime"


def _web_unavailable_text(status: str) -> str:
    return {
        "disabled": "联网搜索当前未启用",
        "timeout": "联网搜索超时，暂时没有拿到可引用结果",
        "failed": "联网搜索调用失败，暂时没有拿到可引用结果",
        "no_trusted_results": "暂时没有拿到可引用的联网结果",
    }.get(status, "暂时没有拿到可引用的联网结果")


def _external_realtime_unavailable_advice(classification: dict) -> str:
    fact_keys = set(classification.get("fact_keys", []))
    if "weather" in fact_keys:
        return (
            "建议您打开手机天气应用或权威天气网站查看最新预报；"
            "如果准备游览灵山胜境，也可以根据天气准备防晒、雨具和舒适鞋服。"
        )
    if "ticket" in fact_keys:
        return "建议您优先查看景区官方购票渠道、公众号或现场售票处公布的最新票务信息。"
    if "opening_time" in fact_keys:
        return "建议您优先查看景区官方公告、公众号或现场服务台公布的最新开放时间。"
    return "建议您优先查看官方渠道或现场服务台公布的最新信息。"


def _store_web_fact_candidates(
    db: Session,
    question: str,
    answer: str,
    classification: dict,
    contexts,
) -> None:
    entities = classification.get("entities", [])
    fact_keys = classification.get("fact_keys", [])
    if not entities or not fact_keys:
        return

    entity = entities[0]
    fact_key = fact_keys[0]
    for context in contexts:
        source = context.source
        if source.source_type != "realtime_web":
            continue
        db.add(
            WebFactCandidate(
                entity_type=str(entity.get("entity_type", "spot")),
                entity_id=str(entity.get("entity_id", "")),
                entity_name=str(entity.get("name", "")),
                fact_key=str(fact_key),
                fact_value=source.snippet,
                source_url=source.source_url,
                source_level=source.source_level,
                question=question,
                answer_excerpt=(
                    answer
                    if "基于联网搜索" in answer
                    else f"基于联网搜索：{answer}"
                )[:500],
                status="pending_review",
            )
        )


def _has_document_fact_evidence(classification: dict, contexts) -> bool:
    fact_keys = classification.get("fact_keys", [])
    entities = classification.get("entities", [])
    entity_names = [entity.get("name", "") for entity in entities if entity.get("name")]
    for context in contexts:
        if context.source.source_type != "document":
            continue
        evidence_text = " ".join([context.text or "", context.source.snippet or ""])
        if any(_document_has_fact_evidence(evidence_text, fact_key, entity_names) for fact_key in fact_keys):
            return True
    return False


def _document_has_fact_evidence(text: str, fact_key: str, entity_names: list[str]) -> bool:
    if fact_key == "ticket":
        evidence_terms = ["成人票", "半价票", "免票", "票种"]
        has_value = any(term in text for term in evidence_terms) and bool(re.search(r"\d+\s*元", text))
    elif fact_key == "opening_time":
        has_value = bool(re.search(r"\d{1,2}[:：]\d{2}", text)) and _text_has_fact_terms(text, fact_key)
    else:
        has_value = _text_has_fact_terms(text, fact_key)

    if not has_value:
        return False
    if not entity_names:
        return True
    return any(_has_nearby_fact_value(text, entity_name) for entity_name in entity_names)


def _has_nearby_fact_value(text: str, entity_name: str, window: int = 160) -> bool:
    for match in re.finditer(re.escape(entity_name), text):
        nearby = text[match.start() : match.end() + window]
        if re.search(r"\d+\s*元", nearby) or re.search(r"\d{1,2}[:：]\d{2}", nearby):
            return True
    return False


def _text_has_fact_terms(text: str, fact_key: str) -> bool:
    return any(term in text for term in FACT_EVIDENCE_TERMS.get(fact_key, []))


def _answer_style_for_classification(classification: dict) -> str:
    intent = classification.get("intent")
    if intent == "scenic_fact":
        return "fact"
    if intent == "service":
        return "service"
    if intent in {"mixed_emotional_fact", "unknown"}:
        return "service" if classification.get("emotional") else "guide"
    return "guide"


def _evidence_profile(classification: dict, contexts) -> str:
    if not contexts:
        return "empty"
    sections = {context.source.section for context in contexts}
    source_types = {context.source.source_type for context in contexts}
    if "基于联网搜索" in sections or "realtime_web" in source_types:
        return "realtime"
    if "结构化事实" in sections:
        return "structured_fact"
    if "结构化标签" in sections:
        return "structured_tag"
    if classification.get("intent") == "service":
        return "service_advice"
    if "资料片段" in sections:
        return "document"
    return "mixed"


def _system_prompt() -> str:
    return (
        "你是“游知灵”景区 AI 数字人导游。"
        "你的表达要像一位温柔、熟悉景区、有现场经验的真人导游，而不是资料检索机器人。"
        "你可以有一点自己的导游性格：亲切、稳、会替游客考虑体力和现场体验，但不要卖萌。"
        "游客表达紧张、第一次来、带老人孩子时，允许亲切安抚，但不要过度煽情。"
        "只允许基于提供的事实证据回答景区事实，不能编造证据之外的景区事实。"
        "数据库证据优先；如果数据库证据与联网或文档证据冲突，说明差异并以数据库证据为主。"
        "涉及开放时间、票价、安全、实时状态等高风险信息时，提醒以官方公告或现场说明为准。"
        "如果没有足够事实证据，不要假装知道；要自然地说“这个我现在不能替你确认，先不乱说”。"
        "允许给游览节奏、拍照角度、停留方式等现场建议，但不能改变或补充事实证据之外的景区事实。"
        "如果游客只是问景点、看点、拍照、老人建议，不要主动规划路线，也不要说已生成路线。"
        "回答要自然、简洁，适合游客现场听。绝对不要用“关于……当前资料显示”“根据资料”“资料显示”等机械开头。"
    )


def _user_prompt(
    question: str,
    contexts,
    classification: dict,
    web_supplement_required: bool,
    web_supplement_status: str,
) -> str:
    return (
        f"【游客问题】{question}\n\n"
        f"【问题分类】\n{json.dumps(classification, ensure_ascii=False)}\n\n"
        f"【游客情绪】\n{_emotion_text(classification)}\n\n"
        f"【事实证据】\n{_evidence_text(contexts, classification)}\n\n"
        f"{_entity_name_instruction(classification)}"
        f"{_vague_recommendation_instruction(question, contexts, classification)}"
        "【来源规则】\n"
        "- source_type=database 表示景区资料库，事实优先级最高。\n"
        "- source_type=approved_web 表示已审核联网补充，只能作为补充。\n"
        "- source_type=document 表示讲解文档片段，用于故事、背景和原因解释。\n"
        "- source_type=realtime_web 表示实时联网搜索；来源会由前端来源卡片展示，正文不要写网址、来源括号或“基于联网搜索”尾注。\n\n"
        "【冲突处理】\n"
        "如果不同来源冲突，数据库证据优先；同时说明其他来源存在差异，提醒游客以官方公告或现场说明为准。\n\n"
        f"【联网补充】\n{_web_supplement_text(web_supplement_required, web_supplement_status)}\n\n"
        "请输出一段直接回答，2 到 4 句即可：先回应游客，再讲重点，再给一个现场建议。"
        "如果是服务建议问题，可以结合证据给出温和、务实的游览节奏建议。"
        "如果游客问“哪里比较出片/建筑感强/适合老人慢慢逛”等模糊推荐，可以点名 2 到 3 个景点并说明理由，但不要生成路线。"
        "如果游客问事实数值，先直接给数值，再补一句现场观看建议。"
        "不要在正文末尾追加括号来源、资料来源、URL 或联网搜索说明；也不要用“关于……当前资料显示”“根据资料”“资料显示”开头。"
    )


def _entity_name_instruction(classification: dict) -> str:
    names = [
        str(entity.get("name", "")).strip()
        for entity in (classification or {}).get("entities", [])
        if isinstance(entity, dict) and str(entity.get("name", "")).strip()
    ]
    if not names:
        return ""
    deduped_names = list(dict.fromkeys(names))[:2]
    return (
        "【景点名稳定性要求】\n"
        f"- 游客明确问到了：{'、'.join(deduped_names)}。回答第一句请保留这个景点名，不要只用“它/这里”代替。\n\n"
    )


def _vague_recommendation_instruction(
    question: str,
    contexts,
    classification: dict,
) -> str:
    intent = str((classification or {}).get("intent", ""))
    if intent not in {"scenic_explanation", "unknown", "service"}:
        return ""

    compact = re.sub(r"\s+", "", question)
    lines: list[str] = []
    if any(term in compact for term in ("建筑感", "建筑", "空间", "艺术")):
        lines.append(
            "- 这题是“建筑感/空间感”推荐，回答开头请直接点名 1 到 2 个建筑代表点，优先使用证据里的“梵宫”或“五印坛城”；不要只泛泛说氛围。"
        )
    if any(term in compact for term in ("朋友圈", "发朋友圈", "出片", "拍照", "摄影", "打卡")):
        if "拈花湾" in compact:
            lines.append(
                "- 这题是拈花湾拍照/朋友圈推荐，回答开头请明确说“拈花湾”，并优先点名“梵天花海、五灯湖、香月花街”中的 1 到 2 个。"
            )
        else:
            lines.append(
                "- 这题是拍照/出片推荐，回答开头请直接点名 2 到 3 个适合拍照的景点，再说为什么适合拍。"
            )
    if not lines:
        return ""
    spot_names = [
        context.source.spot_name
        for context in _curated_evidence_contexts(contexts, classification)
        if context.source.spot_name
    ]
    if spot_names:
        deduped_names = list(dict.fromkeys(spot_names))[:4]
        lines.append(f"- 当前证据中可优先参考的景点名：{'、'.join(deduped_names)}。")
    return "【模糊推荐稳定性要求】\n" + "\n".join(lines) + "\n\n"


def _web_supplement_text(web_supplement_required: bool, status: str) -> str:
    if not web_supplement_required:
        return "当前证据足够，不要自行联网或编造补充事实。"
    if status == "success":
        return "已使用实时联网搜索补充事实；正文自然回答即可，来源和网址由前端来源卡片展示。"
    return "需要联网补充事实，但当前未取得可信联网结果；不要编造补充事实。"


def _evidence_text(contexts, classification: dict | None = None) -> str:
    curated = _curated_evidence_contexts(contexts, classification)
    if not curated:
        return "当前没有可用事实证据。"
    grouped: dict[str, list[str]] = {}
    for context in curated:
        source = context.source
        section = source.section or "资料片段"
        label = source.spot_name or source.title or "通用资料"
        snippet = _compact_evidence_snippet(source.snippet)
        if not snippet:
            continue
        grouped.setdefault(section, []).append(
            f"- {label}｜{source.source_type}｜{snippet}"
        )
    if not grouped:
        return "当前没有可用事实证据。"
    blocks = []
    for section, rows in grouped.items():
        blocks.append(f"【{section}】\n" + "\n".join(rows[:3]))
    return "\n\n".join(blocks)


def _curated_evidence_contexts(contexts, classification: dict | None = None) -> list:
    if not contexts:
        return []
    ordered_contexts = sorted(
        contexts,
        key=lambda context: _evidence_sort_key(context, classification),
    )
    curated = []
    seen: set[tuple[str, str, str]] = set()
    section_counts: dict[str, int] = {}
    max_total = _max_evidence_count(classification)
    for context in ordered_contexts:
        source = context.source
        if _is_internal_route_source(source):
            continue
        snippet = _compact_evidence_snippet(source.snippet)
        if not snippet:
            continue
        key = (source.source_type or "", source.spot_name or "", snippet)
        if key in seen:
            continue
        section = source.section or "资料片段"
        if section_counts.get(section, 0) >= _section_limit(section, classification):
            continue
        seen.add(key)
        section_counts[section] = section_counts.get(section, 0) + 1
        curated.append(context)
        if len(curated) >= max_total:
            break
    return curated


def _max_evidence_count(classification: dict | None) -> int:
    intent = (classification or {}).get("intent")
    if intent == "scenic_fact":
        return 4
    if intent == "service":
        return 5
    return 5


def _section_limit(section: str, classification: dict | None) -> int:
    intent = (classification or {}).get("intent")
    if section == "结构化事实":
        return 3
    if section == "结构化标签":
        return 2 if intent == "service" else 1
    if section == "景点简介":
        return 2
    if section == "资料片段":
        return 3
    if section == "基于联网搜索":
        return 2
    return 2


def _is_internal_route_source(source: KnowledgeSource) -> bool:
    text = " ".join(
        [
            source.title or "",
            source.spot_name or "",
            source.section or "",
            source.snippet or "",
        ]
    )
    return "景区入口" in text or "路线起点" in text


def _compact_evidence_snippet(snippet: str, limit: int = 160) -> str:
    compact = " ".join((snippet or "").split())
    compact = re.sub(r"^(?:根据资料|资料显示|当前资料显示)[:：，,\s]*", "", compact)
    return compact[:limit]


def _evidence_sort_key(context, classification: dict | None = None) -> tuple[int, int, int, str]:
    source = context.source
    entity_names = {
        str(entity.get("name", "")).strip()
        for entity in (classification or {}).get("entities", [])
        if entity.get("name")
    }
    entity_rank = 0 if source.spot_name and source.spot_name in entity_names else 1
    fact_rank = 0 if _context_has_requested_fact_evidence(context, classification, list(entity_names)) else 1
    if source.section == "结构化事实" and source.source_type == "database":
        priority = 0
    elif source.section == "结构化事实":
        priority = 1
    elif source.section == "结构化标签":
        priority = 2
    elif source.source_type == "database" and source.spot_name:
        priority = 3
    elif source.source_type == "document":
        priority = 4
    elif source.source_type == "realtime_web":
        priority = 5
    else:
        priority = 6
    return (priority, fact_rank, entity_rank, source.spot_name or source.title)


def _context_has_requested_fact_evidence(context, classification: dict | None, entity_names: list[str]) -> bool:
    if not classification or context.source.source_type != "document":
        return False
    evidence_text = " ".join([context.text or "", context.source.snippet or ""])
    return any(
        _document_has_fact_evidence(evidence_text, fact_key, entity_names)
        for fact_key in classification.get("fact_keys", [])
    )


def _emotion_text(classification: dict) -> str:
    if classification.get("emotional"):
        return "游客表达了情绪或第一次到访等体验信息，可以简短安抚。"
    return "未识别到需要特别安抚的情绪。"
