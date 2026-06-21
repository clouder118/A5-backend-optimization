# 热门问答语义聚类与降级展示

Status: completed

## Parent

[游客感受度报告与运营数据大屏 PRD](../operations-insights-dashboard.md)

## What to build

为运营大屏加入热门问答语义聚类。后端先做轻量归一化聚合，再将候选热门问题交给 MiMo LLM 生成固定 JSON 聚类；后端校验聚类结果，拒绝编造问题。LLM 不可用或输出不可解析时，降级为轻量归一化热门问答。管理端 dashboard 展示聚类标签、代表问题、次数、分类和情感。

## Acceptance criteria

- [x] 热门问题先经过轻量归一化聚合，形成候选集。
- [x] LLM 可用时最多取固定数量候选问题做语义聚类。
- [x] LLM 输出必须是固定 JSON 结构，解析失败时降级。
- [x] 后端校验 LLM 聚类中的问题必须来自候选集，不接受编造问题。
- [x] 响应包含 `cluster_label`、`representative_question`、`questions`、`count`、`intent_category`、`sentiment`。
- [x] 管理端 dashboard 展示热门问答聚类列表。
- [x] LLM 不可用时前端仍展示轻量归一化热门问答。
- [x] 后端测试覆盖 LLM 聚类成功、JSON 无效、编造问题和降级逻辑。

## Blocked by

- [01-operations-overview-kpi-trends.md](01-operations-overview-kpi-trends.md)
