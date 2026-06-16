import json
import re
import sqlite3
import subprocess
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


SOURCE_PACKAGE_PATH = (
    Path(__file__).resolve().parents[2] / "Scenic Area Public Information Package"
)
SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "derive_knowledge_package.py"


def test_derive_knowledge_package_from_raw_word_sources(tmp_path):
    output_path = tmp_path / "knowledge"

    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT_PATH),
            "--source",
            str(SOURCE_PACKAGE_PATH),
            "--output",
            str(output_path),
        ],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )

    assert result.returncode == 0, result.stderr

    docs = sorted((output_path / "docs").glob("*.md"))
    facts = json.loads((output_path / "curated" / "facts.json").read_text(encoding="utf-8"))
    aliases = json.loads((output_path / "curated" / "aliases.json").read_text(encoding="utf-8"))
    source_refs = json.loads(
        (output_path / "curated" / "source_refs.json").read_text(encoding="utf-8")
    )

    spot_docs = [doc for doc in docs if doc.name.startswith(("LS-", "NH-"))]
    assert len(spot_docs) == 22
    assert (output_path / "docs" / "LS-011-灵山大佛.md").is_file()
    assert (output_path / "docs" / "LS-012-佛教文化博览馆.md").is_file()
    assert (output_path / "docs" / "LS-016-无尽意斋.md").is_file()
    assert (output_path / "docs" / "NH-001-拈花广场.md").is_file()
    assert (output_path / "docs" / "NH-006-鹿鸣谷.md").is_file()
    assert "佛像高88m" in (output_path / "docs" / "LS-011-灵山大佛.md").read_text(
        encoding="utf-8"
    )
    assert "佛教文化博览馆" not in (
        output_path / "docs" / "LS-011-灵山大佛.md"
    ).read_text(encoding="utf-8")
    assert any(
        fact["spot_id"] == "spot_ling_shan_buddha"
        and fact["fact_key"] == "height_meters"
        and fact["fact_value"] == "88"
        for fact in facts
    )
    assert any(item["entity_id"] == "spot_ling_shan_buddha" for item in aliases)
    assert any(item["id"] == "raw_doc_ling_shan_structured" for item in source_refs)


def test_derive_knowledge_package_preserves_complete_guide_doc_text(tmp_path):
    output_path = tmp_path / "knowledge"

    subprocess.run(
        [
            sys.executable,
            str(SCRIPT_PATH),
            "--source",
            str(SOURCE_PACKAGE_PATH),
            "--output",
            str(output_path),
        ],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )

    guide_docx = SOURCE_PACKAGE_PATH / "灵山胜境：历史、文化、景点特色与个性化游览指南.docx"
    guide_markdown = output_path / "docs" / "灵山胜境-历史文化与游览指南.md"
    markdown_text = _normalized_text(guide_markdown.read_text(encoding="utf-8"))

    missing_paragraphs = [
        paragraph
        for paragraph in _docx_paragraphs(guide_docx)
        if _normalized_text(paragraph) not in markdown_text
    ]

    assert missing_paragraphs == []


def test_backend_bootstrap_imports_derived_markdown_docs(tmp_path):
    output_path = tmp_path / "knowledge"
    db_path = tmp_path / "app.db"
    subprocess.run(
        [
            sys.executable,
            str(SCRIPT_PATH),
            "--source",
            str(SOURCE_PACKAGE_PATH),
            "--output",
            str(output_path),
        ],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )

    app = create_app(
        Settings(
            database_url=f"sqlite:///{db_path}",
            source_package_path=str(SOURCE_PACKAGE_PATH),
            derived_knowledge_path=str(output_path),
        )
    )
    with TestClient(app):
        pass

    with sqlite3.connect(db_path) as connection:
        derived_docs = {
            row[0]
            for row in connection.execute(
                """
                select title
                from knowledge_doc
                where id like 'derived_doc_%'
                """
            )
        }

    assert "LS-011-灵山大佛" in derived_docs
    assert "LS-016-无尽意斋" in derived_docs
    assert "NH-001-拈花广场" in derived_docs
    assert "NH-006-鹿鸣谷" in derived_docs
    assert "灵山胜境-历史文化与游览指南" in derived_docs
    assert len(derived_docs) == 23


def test_backend_bootstrap_imports_complete_guide_doc_text_into_database(tmp_path):
    output_path = tmp_path / "knowledge"
    db_path = tmp_path / "app.db"
    subprocess.run(
        [
            sys.executable,
            str(SCRIPT_PATH),
            "--source",
            str(SOURCE_PACKAGE_PATH),
            "--output",
            str(output_path),
        ],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )

    app = create_app(
        Settings(
            database_url=f"sqlite:///{db_path}",
            source_package_path=str(SOURCE_PACKAGE_PATH),
            derived_knowledge_path=str(output_path),
        )
    )
    with TestClient(app):
        pass

    with sqlite3.connect(db_path) as connection:
        rows = connection.execute(
            """
            select c.chunk_text
            from knowledge_doc d
            join knowledge_chunk c on c.doc_id = d.id
            where d.title in (
                '灵山胜境：历史、文化、景点特色与个性化游览指南',
                '灵山胜境-历史文化与游览指南'
            )
            order by d.id, c.chunk_index
            """
        ).fetchall()

    database_text = _normalized_text("\n".join(row[0] for row in rows))
    guide_docx = SOURCE_PACKAGE_PATH / "灵山胜境：历史、文化、景点特色与个性化游览指南.docx"
    missing_paragraphs = [
        paragraph
        for paragraph in _docx_paragraphs(guide_docx)
        if _normalized_text(paragraph) not in database_text
    ]

    assert missing_paragraphs == []


def test_backend_bootstrap_refreshes_stale_derived_markdown_docs(tmp_path):
    output_path = tmp_path / "knowledge"
    db_path = tmp_path / "app.db"
    subprocess.run(
        [
            sys.executable,
            str(SCRIPT_PATH),
            "--source",
            str(SOURCE_PACKAGE_PATH),
            "--output",
            str(output_path),
        ],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )

    app = create_app(
        Settings(
            database_url=f"sqlite:///{db_path}",
            source_package_path=str(SOURCE_PACKAGE_PATH),
            derived_knowledge_path=str(output_path),
        )
    )
    with TestClient(app):
        pass

    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """
            update knowledge_doc
            set title = '旧灵山大佛', path = 'old.md', content_hash = 'old'
            where id = 'derived_doc_001'
            """
        )
        connection.execute(
            """
            insert into knowledge_doc(id, title, source_type, path, content_hash, created_at)
            values ('derived_doc_999', '旧废弃文档', 'md', 'stale.md', 'stale', '2026-01-01')
            """
        )

    with TestClient(app):
        pass

    with sqlite3.connect(db_path) as connection:
        titles = {
            row[0]
            for row in connection.execute(
                """
                select title
                from knowledge_doc
                where id like 'derived_doc_%'
                """
            )
        }

    assert "旧灵山大佛" not in titles
    assert "旧废弃文档" not in titles
    assert "LS-001-灵山大照壁" in titles


def _docx_paragraphs(file_path: Path) -> list[str]:
    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    with zipfile.ZipFile(file_path) as docx:
        root = ET.fromstring(docx.read("word/document.xml"))
    paragraphs: list[str] = []
    for paragraph in root.iter(namespace + "p"):
        text = "".join(node.text or "" for node in paragraph.iter(namespace + "t")).strip()
        if text:
            paragraphs.append(text)
    return paragraphs


def _normalized_text(text: str) -> str:
    return re.sub(r"\s+", "", text)
