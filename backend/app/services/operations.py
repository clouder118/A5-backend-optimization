from __future__ import annotations

from collections import Counter
from datetime import UTC, date, datetime, time, timedelta
import json
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import ChatMessage
from app.services.mimo import MimoClient


VALID_RANGES = {"today", "week", "7d", "30d"}

CONCERN_TOPIC_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("投诉风险", ("投诉", "失望", "不好", "太远", "找不到", "排队", "不清楚")),
    ("路线规划", ("路线", "规划", "游览", "怎么走", "多久", "几小时", "两小时", "半日")),
    ("景点讲解", ("讲解", "大佛", "梵宫", "九龙灌浴", "景点", "看点", "历史", "文化")),
    ("服务设施", ("卫生间", "厕所", "服务中心", "寄存", "餐厅", "吃饭", "母婴", "轮椅")),
    ("票务开放", ("门票", "票价", "多少钱", "开放", "营业", "预约", "入园")),
    ("亲子老人", ("亲子", "孩子", "儿童", "老人", "长辈", "推车", "带娃")),
    ("交通到达", ("交通", "停车", "停车场", "公交", "地铁", "打车", "入口", "到达")),
    ("其他咨询", ()),
]


def build_operations_overview(db: Session, range_name: str = "week") -> dict:
    if range_name not in VALID_RANGES:
        range_name = "week"

    now = datetime.now(UTC)
    today = now.date()
    period_start = _period_start(today, range_name)
    period_end = datetime.combine(today + timedelta(days=1), time.min, tzinfo=UTC)
    trend_days = _trend_days(today, range_name)
    messages = db.scalars(select(ChatMessage)).all()

    today_messages = [message for message in messages if message.created_at.date() == today]
    week_start = _period_start(today, "week")
    week_messages = [
        message
        for message in messages
        if week_start <= _as_utc(message.created_at) < period_end
    ]
    range_messages = [
        message
        for message in messages
        if period_start <= _as_utc(message.created_at) < period_end
    ]

    return {
        "range": range_name,
        "period": {
            "start": period_start.isoformat(),
            "end": period_end.isoformat(),
        },
        "summary": {
            "today_service_sessions": _session_count(today_messages),
            "week_service_sessions": _session_count(week_messages),
            "today_questions": len(today_messages),
            "week_questions": len(week_messages),
            "range_service_sessions": _session_count(range_messages),
            "range_questions": len(range_messages),
            "avg_satisfaction_score": _avg_satisfaction(range_messages),
        },
        "sentiment_trend": _sentiment_trend(messages, trend_days),
        "satisfaction_trend": _satisfaction_trend(messages, trend_days),
    }


def build_visitor_insights_report(
    db: Session,
    range_name: str = "7d",
    settings: Settings | None = None,
) -> dict:
    if range_name not in VALID_RANGES:
        range_name = "7d"

    now = datetime.now(UTC)
    today = now.date()
    period_start = _period_start(today, range_name)
    period_end = datetime.combine(today + timedelta(days=1), time.min, tzinfo=UTC)
    messages = [
        message
        for message in db.scalars(select(ChatMessage)).all()
        if period_start <= _as_utc(message.created_at) < period_end
    ]

    concern_topics = _concern_topics(messages)
    service_suggestions = _service_suggestions(concern_topics)
    popular_question_clusters = _popular_question_clusters(messages, settings)
    rule_report = _rule_report(messages)
    report_payload = {
        "total_questions": len(messages),
        "concern_topics": concern_topics,
        "popular_question_clusters": popular_question_clusters,
        "service_suggestions": service_suggestions,
        "rule_report": rule_report,
    }

    return {
        "range": range_name,
        "period": {
            "start": period_start.isoformat(),
            "end": period_end.isoformat(),
        },
        "total_questions": len(messages),
        "topic_categories": [topic for topic, _ in CONCERN_TOPIC_RULES],
        "concern_topics": concern_topics,
        "popular_question_clusters": popular_question_clusters,
        "service_suggestions": service_suggestions,
        "report": _enhance_report_summary(settings, report_payload, rule_report),
    }


