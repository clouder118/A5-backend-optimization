# 游客感受度报告与运营数据大屏 PRD

Status: ready-for-agent

## Problem Statement

当前“灵山胜境 AI 数字人导览”系统已经具备游客端问答、管理端登录、问答日志和基础数据看板能力，但管理方仍缺少从交互记录中直接理解游客需求与服务质量的运营分析视角。

管理方需要知道：游客今天和本周被服务了多少次、问了哪些高频问题、主要关注哪些服务主题、情绪和满意度走势如何、哪些问题可能暴露服务短板，以及系统能给出什么运营建议。现有后台看板只有基础问答量、热门问题、热门景点、游客偏好和行为资料包摘要，尚不能形成“游客感受度报告”和“运营数据大屏概览”。

本次开发需要在现有 FastAPI + SQLite + React + Ant Design 架构中，基于已沉淀的 `ChatSession` 与 `ChatMessage` 交互记录，实时生成游客关注点分析、情感趋势、满意度趋势、热门问答语义聚类和服务建议，并同步适配现有管理端 `/dashboard` 页面。报告文本需要先由本地规则提取结构化数据，再使用项目 `.env` 中已有 MiMo LLM 配置做摘要增强；当 LLM 不可用、失败或返回不可解析内容时，系统必须降级为规则报告，保证后台可用。

## Solution

新增两个受管理员鉴权保护的后台运营分析接口：

- `GET /api/admin/operations/overview`
- `GET /api/admin/visitor-insights/report`

两个接口均支持固定时间范围参数：

- `range=today`
- `range=week`
- `range=7d`
- `range=30d`

第一版不新增数据库表，不做离线聚合任务，不做任意日期范围选择。所有分析都基于现有问答日志实时计算。

运营概览接口提供管理大屏所需核心指标：今日/本周服务人次、今日/本周问答量、平均满意度、情感趋势、满意度趋势、游客关注点 Top 分类、热门问答聚类和服务建议。

游客感受度报告接口提供更偏文本和洞察的分析结果：关注点分析、情感总结、满意度说明、服务建议、LLM 增强摘要状态。系统先用规则完成主题分类、情感识别、满意度推断、轻量归一化热门问答和基础建议，再在有 MiMo 配置时调用现有 MimoClient 进行报告摘要增强与热门问答语义聚类。

管理端不新增页面，在现有 `/dashboard` 页面中适配展示：

- 今日服务人次
- 本周服务人次
- 今日问答量
- 本周问答量
- 平均满意度
- 热门问答语义聚类
- 游客关注点分析
- 情感趋势
- 满意度趋势
- LLM 状态标签
- 游客感受度报告摘要
- 服务建议

空数据时接口返回完整结构，满意度字段为 `null`。前端显示空态或 `null`，不报错。

## User Stories

