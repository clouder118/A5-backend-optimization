from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


STRUCTURED_DOC_NAME = "灵山胜境 景点结构化数据集.docx"
GUIDE_DOC_NAME = "灵山胜境：历史、文化、景点特色与个性化游览指南.docx"

STRUCTURED_FIELDS = [
    "景区名称",
    "景点ID",
    "景点名称",
    "具体位置",
    "建筑/景观参数",
    "核心功能",
    "文化内涵",
    "详细介绍",
    "游玩亮点",
    "演艺/开放信息",
    "备注",
]

KNOWN_SPOT_IDS = {
    "灵山大照壁": "spot_ls_001",
    "五明桥": "spot_ls_002",
    "佛足坛": "spot_ls_003",
    "五智门": "spot_ls_004",
    "菩提大道": "spot_ls_005",
    "灵山大佛": "spot_ling_shan_buddha",
    "九龙灌浴": "spot_nine_dragons",
    "降魔浮雕": "spot_ls_007",
    "阿育王柱": "spot_ls_008",
    "百子戏弥勒": "spot_ls_009",
    "佛教文化博览馆": "spot_ls_012",
    "梵宫": "spot_brahma_palace",
    "灵山梵宫": "spot_brahma_palace",
    "五印坛城": "spot_five_mudra_mandala",
    "祥符禅寺": "spot_xiangfu_temple",
    "曼飞龙塔": "spot_ls_015",
    "无尽意斋": "spot_ls_016",
}

DEFAULT_APPROVED_WEB_FACTS = [
    {
        "entity_type": "spot",
        "entity_id": "spot_ling_shan_buddha",
        "fact_key": "height_meters",
        "fact_label": "高度",
        "fact_value": "88",
        "fact_unit": "米",
        "source_url": "https://www.lingshan.com.cn/web/park/introduction/1.html",
        "source_level": "official",
        "confidence": 0.9,
    }
]

