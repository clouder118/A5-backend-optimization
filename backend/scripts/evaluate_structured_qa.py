import argparse
import json
from pathlib import Path
import sys


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.structured_qa_eval import run_structured_qa_evaluation


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the structured database-first AI guide Q&A evaluation set."
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help="Optional SQLAlchemy database URL. Defaults to a temporary SQLite DB.",
    )
    parser.add_argument(
        "--evaluation-set",
        default=str(BACKEND_ROOT / "evaluations" / "structured_qa_cases.json"),
        help="Path to the structured Q&A evaluation set JSON.",
    )
    parser.add_argument(
        "--output",
        default="",
        help="Optional path to write the JSON report.",
    )
    args = parser.parse_args()

    report = run_structured_qa_evaluation(
        database_url=args.database_url,
        evaluation_set_path=args.evaluation_set,
    )
    text = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(text, encoding="utf-8")
    print(text)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
