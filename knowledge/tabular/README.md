# Tabular Behavior Data

The source package contains `景点景区旅游数据行为分析数据.xlsx`.

This spreadsheet has more than 140,000 cross-scenic-area visitor behavior
records. It is not imported into the RAG knowledge base because it is behavior
analytics data, not Ling Shan scenic explanation material. Importing it as text
chunks would slow retrieval and could pollute guide answers with unrelated
scenic spots.

For P1, the spreadsheet is used as a lightweight operations baseline:

- visitor age and gender distribution
- scenic-area type preference
- average stay duration, spend, group size, and satisfaction
- top attraction types and behavior insights

The compact derived file is:

```text
knowledge/tabular/behavior_summary.json
```

Regenerate it after replacing the raw public package:

```powershell
cd V1
.\backend\.venv\Scripts\python.exe backend\scripts\derive_behavior_summary.py --source "Scenic Area Public Information Package" --output "knowledge\tabular"
```

The admin dashboard reads this JSON and displays it as "资料包游客行为分析".
The raw Excel file remains read-only.
