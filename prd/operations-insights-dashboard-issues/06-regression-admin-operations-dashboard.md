# 运营分析大屏回归验证与文档同步

Status: completed

## Parent

[游客感受度报告与运营数据大屏 PRD](../operations-insights-dashboard.md)

## What to build

补齐运营分析大屏的回归验证和说明文档。确保后端测试、前端构建、管理端验证脚本覆盖新增 dashboard 行为，并将新接口、启动和验证方式同步到项目文档或交接摘要中。

## Acceptance criteria

- [x] 后端完整测试通过。
- [x] 前端构建通过。
- [x] 管理端验证脚本覆盖运营概览、游客感受度报告、热门问答聚类和 LLM 状态展示。
- [x] 验证脚本不依赖真实 MiMo 网络调用。
- [x] 文档说明新增两个后台运营分析接口和 dashboard 展示内容。
- [x] 文档说明 LLM 不可用时会降级为规则报告。
- [x] 确认没有新增 `.env`、数据库、日志、测试截图等运行产物进入源码范围。

## Blocked by

- [05-dashboard-range-and-empty-state-polish.md](05-dashboard-range-and-empty-state-polish.md)