def _concern_topics(messages: list[ChatMessage]) -> list[dict]:
    if not messages:
        return []

    by_topic: dict[str, dict] = {}
    for message in messages:
        topic = _concern_topic(message)
        if topic not in by_topic:
            by_topic[topic] = {
                "topic": topic,
                "count": 0,
                "sentiment": Counter(),
                "representative_questions": [],
            }
        item = by_topic[topic]
        item["count"] += 1
        item["sentiment"][_sentiment(message)] += 1
        if (
            message.question not in item["representative_questions"]
            and len(item["representative_questions"]) < 3
        ):
            item["representative_questions"].append(message.question)

    topic_order = {topic: index for index, (topic, _) in enumerate(CONCERN_TOPIC_RULES)}
    return [
        {
            "topic": item["topic"],
            "count": item["count"],
            "share": round(item["count"] / len(messages), 4),
            "sentiment": {
                "positive": item["sentiment"]["positive"],
                "neutral": item["sentiment"]["neutral"],
                "negative": item["sentiment"]["negative"],
            },
            "representative_questions": item["representative_questions"],
        }
        for item in sorted(
            by_topic.values(),
            key=lambda value: (-value["count"], topic_order.get(value["topic"], 99)),
        )
    ]


def _concern_topic(message: ChatMessage) -> str:
    text = f"{message.question} {message.answer}"
    for topic, keywords in CONCERN_TOPIC_RULES:
        if topic == "其他咨询":
            continue
        if any(keyword in text for keyword in keywords):
            return topic
    return "其他咨询"


def _service_suggestions(concern_topics: list[dict]) -> list[dict]:
    suggestions: list[dict] = []
    for topic in concern_topics:
        if topic["count"] >= 2:
            suggestions.append(
                {
                    "type": "high_frequency_topic",
                    "topic": topic["topic"],
                    "message": _high_frequency_suggestion(topic["topic"]),
                }
            )
        if topic["sentiment"]["negative"] > 0:
            suggestions.append(
                {
                    "type": "negative_topic",
                    "topic": topic["topic"],
                    "message": _negative_topic_suggestion(topic["topic"]),
                }
            )
    return suggestions


def _popular_question_clusters(
    messages: list[ChatMessage],
    settings: Settings | None,
) -> list[dict]:
    fallback_clusters = _normalized_question_clusters(messages)
    if not fallback_clusters:
        return []
    if settings is None or settings.llm_mode != "openai_compatible" or not settings.llm_api_key:
        return fallback_clusters
    try:
        candidates = _cluster_candidates(messages)[:12]
        client = MimoClient(settings.llm_base_url, settings.llm_api_key)
        raw = client.chat_completion(
            model=settings.llm_model,
            system_prompt=_question_cluster_system_prompt(),
            user_prompt=_question_cluster_user_prompt(candidates),
        )
        return _validated_llm_question_clusters(raw, candidates) or fallback_clusters
    except Exception:
        return fallback_clusters


def _cluster_candidates(messages: list[ChatMessage]) -> list[dict]:
    by_question: dict[str, dict] = {}
    for message in messages:
        question = message.question
        if question not in by_question:
            by_question[question] = {
                "question": question,
                "count": 0,
                "intent_category": _concern_topic(message),
                "sentiments": Counter(),
            }
        item = by_question[question]
        item["count"] += 1
        item["sentiments"][_sentiment(message)] += 1
    return [
        {
            "question": item["question"],
            "count": item["count"],
            "intent_category": item["intent_category"],
            "sentiment": _dominant_sentiment(item["sentiments"]),
        }
        for item in sorted(by_question.values(), key=lambda value: (-value["count"], value["question"]))
    ]


def _question_cluster_system_prompt() -> str:
    return (
        "你是景区运营热门问答语义聚类助手。必须输出严格 JSON，格式为："
        "{\"clusters\":[{\"cluster_label\":\"...\",\"representative_question\":\"...\","
        "\"questions\":[\"...\"],\"intent_category\":\"...\"}]}。"
        "只能使用候选问题中的原文，不允许编造、改写或新增问题。"
    )


def _question_cluster_user_prompt(candidates: list[dict]) -> str:
    return (
        "请对以下候选热门问题做语义聚类，最多返回 8 个 clusters：\n"
        f"{json.dumps(candidates, ensure_ascii=False)}"
    )


