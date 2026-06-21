# 运营概览核心指标与趋势闭环

Status: completed

## Parent

[游客感受度报告与运营数据大屏 PRD](../operations-insights-dashboard.md)

## What to build

实现第一条可用的运营大屏闭环：管理端通过受鉴权保护的运营概览接口获取服务人次、问答量、平均满意度、情感趋势和满意度趋势，并在现有 `/dashboard` 页面中展示这些核心指标。该切片以规则分析为基础，不依赖 LLM。

## Acceptance criteria

- [x] 新增受管理员鉴权保护的运营概览接口，未登录或游客 token 不可访问。
- [x] 接口支持 `range=today|week|7d|30d`，默认范围为 `week`。
- [x] 服务人次按去重会话数统计，问答量按消息数统计。
- [x] 响应包含今日/本周服务人次、今日/本周问答量、当前范围服务人次、当前范围问答量。
- [x] 响应包含按日期聚合的情感趋势和满意度趋势。
- [x] 空数据时返回完整结构，平均满意度为 `null`。
- [x] 管理端 dashboard 展示核心运营指标与趋势区域，并保留原有基础指标。
- [x] 后端测试覆盖有数据、空数据、range 参数和鉴权行为。

## Blocked by

None - can start immediately
