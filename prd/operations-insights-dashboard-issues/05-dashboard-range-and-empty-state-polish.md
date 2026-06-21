# Dashboard 时间范围切换与空态体验

Status: completed

## Parent

[游客感受度报告与运营数据大屏 PRD](../operations-insights-dashboard.md)

## What to build

在管理端 dashboard 中加入 `today|week|7d|30d` 时间范围切换，并确保运营概览、游客感受度报告、热门问答聚类、关注点分析、趋势与建议都响应同一范围。完善空数据展示，满意度无样本时显示 `null` 或明确空态，不误显示 0 分。

## Acceptance criteria

- [x] Dashboard 提供范围切换控件，支持今日、本周、近 7 天、近 30 天。
- [x] 范围切换会重新请求运营概览和游客感受度报告。
- [x] 加载中、错误、空数据均有明确 UI 状态。
- [x] 空数据时满意度显示为 `null` 或与接口一致的空值表现，不显示为 0 分。
- [x] 原有基础 dashboard 模块仍可展示。
- [x] 前端 mock 数据覆盖 LLM 增强、规则兜底和空数据状态。
- [x] 前端构建通过。

## Blocked by

- [03-llm-enhanced-report-summary.md](03-llm-enhanced-report-summary.md)
- [04-llm-popular-question-clustering.md](04-llm-popular-question-clustering.md)
