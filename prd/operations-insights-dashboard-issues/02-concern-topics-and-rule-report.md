# 游客关注点分类与规则报告闭环

Status: completed

## Parent

[游客感受度报告与运营数据大屏 PRD](../operations-insights-dashboard.md)

## What to build

在运营分析中加入游客关注点主题分类、代表问题、情感分布、规则服务建议和游客感受度报告接口。管理端 dashboard 在同一页面展示关注点分析和规则报告内容。

## Acceptance criteria

- [x] 新增受管理员鉴权保护的游客感受度报告接口，默认范围为 `7d`。
- [x] 报告接口支持 `range=today|week|7d|30d`。
- [x] 规则分类覆盖景点讲解、路线规划、服务设施、票务开放、亲子老人、交通到达、投诉风险、其他咨询。
- [x] 每个关注点主题返回数量、占比、情感分布和代表问题。
- [x] 服务建议由高频主题和负向主题规则生成。
- [x] 空数据时返回完整结构、空数组和清晰规则说明。
- [x] 管理端 dashboard 展示关注点 Top 分类、代表问题、规则摘要和服务建议。
- [x] 后端测试覆盖主题分类、投诉风险识别、服务建议和空数据报告。

## Blocked by

- [01-operations-overview-kpi-trends.md](01-operations-overview-kpi-trends.md)