1. As an 管理员, I want to see 今日服务人次, so that I can understand same-day AI guide usage.
2. As an 管理员, I want to see 本周服务人次, so that I can understand weekly service reach.
3. As an 管理员, I want service people count based on distinct chat sessions, so that the number is closer to visitor service volume rather than raw message volume.
4. As an 管理员, I want to see 今日问答量, so that I can understand same-day interaction load.
5. As an 管理员, I want to see 本周问答量, so that I can compare short-term interaction activity.
6. As an 管理员, I want to see average inferred satisfaction, so that I can quickly judge visitor experience health.
7. As an 管理员, I want satisfaction to be `null` when there is no data, so that empty data is not mistaken for poor satisfaction.
8. As an 管理员, I want to see satisfaction trend by day, so that I can identify improving or worsening service perception.
9. As an 管理员, I want to see sentiment trend by day, so that I can identify positive, neutral and negative interaction changes.
10. As an 管理员, I want to see visitor concern topics, so that I know what visitors care about most.
11. As an 管理员, I want concern topics grouped into operational categories, so that I can take action on route, service, ticketing, transport or complaint risks.
12. As an 管理员, I want each concern topic to show count and share, so that I can compare topic weight.
13. As an 管理员, I want each concern topic to show sentiment distribution, so that I can spot negative concentration.
14. As an 管理员, I want representative questions for each concern topic, so that I can understand concrete visitor wording.
15. As an 管理员, I want service suggestions derived from high-frequency or negative topics, so that I can improve signage, content, routes or service communication.
16. As an 管理员, I want popular questions semantically clustered, so that similar questions are not scattered across the table.
17. As an 管理员, I want LLM unavailable cases to fall back to normalized exact grouping, so that popular questions still display.
18. As an 管理员, I want LLM clusters to have stable labels and representative questions, so that the dashboard remains readable.
19. As an 管理员, I want LLM-generated clusters validated against real questions, so that the report does not invent visitor concerns.
20. As an 管理员, I want a visitor sentiment report summary, so that I can brief management without reading every log.
21. As an 管理员, I want to know whether the report is LLM enhanced or rule-based fallback, so that I understand report confidence.
22. As an 管理员, I want LLM errors hidden behind safe status text, so that operational UI does not expose sensitive internal details.
23. As an 管理员, I want to switch between today, week, 7d and 30d, so that I can inspect different operating windows.
24. As an 管理员, I want the existing dashboard basic metrics to remain, so that current demo content is not lost.
25. As an 管理员, I want the new operational insights integrated into existing `/dashboard`, so that I do not need to learn a new menu page.
26. As an 管理员, I want empty data to show a clear empty state, so that a new demo database still looks intentional.
27. As a 后端开发者, I want analysis logic encapsulated in a testable service module, so that rules and LLM fallback can be tested without UI.
28. As a 后端开发者, I want API fields in English snake_case, so that contracts match the existing backend style.
29. As a 后端开发者, I want no new persistent table in the first version, so that changing analysis rules does not require migrations.
30. As a 后端开发者, I want admin authentication enforced on all operations insight endpoints, so that visitor interaction summaries are not public.
31. As a 后端开发者, I want fixed range parameters instead of arbitrary dates, so that timezone and empty range handling remain simple.
32. As a 后端开发者, I want MiMo LLM called through existing settings and client, so that no new model provider configuration is introduced.
33. As a 测试者, I want backend tests for rule-only data, LLM success, LLM failure and empty data, so that core behavior is stable.
34. As a 测试者, I want frontend build and admin verification to cover the dashboard adaptation, so that UI integration does not regress.
35. As an 演示操作者, I want the dashboard to continue loading even without model keys, so that demos remain reliable.

## Implementation Decisions

- 管理端前端只适配现有 `/dashboard` 页面，不新增管理端页面或菜单。
- 所有新增运营分析接口挂在 `/api/admin` 下，并沿用管理员鉴权。
- 新增接口为 `GET /api/admin/operations/overview` 和 `GET /api/admin/visitor-insights/report`。
- 两个接口均支持 `range=today|week|7d|30d`，非法 range 返回明确错误。
- 大屏概览默认范围为 `week`。
- 游客感受度报告默认范围为 `7d`。
- 第一版不新增数据库表，不做定时聚合，不做持久化分析结果。
- 数据来源为现有问答日志和会话记录。
- 服务人次按去重会话数统计，问答量按消息数统计。
- 今日和本周指标在概览中固定返回，和当前选择 range 可以同时存在。
- 空数据时返回完整结构，平均满意度为 `null`。
- API 字段统一使用英文 snake_case，前端负责中文展示。
- 关注点主题采用固定运营分类：景点讲解、路线规划、服务设施、票务开放、亲子老人、交通到达、投诉风险、其他咨询。
- 情感识别第一版使用规则关键词，结果为 `positive`、`neutral`、`negative`。
- 满意度第一版使用规则推断分数：正向高分、中性中分、负向低分。
- 服务建议第一版由规则生成，根据高频主题和负向主题输出。
- 热门问答第一步先做轻量归一化聚合。
- 如 LLM 可用，热门问答候选交给 MiMo 做语义聚类。
- LLM 语义聚类只接受固定 JSON 输出。
- 后端必须校验 LLM 聚类结果，不能接受不在候选问题内的编造问题。
- LLM 聚类失败或输出不可解析时，降级为轻量归一化热门问答。
- 报告摘要先由规则生成基础报告，再调用 MiMo 做自然语言增强。
- LLM 摘要失败、无 key 或不可用时，返回规则报告，不让接口失败。
- 报告响应包含 `generated_by`、`llm_status` 和安全的 `llm_error`。
- LLM 状态取值包括 `success`、`skipped_no_key`、`failed`。
- 前端显示低调 LLM 状态标签：LLM 增强、规则报告、规则兜底。
- 前端不展示 API key、堆栈或供应商内部错误。
- 不引入新的图表库，第一版使用 Ant Design 的 Statistic、Card、List、Progress、Tag、Table 等现有组件表达趋势与排行。
- 保留现有基础 dashboard 模块，同时新增或升级运营分析区域。
- 测试中的 LLM 调用必须 mock，不走真实网络。

