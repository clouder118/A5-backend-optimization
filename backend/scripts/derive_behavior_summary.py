from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timedelta, UTC
import json
from pathlib import Path
import re
import zipfile
import xml.etree.ElementTree as ET


XLSX_NAME = "景点景区旅游数据行为分析数据.xlsx"
OUTPUT_NAME = "behavior_summary.json"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Derive compact visitor-behavior analytics from the public Excel package."
    )
    parser.add_argument("--source", required=True, help="Raw public source package path.")
    parser.add_argument("--output", required=True, help="Output knowledge/tabular path.")
    parser.add_argument("--top", type=int, default=8, help="Top-N rows for ranked summaries.")
    args = parser.parse_args()

    source_path = Path(args.source) / XLSX_NAME
    output_path = Path(args.output)
    if not source_path.exists():
        raise FileNotFoundError(f"Behavior Excel not found: {source_path}")

    summary = derive_summary(source_path, top_n=args.top)
    output_path.mkdir(parents=True, exist_ok=True)
    (output_path / OUTPUT_NAME).write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {output_path / OUTPUT_NAME}")


def derive_summary(xlsx_path: Path, top_n: int = 8) -> dict:
    shared_strings = _read_shared_strings(xlsx_path)
    records = 0
    gender_counter: Counter[str] = Counter()
    age_counter: Counter[str] = Counter()
    attraction_type_counter: Counter[str] = Counter()
    attraction_counter: Counter[str] = Counter()
    satisfaction_counter: Counter[str] = Counter()
    month_counter: Counter[str] = Counter()
    numeric_sums: defaultdict[str, float] = defaultdict(float)
    numeric_counts: defaultdict[str, int] = defaultdict(int)
    type_stats: defaultdict[str, dict[str, float]] = defaultdict(
        lambda: {
            "count": 0,
            "stay_sum": 0.0,
            "stay_count": 0,
            "cost_sum": 0.0,
            "cost_count": 0,
            "satisfaction_sum": 0.0,
            "satisfaction_count": 0,
        }
    )

    rows = _iter_rows(xlsx_path, shared_strings)
    headers = next(rows)
    header_map = {header: index for index, header in enumerate(headers)}

    for row in rows:
        records += 1
        gender = _text(row, header_map, "gender") or "未知"
        attraction_type = _text(row, header_map, "attraction_type") or "未知"
        attraction_name = _text(row, header_map, "attraction_name") or "未知景区"
        age = _number(row, header_map, "age")
        satisfaction = _number(row, header_map, "satisfaction")
        visit_date = _excel_date(row, header_map, "visit_date")

        gender_counter[gender] += 1
        age_counter[_age_group(age)] += 1
        attraction_type_counter[attraction_type] += 1
        attraction_counter[attraction_name] += 1
        if satisfaction is not None:
            satisfaction_counter[str(int(round(satisfaction)))] += 1
        if visit_date:
            month_counter[visit_date.strftime("%Y-%m")] += 1

        stats = type_stats[attraction_type]
        stats["count"] += 1

        for key in [
            "stay_duration",
            "ticket_cost",
            "food_cost",
            "shopping_cost",
            "transport_cost",
            "entertainment_cost",
            "total_cost",
            "group_size",
            "satisfaction",
        ]:
            value = _number(row, header_map, key)
            if value is None:
                continue
            numeric_sums[key] += value
            numeric_counts[key] += 1

        stay = _number(row, header_map, "stay_duration")
        if stay is not None:
            stats["stay_sum"] += stay
            stats["stay_count"] += 1

        cost = _number(row, header_map, "total_cost")
        if cost is not None:
            stats["cost_sum"] += cost
            stats["cost_count"] += 1

        if satisfaction is not None:
            stats["satisfaction_sum"] += satisfaction
            stats["satisfaction_count"] += 1

    type_rank = [
        {
            "label": label,
            "count": int(values["count"]),
            "avg_stay_duration": _avg(values["stay_sum"], values["stay_count"]),
            "avg_total_cost": _avg(values["cost_sum"], values["cost_count"]),
            "avg_satisfaction": _avg(
                values["satisfaction_sum"], values["satisfaction_count"]
            ),
        }
        for label, values in sorted(
            type_stats.items(), key=lambda item: item[1]["count"], reverse=True
        )
    ]

    return {
        "source_file": str(xlsx_path),
        "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "record_count": records,
        "field_count": len(headers),
        "usage_note": (
            "Excel 行为数据不进入 RAG 问答知识库；本摘要用于后台运营看板、"
            "游客画像说明和路线推荐依据展示。"
        ),
        "overall": {
            "avg_stay_duration": _metric(numeric_sums, numeric_counts, "stay_duration"),
            "avg_total_cost": _metric(numeric_sums, numeric_counts, "total_cost"),
            "avg_ticket_cost": _metric(numeric_sums, numeric_counts, "ticket_cost"),
            "avg_food_cost": _metric(numeric_sums, numeric_counts, "food_cost"),
            "avg_shopping_cost": _metric(numeric_sums, numeric_counts, "shopping_cost"),
            "avg_transport_cost": _metric(numeric_sums, numeric_counts, "transport_cost"),
            "avg_entertainment_cost": _metric(
                numeric_sums, numeric_counts, "entertainment_cost"
            ),
            "avg_group_size": _metric(numeric_sums, numeric_counts, "group_size"),
            "avg_satisfaction": _metric(numeric_sums, numeric_counts, "satisfaction"),
        },
        "gender_distribution": _rank(gender_counter, top_n),
        "age_distribution": [
            {"label": label, "count": age_counter[label]}
            for label in ["18岁以下", "18-25岁", "26-35岁", "36-45岁", "46-60岁", "60岁以上", "未知"]
            if age_counter[label]
        ],
        "attraction_type_distribution": _rank(attraction_type_counter, top_n),
        "top_attractions": _rank(attraction_counter, top_n),
        "satisfaction_distribution": [
            {"label": label, "count": satisfaction_counter[label]}
            for label in sorted(satisfaction_counter, key=lambda item: int(item))
        ],
        "peak_months": _rank(month_counter, top_n),
        "type_behavior": type_rank[:top_n],
        "insights": _insights(records, type_rank, numeric_sums, numeric_counts),
    }