DEFAULT_APPROVED_WEB_SOURCES = [
    {
        "domain": "lingshan.com.cn",
        "title": "灵山胜境官方网站",
        "source_level": "official",
        "allowed": True,
    },
    {
        "domain": "wuxi.gov.cn",
        "title": "无锡政府或文旅相关网站",
        "source_level": "government",
        "allowed": True,
    },
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Derive reviewed knowledge files from raw Ling Shan docs.")
    parser.add_argument("--source", required=True, help="Raw public information package path.")
    parser.add_argument("--output", required=True, help="Derived knowledge package output path.")
    args = parser.parse_args()

    source_path = Path(args.source)
    output_path = Path(args.output)
    records = _structured_records(source_path / STRUCTURED_DOC_NAME)
    guide_text = _extract_docx_text(source_path / GUIDE_DOC_NAME)
    _write_package(output_path, records, guide_text)
    print(
        json.dumps(
            {
                "status": "ok",
                "spot_docs": len(records),
                "output": str(output_path),
            },
            ensure_ascii=False,
        )
    )
    return 0


def _write_package(output_path: Path, records: list[dict[str, str]], guide_text: str) -> None:
    docs_path = output_path / "docs"
    curated_path = output_path / "curated"
    tabular_path = output_path / "tabular"
    docs_path.mkdir(parents=True, exist_ok=True)
    curated_path.mkdir(parents=True, exist_ok=True)
    tabular_path.mkdir(parents=True, exist_ok=True)

    for old_doc in docs_path.glob("*.md"):
        old_doc.unlink()

    for record in records:
        (docs_path / f"{record['景点ID']}-{record['景点名称']}.md").write_text(
            _spot_markdown(record),
            encoding="utf-8",
        )

    if guide_text:
        (docs_path / "灵山胜境-历史文化与游览指南.md").write_text(
            _guide_markdown(guide_text),
            encoding="utf-8",
        )

    _write_json(curated_path / "spots.json", _spots(records))
    _write_json(curated_path / "facts.json", _facts(records))
    _write_json(curated_path / "aliases.json", _aliases(records))
    _write_json(curated_path / "tags.json", _tags())
    _write_json(curated_path / "source_refs.json", _source_refs())
    _write_json(curated_path / "approved_web_sources.json", DEFAULT_APPROVED_WEB_SOURCES)
    _write_json(curated_path / "approved_web_facts.json", DEFAULT_APPROVED_WEB_FACTS)

    (output_path / "README.md").write_text(_package_readme(), encoding="utf-8")
    (curated_path / "README.md").write_text(_curated_readme(), encoding="utf-8")
    (tabular_path / "README.md").write_text(_tabular_readme(), encoding="utf-8")


def _structured_records(file_path: Path) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    for table in _extract_docx_tables(file_path):
        if not table or table[0] != STRUCTURED_FIELDS:
            continue
        for row in table[1:]:
            if len(row) != len(STRUCTURED_FIELDS):
                continue
            record = dict(zip(STRUCTURED_FIELDS, row))
            if re.fullmatch(r"(LS|NH)-\d{3}", record["景点ID"]):
                records.append(record)
    return records


def _spot_markdown(record: dict[str, str]) -> str:
    title = record["景点名称"]
    return "\n".join(
        [
            f"# {title}",
            "",
            f"- 景区名称：{record['景区名称']}",
            f"- 景点ID：{record['景点ID']}",
            f"- 具体位置：{record['具体位置']}",
            f"- 建筑/景观参数：{record['建筑/景观参数']}",
            f"- 核心功能：{record['核心功能']}",
            "",
            "## 文化内涵",
            record["文化内涵"],
            "",
            "## 详细介绍",
            record["详细介绍"],
            "",
            "## 游玩亮点",
            record["游玩亮点"],
            "",
            "## 演艺/开放信息",
            record["演艺/开放信息"],
            "",
            "## 备注",
            record["备注"],
            "",
        ]
    )


def _guide_markdown(text: str) -> str:
    return "\n".join(["# 灵山胜境：历史、文化、景点特色与个性化游览指南", "", text, ""])


def _spots(records: list[dict[str, str]]) -> list[dict]:
    return [
        {
            "raw_id": record["景点ID"],
            "entity_id": _spot_id(record),
            "name": record["景点名称"],
            "scenic_area": record["景区名称"],
            "location": record["具体位置"],
            "summary": _spot_summary(record),
            "story": record["详细介绍"],
            "tags": _spot_tags(record),
            "visit_minutes": _visit_minutes(record),
            "crowd_types": _crowd_types(record),
            "source_ref": "raw_doc_ling_shan_structured",
        }
        for record in records
    ]


def _facts(records: list[dict[str, str]]) -> list[dict]:
    facts: list[dict] = []
    for record in records:
        spot_id = _spot_id(record)
        if not spot_id:
            continue
        for key, label, field in [
            ("location", "具体位置", "具体位置"),
            ("structure_parameter", "建筑/景观参数", "建筑/景观参数"),
            ("core_function", "核心功能", "核心功能"),
            ("cultural_meaning", "文化内涵", "文化内涵"),
            ("visit_highlight", "游玩亮点", "游玩亮点"),
            ("performance_or_opening", "演艺/开放信息", "演艺/开放信息"),
            ("note", "备注", "备注"),
        ]:
            facts.append(_fact(spot_id, key, label, record[field]))

        height = _height_meters(record["建筑/景观参数"])
        if height:
            facts.append(_fact(spot_id, "height_meters", "高度", height, "米"))
    return _dedupe_facts(facts)


def _fact(
    spot_id: str,
    fact_key: str,
    fact_label: str,
    fact_value: str,
    fact_unit: str = "",
) -> dict:
    return {
        "spot_id": spot_id,
        "fact_key": fact_key,
        "fact_label": fact_label,
        "fact_value": fact_value,
        "fact_unit": fact_unit,
        "confidence": 1.0,
        "source_type": "database",
        "source_ref": "raw_doc_ling_shan_structured",
    }


def _aliases(records: list[dict[str, str]]) -> list[dict]:
    items: list[dict] = []
    for record in records:
        spot_id = _spot_id(record)
        if not spot_id:
            continue
        name = record["景点名称"]
        area_prefix = "拈花湾" if record["景点ID"].startswith("NH-") else "灵山"
        aliases = sorted({name, name.replace(area_prefix, ""), f"{area_prefix}{name}", f"无锡{name}"} - {""})
        items.append({"entity_type": "spot", "entity_id": spot_id, "aliases": aliases})
    return items


def _tags() -> list[dict]:
    return [
        {"tag": "摄影", "category": "visitor_intent", "aliases": ["拍照", "取景", "打卡"]},
        {"tag": "佛教文化", "category": "content_theme", "aliases": ["礼佛", "祈福", "文化讲解"]},
        {"tag": "室内", "category": "environment", "aliases": ["室内参观", "避雨", "休息"]},
        {"tag": "亲子", "category": "visitor_type", "aliases": ["孩子", "小朋友", "家庭"]},
        {"tag": "演艺", "category": "experience_type", "aliases": ["表演", "演出", "观看演出"]},
    ]


def _source_refs() -> list[dict]:
    return [
        {
            "id": "raw_doc_ling_shan_structured",
            "title": "灵山胜境 景点结构化数据集",
            "source_type": "docx",
            "path": "../Scenic Area Public Information Package/灵山胜境 景点结构化数据集.docx",
        },
        {
            "id": "raw_doc_ling_shan_guide",
            "title": "灵山胜境：历史、文化、景点特色与个性化游览指南",
            "source_type": "docx",
            "path": "../Scenic Area Public Information Package/灵山胜境：历史、文化、景点特色与个性化游览指南.docx",
        },
    ]


def _spot_id(record: dict[str, str]) -> str:
    return KNOWN_SPOT_IDS.get(record["景点名称"], f"spot_{record['景点ID'].lower().replace('-', '_')}")


def _height_meters(text: str) -> str:
    if "通高88米" in text:
        return "88"
    match = re.search(r"(?:总高|高|通高)(\d+(?:\.\d+)?)m", text)
    if match:
        return match.group(1)
    return ""


def _spot_summary(record: dict[str, str]) -> str:
    return f"{record['景点名称']}位于{record['具体位置']}"[:180]


def _spot_tags(record: dict[str, str]) -> list[str]:
    text = " ".join(record.values())
    tags = ["佛教文化"]
    if any(term in text for term in ["拍照", "拍摄", "打卡"]):
        tags.append("摄影")
    if any(term in text for term in ["亲子", "儿童", "孩童", "小朋友"]):
        tags.append("亲子")
    if any(term in text for term in ["室内", "馆内", "殿内", "堂内"]):
        tags.append("室内")
    if any(term in text for term in ["演出", "表演", "演艺"]):
        tags.append("演艺")
    return tags


def _visit_minutes(record: dict[str, str]) -> int:
    if record["景点名称"] in {"灵山大佛", "灵山梵宫"}:
        return 45
    if record["景点名称"] in {"佛教文化博览馆", "五印坛城", "祥符禅寺"}:
        return 35
    return 20


def _crowd_types(record: dict[str, str]) -> list[str]:
    tags = set(_spot_tags(record))
    crowd_types = ["历史文化游", "轻松游"]
    if "摄影" in tags:
        crowd_types.append("摄影游")
    if "亲子" in tags:
        crowd_types.append("亲子游")
    return crowd_types


def _dedupe_facts(facts: list[dict]) -> list[dict]:
    seen: set[tuple[str, str, str]] = set()
    deduped: list[dict] = []
    for fact in facts:
        key = (fact["spot_id"], fact["fact_key"], fact["fact_value"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(fact)
    return deduped


def _write_json(file_path: Path, data: list[dict]) -> None:
    file_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _extract_docx_text(file_path: Path) -> str:
    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    try:
        with zipfile.ZipFile(file_path) as docx:
            root = ET.fromstring(docx.read("word/document.xml"))
    except (KeyError, OSError, ET.ParseError, zipfile.BadZipFile):
        return ""

    paragraphs: list[str] = []
    for paragraph in root.iter(namespace + "p"):
        text = "".join(node.text or "" for node in paragraph.iter(namespace + "t")).strip()
        if text:
            paragraphs.append(text)
    return "\n".join(paragraphs)


def _extract_docx_tables(file_path: Path) -> list[list[list[str]]]:
    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    try:
        with zipfile.ZipFile(file_path) as docx:
            root = ET.fromstring(docx.read("word/document.xml"))
    except (KeyError, OSError, ET.ParseError, zipfile.BadZipFile):
        return []

    tables: list[list[list[str]]] = []
    for table_node in root.iter(namespace + "tbl"):
        rows: list[list[str]] = []
        for row_node in table_node.iter(namespace + "tr"):
            row: list[str] = []
            for cell_node in row_node.findall(namespace + "tc"):
                paragraphs: list[str] = []
                for paragraph in cell_node.findall(namespace + "p"):
                    text = "".join(
                        node.text or "" for node in paragraph.iter(namespace + "t")
                    ).strip()
                    if text:
                        paragraphs.append(text)
                row.append("\n".join(paragraphs))
            if row:
                rows.append(row)
        if rows:
            tables.append(rows)
    return tables


def _package_readme() -> str:
    return """# Derived Knowledge Package

This package contains reviewed Ling Shan knowledge derived from the raw public
information package.

Directory roles:

- `curated/`: structured JSON files for database import.
- `docs/`: Markdown narrative material generated from the Word sources.
- `tabular/`: notes for tabular data. The behavior-analysis spreadsheet is not
  imported into P0 because it is not directly useful for scenic guide answers.

Regenerate with:

```powershell
cd v1/backend
.\\.venv\\Scripts\\python.exe scripts\\derive_knowledge_package.py --source "..\\Scenic Area Public Information Package" --output "..\\knowledge"
```
"""


def _curated_readme() -> str:
    return """# Curated Structured Data

These JSON files are reviewed structured input for the backend database.

- `spots.json`: spot-level fields derived from the structured Word dataset.
- `aliases.json`: visitor-facing aliases for known backend scenic entities.
- `facts.json`: structured facts for known backend scenic entities.
- `tags.json`: controlled tags for retrieval and recommendation.
- `source_refs.json`: local source provenance for curated facts.
- `approved_web_sources.json`: reviewed web domains allowed as supplemental evidence.
- `approved_web_facts.json`: reviewed supplemental web facts kept separate from official facts.
"""


def _tabular_readme() -> str:
    return """# Tabular Notes

The source package contains `景点景区旅游数据行为分析数据.xlsx`.

For P0, this spreadsheet is intentionally not imported into the guide knowledge
database because it is broad behavior-analysis data rather than Ling Shan scenic
facts. Keep it structured for future analytics work instead of converting it to
free-form Markdown.
"""


if __name__ == "__main__":
    sys.exit(main())
