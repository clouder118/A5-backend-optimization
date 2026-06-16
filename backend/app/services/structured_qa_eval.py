import json
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.models import ApprovedWebFact


BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_EVALUATION_SET = BACKEND_ROOT / "evaluations" / "structured_qa_cases.json"
DEFAULT_SOURCE_PACKAGE_PATH = BACKEND_ROOT.parent / "Scenic Area Public Information Package"


class FakeEvaluationWebSearchProvider:
    def search(self, query: str, timeout_seconds: float) -> list[dict]:
        if "冲突" in query:
            return [
                {
                    "title": "灵山胜境官方公告",
                    "snippet": "梵宫开放时间以景区官方公告为准。",
                    "url": "https://www.lingshan.com/notice",
                    "source_level": "official",
                },
                {
                    "title": "权威旅游平台",
                    "snippet": "梵宫开放时间可能随活动安排调整。",
                    "url": "https://example.com/travel/fangong",
                    "source_level": "authoritative",
                },
            ]
        return [
            {
                "title": "灵山胜境官方票务",
                "snippet": "梵宫门票信息请以景区官方票务页面为准。",
                "url": "https://www.lingshan.com/tickets",
                "source_level": "official",
            }
        ]


def run_structured_qa_evaluation(
    database_url: str | None = None,
    evaluation_set_path: str | Path = DEFAULT_EVALUATION_SET,
) -> dict:
    evaluation_set = json.loads(Path(evaluation_set_path).read_text(encoding="utf-8"))
    with TemporaryDirectory() as temp_dir:
        db_url = database_url or f"sqlite:///{Path(temp_dir) / 'structured_qa_eval.db'}"
        app = create_app(
            Settings(
                database_url=db_url,
                source_package_path=str(DEFAULT_SOURCE_PACKAGE_PATH),
                llm_mode="mock",
                llm_api_key="",
                web_search_mode="provider",
                tts_mode="disabled",
            )
        )
        import app.services.chat as chat_service

        original_provider = chat_service.get_web_search_provider
        chat_service.get_web_search_provider = lambda settings: FakeEvaluationWebSearchProvider()
        try:
            with TestClient(app) as client:
                results = [
                    _run_case(client, case)
                    for case in evaluation_set["cases"]
                ]
        finally:
            chat_service.get_web_search_provider = original_provider

    summary = _summary(results)
    return {
        "ok": summary["failed"] == 0,
        "name": evaluation_set["name"],
        "summary": summary,
        "results": results,
    }


def _run_case(client: TestClient, case: dict) -> dict:
    _apply_setup(client, case.get("setup", {}))
    response = client.post("/api/chat", json={"question": case["question"]})
    body = response.json()
    expected = case["expected"]
    checks = _checks(body, expected)
    source_types = [source.get("source_type", "") for source in body.get("sources", [])]
    return {
        "id": case["id"],
        "category": case["category"],
        "question": case["question"],
        "passed": all(check["passed"] for check in checks),
        "checks": checks,
        "intent": body["metrics"]["classification"]["intent"],
        "source_types": source_types,
        "source_count": len(body.get("sources", [])),
        "web_supplement_required": body["metrics"].get("web_supplement_required", False),
        "web_supplement_status": body["metrics"].get("web_supplement_status", "not_required"),
        "database_hit": "database" in source_types,
        "approved_web_hit": "approved_web" in source_types,
        "realtime_web_hit": "realtime_web" in source_types,
        "fallback": len(body.get("sources", [])) == 0,
        "conflict_disclosure": _has_conflict_disclosure(body["answer"]),
    }


def _apply_setup(client: TestClient, setup: dict) -> None:
    fact = setup.get("approved_web_fact")
    if not fact:
        return
    session_factory = client.app.state.SessionLocal
    with session_factory() as session:
        session.add(ApprovedWebFact(**fact))
        session.commit()


def _checks(body: dict, expected: dict) -> list[dict]:
    sources = body.get("sources", [])
    source_types = {source.get("source_type", "") for source in sources}
    sections = {source.get("section", "") for source in sources}
    metrics = body.get("metrics", {})
    classification = metrics.get("classification", {})
    checks = [
        _check("intent", classification.get("intent") == expected.get("intent")),
        _check(
            "required_source_types",
            set(expected.get("required_source_types", [])).issubset(source_types),
        ),
        _check(
            "forbidden_source_types",
            source_types.isdisjoint(set(expected.get("forbidden_source_types", []))),
        ),
        _check(
            "required_sections",
            set(expected.get("required_sections", [])).issubset(sections),
        ),
        _check(
            "web_supplement_required",
            metrics.get("web_supplement_required", False)
            == expected.get("web_supplement_required", False),
        ),
    ]
    if "web_supplement_status" in expected:
        checks.append(
            _check(
                "web_supplement_status",
                metrics.get("web_supplement_status") == expected["web_supplement_status"],
            )
        )
    if "max_source_count" in expected:
        checks.append(_check("max_source_count", len(sources) <= expected["max_source_count"]))
    if expected.get("conflict_disclosure"):
        checks.append(_check("conflict_disclosure", _has_conflict_disclosure(body["answer"])))
    return checks


def _check(name: str, passed: bool) -> dict:
    return {"name": name, "passed": bool(passed)}


def _has_conflict_disclosure(answer: str) -> bool:
    return any(term in answer for term in ["差异", "不同来源", "不同联网来源", "冲突"])


def _summary(results: list[dict[str, Any]]) -> dict:
    return {
        "total": len(results),
        "passed": sum(1 for result in results if result["passed"]),
        "failed": sum(1 for result in results if not result["passed"]),
        "database_hit": sum(1 for result in results if result["database_hit"]),
        "approved_web_hit": sum(1 for result in results if result["approved_web_hit"]),
        "realtime_web_hit": sum(1 for result in results if result["realtime_web_hit"]),
        "fallback": sum(1 for result in results if result["fallback"]),
        "conflict_disclosure": sum(1 for result in results if result["conflict_disclosure"]),
        "source_count": sum(result["source_count"] for result in results),
    }