def _read_shared_strings(xlsx_path: Path) -> list[str]:
    with zipfile.ZipFile(xlsx_path) as archive:
        try:
            with archive.open("xl/sharedStrings.xml") as shared_file:
                root = ET.parse(shared_file).getroot()
        except KeyError:
            return []

    values: list[str] = []
    for item in root.iter(NS + "si"):
        text = "".join(node.text or "" for node in item.iter(NS + "t"))
        values.append(text)
    return values


def _iter_rows(xlsx_path: Path, shared_strings: list[str]):
    sheet_path = "xl/worksheets/sheet1.xml"
    with zipfile.ZipFile(xlsx_path) as archive:
        with archive.open(sheet_path) as sheet_file:
            for _, row in ET.iterparse(sheet_file, events=("end",)):
                if row.tag != NS + "row":
                    continue
                values: dict[int, str] = {}
                max_index = -1
                for cell in row.iter(NS + "c"):
                    ref = cell.attrib.get("r", "")
                    col_index = _column_index(ref)
                    if col_index is None:
                        continue
                    max_index = max(max_index, col_index)
                    values[col_index] = _cell_value(cell, shared_strings)
                if max_index >= 0:
                    yield [values.get(index, "") for index in range(max_index + 1)]
                row.clear()


def _cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t", "")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.iter(NS + "t"))
    value = cell.find(NS + "v")
    if value is None or value.text is None:
        return ""
    if cell_type == "s":
        index = int(value.text)
        return shared_strings[index] if 0 <= index < len(shared_strings) else ""
    return value.text


def _column_index(ref: str) -> int | None:
    match = re.match(r"([A-Z]+)", ref)
    if not match:
        return None
    total = 0
    for char in match.group(1):
        total = total * 26 + (ord(char) - ord("A") + 1)
    return total - 1


def _text(row: list[str], header_map: dict[str, int], key: str) -> str:
    index = header_map.get(key)
    if index is None or index >= len(row):
        return ""
    return str(row[index]).strip()


def _number(row: list[str], header_map: dict[str, int], key: str) -> float | None:
    raw = _text(row, header_map, key)
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _excel_date(row: list[str], header_map: dict[str, int], key: str) -> datetime | None:
    raw = _text(row, header_map, key)
    if not raw:
        return None
    try:
        return datetime(1899, 12, 30) + timedelta(days=float(raw))
    except ValueError:
        try:
            return datetime.fromisoformat(raw)
        except ValueError:
            return None


def _age_group(age: float | None) -> str:
    if age is None:
        return "未知"
    if age < 18:
        return "18岁以下"
    if age <= 25:
        return "18-25岁"
    if age <= 35:
        return "26-35岁"
    if age <= 45:
        return "36-45岁"
    if age <= 60:
        return "46-60岁"
    return "60岁以上"


def _avg(total: float, count: float) -> float:
    return round(total / count, 2) if count else 0.0


def _metric(
    numeric_sums: dict[str, float], numeric_counts: dict[str, int], key: str
) -> float:
    return _avg(numeric_sums[key], numeric_counts[key])


def _rank(counter: Counter[str], limit: int) -> list[dict[str, int | str]]:
    return [
        {"label": label, "count": count}
        for label, count in counter.most_common(limit)
    ]


def _insights(
    records: int,
    type_rank: list[dict],
    numeric_sums: dict[str, float],
    numeric_counts: dict[str, int],
) -> list[str]:
    if not records or not type_rank:
        return ["暂未生成可用的行为数据结论。"]

    top_type = type_rank[0]
    long_stay = max(type_rank, key=lambda item: item["avg_stay_duration"])
    high_satisfaction = max(type_rank, key=lambda item: item["avg_satisfaction"])
    avg_stay = _metric(numeric_sums, numeric_counts, "stay_duration")
    avg_cost = _metric(numeric_sums, numeric_counts, "total_cost")
    return [
        f"资料包共纳入 {records} 条游客行为记录，可作为游客画像和运营看板的基线数据。",
        f"样本中占比最高的景区类型是“{top_type['label']}”，共有 {top_type['count']} 条记录。",
        f"平均停留时长约 {avg_stay} 小时，平均综合消费约 {avg_cost} 元。",
        f"“{long_stay['label']}”平均停留更久，适合支撑深度游或半日游推荐理由。",
        f"“{high_satisfaction['label']}”平均满意度较高，可作为热门体验类型参考。",
    ]


if __name__ == "__main__":
    main()