def _validated_llm_question_clusters(raw: str, candidates: list[dict]) -> list[dict]:
    data = json.loads(raw)
    clusters = data.get("clusters")
    if not isinstance(clusters, list):
        return []
    candidate_by_question = {item["question"]: item for item in candidates}
    validated: list[dict] = []
    used_questions: set[str] = set()
    for cluster in clusters[:8]:
        questions = cluster.get("questions")
        representative_question = cluster.get("representative_question")
        cluster_label = str(cluster.get("cluster_label") or "").strip()
        intent_category = str(cluster.get("intent_category") or "").strip()
        if not cluster_label or not representative_question or not isinstance(questions, list):
            return []
        if representative_question not in candidate_by_question:
            return []
        if not questions or any(question not in candidate_by_question for question in questions):
            return []
        unique_questions = [question for question in questions if question not in used_questions]
        if not unique_questions:
            continue
        used_questions.update(unique_questions)
        sentiments = Counter()
        count = 0
        for question in unique_questions:
            candidate = candidate_by_question[question]
            count += int(candidate["count"])
            sentiments[candidate["sentiment"]] += int(candidate["count"])
        validated.append(
            {
                "cluster_label": cluster_label,
                "representative_question": representative_question,
                "questions": unique_questions,
                "count": count,
                "intent_category": intent_category or candidate_by_question[representative_question]["intent_category"],
                "sentiment": _dominant_sentiment(sentiments),
            }
        )
    return sorted(validated, key=lambda item: (-item["count"], item["cluster_label"]))


def _normalized_question_clusters(messages: list[ChatMessage]) -> list[dict]:
    grouped: dict[str, dict] = {}
    for message in messages:
        key = _normalize_question(message.question)
        if not key:
            continue
        if key not in grouped:
            grouped[key] = {
                "cluster_label": key,
                "representative_question": message.question,
                "questions": [],
                "count": 0,
                "intent_category": _concern_topic(message),
                "sentiments": Counter(),
            }
        item = grouped[key]
        item["questions"].append(message.question)
        item["count"] += 1
        item["sentiments"][_sentiment(message)] += 1

    clusters = []
    for item in grouped.values():
        sentiments = item.pop("sentiments")
        clusters.append(
            {
                **item,
                "sentiment": _dominant_sentiment(sentiments),
            }
        )
    return sorted(clusters, key=lambda item: (-item["count"], item["representative_question"]))[:8]


def _normalize_question(question: str) -> str:
    text = re.sub(r"[\s?？!！。.,，、；;：:（）()【】\[\]\"'“”‘’]+", "", question)
    return text.strip()


def _dominant_sentiment(sentiments: Counter[str]) -> str:
    for sentiment in ("negative", "positive", "neutral"):
        if sentiments[sentiment]:
            return sentiment
    return "neutral"


def _high_frequency_suggestion(topic: str) -> str:
    messages = {
        "路线规划": "路线规划咨询较集中，建议在游客端和现场导览中前置半日、一日、老人亲子等路线说明。",
        "景点讲解": "景点讲解咨询较集中，建议补充热门景点的讲解卡片、看点提示和现场导览话术。",
        "服务设施": "服务设施咨询较集中，建议强化卫生间、餐饮、寄存、服务中心等设施指引。",
        "票务开放": "票务开放咨询较集中，建议在入口和游客端同步展示票价、开放时间与预约说明。",
        "亲子老人": "亲子老人咨询较集中，建议突出无障碍、休息点、亲子服务和低强度路线。",
        "交通到达": "交通到达咨询较集中，建议优化停车、公共交通、入口到达和换乘提示。",
        "投诉风险": "投诉风险咨询较集中，建议优先复盘现场服务短板并建立快速响应机制。",
    }
    return messages.get(topic, "其他咨询较集中，建议补充游客端常见问答并复查现场导览信息。")


def _negative_topic_suggestion(topic: str) -> str:
    messages = {
        "投诉风险": "投诉风险出现负向反馈，建议管理方复查现场服务、排队动线和指引信息，优先闭环代表问题。",
        "路线规划": "路线规划出现负向反馈，建议检查路线推荐是否充分考虑体力、时长和绕行成本。",
        "服务设施": "服务设施出现负向反馈，建议复核设施位置、开放状态和现场标识是否清晰。",
        "交通到达": "交通到达出现负向反馈，建议检查停车、入口、换乘和到达指引是否容易理解。",
    }
    return messages.get(topic, f"{topic}出现负向反馈，建议管理方复查相关服务说明和现场执行。")


