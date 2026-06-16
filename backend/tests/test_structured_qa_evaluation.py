import json
from pathlib import Path

from app.services.structured_qa_eval import run_structured_qa_evaluation


EVALUATION_SET = Path(__file__).resolve().parents[1] / "evaluations" / "structured_qa_cases.json"


def test_structured_qa_evaluation_set_covers_major_categories():
    cases = json.loads(EVALUATION_SET.read_text(encoding="utf-8"))["cases"]
    categories = {case["category"] for case in cases}

    assert {
        "database_fact",
        "tag_preference",
        "document_explanation",
        "missing_fact_web",
        "approved_web",
        "web_conflict",
        "casual",
        "mixed_emotional_fact",
    }.issubset(categories)
    assert all("required_source_types" in case["expected"] for case in cases)
    assert all("exact_answer" not in case["expected"] for case in cases)


def test_structured_qa_evaluation_runs_without_real_llm_or_web(tmp_path):
    report = run_structured_qa_evaluation(
        database_url=f"sqlite:///{tmp_path / 'eval.db'}",
        evaluation_set_path=EVALUATION_SET,
    )

    assert report["ok"] is True
    assert report["summary"]["total"] >= 8
    assert report["summary"]["passed"] == report["summary"]["total"]
    assert report["summary"]["database_hit"] >= 1
    assert report["summary"]["approved_web_hit"] >= 1
    assert report["summary"]["realtime_web_hit"] >= 1
    assert report["summary"]["fallback"] >= 1
    assert report["summary"]["conflict_disclosure"] >= 1
    assert all(result["source_count"] >= 0 for result in report["results"])
