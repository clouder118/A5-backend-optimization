# Derived Knowledge Package

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
.\.venv\Scripts\python.exe scripts\derive_knowledge_package.py --source "..\Scenic Area Public Information Package" --output "..\knowledge"
```
