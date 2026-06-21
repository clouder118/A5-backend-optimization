# MiMo 增强游客感受度摘要

Status: completed

## Parent

[游客感受度报告与运营数据大屏 PRD](../operations-insights-dashboard.md)

## What to build

在规则报告基础上接入现有 MiMo LLM 配置，对结构化运营分析数据进行自然语言摘要增强。LLM 不可用、无 key、调用失败或输出不可用时，接口必须返回规则报告，并明确标记 LLM 状态。管理端 dashboard 显示低调的 LLM 状态标签。

## Acceptance criteria

- [x] 报告摘要先由规则生成基础内容，再在配置可用时调用现有 MiMo 客户端增强。
- [x] 响应包含 `generated_by`、`llm_status`、可选安全 `llm_error` 和摘要文本。
- [x] `llm_status=success` 时前端显示 “LLM 增强” 标签。
- [x] 无模型 key 或 LLM 模式不可用时返回规则报告，并显示 “规则报告” 标签。
- [x] LLM 调用失败时接口不报错，返回规则报告并显示 “规则兜底” 标签。
- [x] 前端不展示 API key、堆栈或供应商内部错误。
- [x] 后端测试 mock MiMo 成功、无 key、异常失败三种情况。

## Blocked by

- [02-concern-topics-and-rule-report.md](02-concern-topics-and-rule-report.md)