def _rule_report(messages: list[ChatMessage]) -> dict:
    if not messages:
        summary = "当前时间范围内暂无游客交互记录。"
    else:
        summary = f"当前时间范围内共分析 {len(messages)} 条游客问答记录，报告由本地规则生成。"
    return {
        "generated_by": "rule_based",
        "llm_status": "skipped_no_key",
        "summary": summary,
        "rule_summary": "规则报告基于问答文本关键词识别关注点、情感倾向和服务建议。",
    }


def _enhance_report_summary(
    settings: Settings | None,
    payload: dict,
    rule_report: dict,
) -> dict:
    if settings is None:
        return rule_report
    if settings.llm_mode != "openai_compatible" or not settings.llm_api_key:
        return rule_report

    try:
        client = MimoClient(settings.llm_base_url, settings.llm_api_key)
        summary = client.chat_completion(
            model=settings.llm_model,
            system_prompt=_report_summary_system_prompt(),
            user_prompt=_report_summary_user_prompt(payload),
        ).strip()
        if not summary:
            raise ValueError("empty_llm_summary")
        return {
            **rule_report,
            "generated_by": "llm_enhanced",
            "llm_status": "success",
            "summary": summary[:800],
        }
    except Exception:
        return {
            **rule_report,
            "llm_status": "failed",
            "llm_error": "llm_summary_failed",
        }


def _report_summary_system_prompt() -> str:
    return (
        "你是景区运营分析助手。请只基于给定的结构化运营数据生成中文管理摘要，"
        "不要编造数据，不要输出 API key、堆栈、供应商错误或内部实现细节。"
        "摘要应简洁，包含主要关注点、情绪风险和服务改进方向。"
    )


def _report_summary_user_prompt(payload: dict) -> str:
    return (
        "请将以下游客感受度规则分析数据改写为一段适合管理端展示的运营摘要：\n"
        f"{json.dumps(payload, ensure_ascii=False)}"
    )


def _period_start(today: date, range_name: str) -> datetime:
    if range_name == "today":
        start_date = today
    elif range_name == "week":
        start_date = today - timedelta(days=today.weekday())
    elif range_name == "30d":
        start_date = today - timedelta(days=29)
    else:
        start_date = today - timedelta(days=6)
    return datetime.combine(start_date, time.min, tzinfo=UTC)


def _trend_days(today: date, range_name: str) -> list[date]:
    start = _period_start(today, range_name).date()
    return [start + timedelta(days=offset) for offset in range((today - start).days + 1)]


def _session_count(messages: list[ChatMessage]) -> int:
    return len({message.session_id for message in messages})


def _avg_satisfaction(messages: list[ChatMessage]) -> float | None:
    scores = [_satisfaction_score(message) for message in messages]
    if not scores:
        return None
    return round(sum(scores) / len(scores), 2)


def _sentiment_trend(messages: list[ChatMessage], days: list[date]) -> list[dict]:
    by_day: dict[str, Counter[str]] = {day.isoformat(): Counter() for day in days}
    for message in messages:
        day_key = message.created_at.date().isoformat()
        if day_key in by_day:
            by_day[day_key][_sentiment(message)] += 1
    return [
        {
            "date": day.isoformat(),
            "positive": by_day[day.isoformat()]["positive"],
            "neutral": by_day[day.isoformat()]["neutral"],
            "negative": by_day[day.isoformat()]["negative"],
        }
        for day in days
    ]


def _satisfaction_trend(messages: list[ChatMessage], days: list[date]) -> list[dict]:
    return [
        {
            "date": day.isoformat(),
            "avg_satisfaction_score": _avg_satisfaction(
                [message for message in messages if message.created_at.date() == day]
            ),
        }
        for day in days
    ]


def _sentiment(message: ChatMessage) -> str:
    text = f"{message.question} {message.answer}"
    if any(word in text for word in ["不好", "太远", "排队", "贵", "累", "找不到", "不清楚", "投诉", "失望"]):
        return "negative"
    if any(word in text for word in ["不错", "喜欢", "方便", "满意", "推荐", "好玩", "清楚"]):
        return "positive"
    return "neutral"


def _satisfaction_score(message: ChatMessage) -> int:
    sentiment = _sentiment(message)
    if sentiment == "positive":
        return 85
    if sentiment == "negative":
        return 45
    return 70


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