建议响应结构的核心形状：

```json
{
  "range": "week",
  "period": {
    "start": "2026-06-15T00:00:00+08:00",
    "end": "2026-06-21T23:59:59+08:00"
  },
  "summary": {
    "today_service_sessions": 0,
    "week_service_sessions": 0,
    "today_questions": 0,
    "week_questions": 0,
    "range_service_sessions": 0,
    "range_questions": 0,
    "avg_satisfaction_score": null
  },
  "popular_question_clusters": [],
  "concern_topics": [],
  "sentiment_trend": [],
  "satisfaction_trend": [],
  "service_suggestions": [],
  "report": {
    "generated_by": "rule_based",
    "llm_status": "skipped_no_key",
    "summary": "当前时间范围内暂无游客交互记录。"
  }
}
```

## Testing Decisions

- 测试应验证外部行为和 API 合同，不测试内部 helper 的私有实现细节。
- 分析规则应封装为可测试的后端服务模块，测试覆盖给定聊天日志输入后的主题、情感、满意度、趋势和建议输出。
- API 测试应验证管理员鉴权、range 参数、空数据、普通数据、LLM 成功、LLM 失败和 LLM JSON 不合法降级。
- 热门问答语义聚类测试应 mock MiMo 返回，验证后端校验并只保留真实候选问题。
- LLM 摘要测试应 mock MiMo 成功和失败，验证 `llm_status` 与降级报告。
- 前端测试或验证脚本应覆盖 dashboard 能读取新增字段，并在空数据、规则兜底、LLM 增强状态下正常展示。
- 后端验证至少运行 `python -m pytest -q`。
- 前端验证至少运行 `npm run build`，必要时更新并运行管理端验证脚本。

## Out of Scope

- 不新增游客端点赞、点踩或评分入口。
- 不新增满意度数据库字段。
- 不新增运营分析持久化表。
- 不做定时任务、缓存刷新或离线报表生成。
- 不做任意 `start_date/end_date` 日期范围。
- 不新增管理端页面或菜单。
- 不引入 ECharts、AntV 或其他图表库。
- 不引入向量数据库或向量聚类。
- 不把 LLM 输出作为唯一数据源。
- 不向游客端开放运营分析接口。
- 不暴露 LLM 内部错误、API key 或敏感堆栈信息。

## Further Notes

- 本功能应继承项目“演示稳定优先”的策略。规则分析必须始终可用，LLM 只做增强。
- 管理端 dashboard 当前已有基础看板和资料包游客行为分析，本次应在此基础上增强，不应破坏原有模块。
- 后续如果增加真实游客评分或反馈按钮，应将真实反馈作为满意度主数据源，规则推断作为补充。
- 后续如果日志数据量增长，可考虑新增日聚合表或缓存层，但本 PRD 第一版不做。
