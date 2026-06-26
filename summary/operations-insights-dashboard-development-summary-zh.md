# 游客数据分析与运营大屏版本开发总结

## 版本概览

本版本围绕 [游客感受度报告与运营数据大屏 PRD](../prd/operations-insights-dashboard.md) 完成了一轮完整开发，覆盖后端运营分析接口、游客感受度报告、MiMo LLM 增强、热门问答语义聚类、管理端 dashboard 展示、时间范围切换、空态处理和回归验证。

本次开发拆分为 6 个 issue，均已完成：

- [01-operations-overview-kpi-trends.md](../prd/operations-insights-dashboard-issues/01-operations-overview-kpi-trends.md)
- [02-concern-topics-and-rule-report.md](../prd/operations-insights-dashboard-issues/02-concern-topics-and-rule-report.md)
- [03-llm-enhanced-report-summary.md](../prd/operations-insights-dashboard-issues/03-llm-enhanced-report-summary.md)
- [04-llm-popular-question-clustering.md](../prd/operations-insights-dashboard-issues/04-llm-popular-question-clustering.md)
- [05-dashboard-range-and-empty-state-polish.md](../prd/operations-insights-dashboard-issues/05-dashboard-range-and-empty-state-polish.md)
- [06-regression-admin-operations-dashboard.md](../prd/operations-insights-dashboard-issues/06-regression-admin-operations-dashboard.md)

详细接口交接可继续参考 [operations-insights-dashboard-handoff-zh.md](operations-insights-dashboard-handoff-zh.md)。

## 游客数据分析功能说明

本版本的游客数据分析能力基于现有问答日志和会话记录实时计算，第一版不新增数据库表、不做离线任务、不引入新的图表库，优先保证演示稳定性。

已实现的数据分析能力包括：

- 运营概览：统计今日、本周和当前筛选范围内的服务人次、问答量和平均满意度。
- 服务人次统计：按去重会话数计算，更接近“被服务游客/会话”的运营口径。
- 问答量统计：按游客交互消息数量计算，反映导览系统使用负载。
- 情感趋势：按日期聚合正向、中性、负向交互趋势。
- 满意度趋势：基于规则推断满意度分数并按日期聚合；无样本时返回 `null`，不误显示为 0 分。
- 游客关注点分析：将游客问题归入景点讲解、路线规划、服务设施、票务开放、亲子老人、交通到达、投诉风险、其他咨询等运营分类。
- 代表问题提取：每个关注点主题返回代表性游客原始问题，方便管理方理解真实表达。
- 服务建议生成：根据高频主题和负向主题输出管理建议，例如优化路线说明、现场指引、服务设施信息或投诉风险闭环。
- 热门问答聚类：先做轻量归一化聚合，再在 LLM 可用时做语义聚类，避免相似问法在大屏上分散展示。
- 游客感受度摘要：先由规则生成基础报告，再使用 MiMo 兼容 LLM 对结构化数据做摘要增强。

## 规则分析实现细节

规则分析集中在 `backend/app/services/operations.py` 中实现。分析对象来自现有 `ChatMessage` 记录，规则会同时检索游客问题 `question` 和系统回答 `answer`，拼接后进行关键词匹配。第一版规则不依赖向量库、不新增分析表，所有结果在接口请求时实时计算。

### 时间范围规则

两个运营接口都支持固定范围：

- `today`：当天 00:00 到次日 00:00。
- `week`：本周周一 00:00 到次日 00:00。
- `7d`：包含当天在内的近 7 天。
- `30d`：包含当天在内的近 30 天。

非法范围会回退到接口默认值：运营概览默认 `week`，游客感受度报告默认 `7d`。

### 关注点主题归类与关键词

关注点主题按固定顺序匹配，命中前面的主题后不再继续向后匹配；未命中任何关键词时归入 `其他咨询`。

| 主题归类 | 检索关键词 |
| --- | --- |
| 投诉风险 | 投诉、失望、不好、太远、找不到、排队、不清楚 |
| 路线规划 | 路线、规划、游览、怎么走、多久、几小时、两小时、半日 |
| 景点讲解 | 讲解、大佛、梵宫、九龙灌浴、景点、看点、历史、文化 |
| 服务设施 | 卫生间、厕所、服务中心、寄存、餐厅、吃饭、母婴、轮椅 |
| 票务开放 | 门票、票价、多少钱、开放、营业、预约、入园 |
| 亲子老人 | 亲子、孩子、儿童、老人、长辈、推车、带娃 |
| 交通到达 | 交通、停车、停车场、公交、地铁、打车、入口、到达 |
| 其他咨询 | 无关键词兜底分类 |

每个关注点主题会归纳以下字段：

- `topic`：主题名称。
- `count`：该主题命中的问答数量。
- `share`：该主题占当前范围总问答量的比例，保留 4 位小数。
- `sentiment.positive`：正向数量。
- `sentiment.neutral`：中性数量。
- `sentiment.negative`：负向数量。
- `representative_questions`：最多 3 条不重复代表问题。

### 情感识别与满意度推断

情感识别同样检索 `question + answer`。

负向关键词：

```text
不好、太远、排队、贵、累、找不到、不清楚、投诉、失望
```

正向关键词：

```text
不错、喜欢、方便、满意、推荐、好玩、清楚
```

判断顺序为先负向、再正向、最后中性。因此同一条文本同时包含正负关键词时会优先归为 `negative`。满意度分数由情感结果推断：

- `positive`：85 分。
- `neutral`：70 分。
- `negative`：45 分。

平均满意度字段 `avg_satisfaction_score` 为当前范围内所有消息推断分的平均值，保留 2 位小数；无消息时返回 `null`。

### 服务建议生成规则

服务建议基于关注点主题列表生成：

- 当某主题 `count >= 2` 时，生成 `high_frequency_topic` 类型建议。
- 当某主题 `sentiment.negative > 0` 时，生成 `negative_topic` 类型建议。

高频主题建议当前覆盖：

- 路线规划：前置半日、一日、老人亲子等路线说明。
- 景点讲解：补充热门景点讲解卡片、看点提示和现场导览话术。
- 服务设施：强化卫生间、餐饮、寄存、服务中心等设施指引。
- 票务开放：同步展示票价、开放时间与预约说明。
- 亲子老人：突出无障碍、休息点、亲子服务和低强度路线。
- 交通到达：优化停车、公共交通、入口到达和换乘提示。
- 投诉风险：优先复盘现场服务短板并建立快速响应机制。
- 其他咨询：补充游客端常见问答并复查现场导览信息。

负向主题建议当前对投诉风险、路线规划、服务设施、交通到达有专门文案；其它主题使用通用负向反馈建议。

### 热门问答归一化与聚类字段

LLM 不可用或输出不可用时，热门问答使用本地轻量归一化聚合。归一化会移除空白和常见中英文标点，例如：

```text
空格、?、？、!、！、。、.、,、，、、；、;、：、:、（）、()、【】、[]、引号
```

归一化后的文本作为 fallback `cluster_label`。每个热门问答聚类返回：

- `cluster_label`：聚类标签。
- `representative_question`：代表问题。
- `questions`：该聚类下的原始问题列表。
- `count`：聚类命中次数。
- `intent_category`：由关注点主题规则得到的意图分类。
- `sentiment`：聚类主导情感，优先级为 `negative`、`positive`、`neutral`。

如果 MiMo LLM 可用，后端最多取 12 个候选问题发送给模型，并要求模型最多返回 8 个 clusters。后端会校验 LLM 输出只能使用候选问题原文，不能新增、改写或编造问题；校验失败时回退到本地归一化聚类。

### 接口字段归类

`/api/admin/operations/overview` 返回字段归类：

- 范围信息：`range`、`period.start`、`period.end`
- 核心指标：`summary.today_service_sessions`、`summary.week_service_sessions`、`summary.today_questions`、`summary.week_questions`、`summary.range_service_sessions`、`summary.range_questions`、`summary.avg_satisfaction_score`
- 情感趋势：`sentiment_trend[].date`、`positive`、`neutral`、`negative`
- 满意度趋势：`satisfaction_trend[].date`、`avg_satisfaction_score`

`/api/admin/visitor-insights/report` 返回字段归类：

- 范围信息：`range`、`period.start`、`period.end`
- 总量与分类：`total_questions`、`topic_categories`
- 关注点分析：`concern_topics[].topic`、`count`、`share`、`sentiment`、`representative_questions`
- 热门问答聚类：`popular_question_clusters[].cluster_label`、`representative_question`、`questions`、`count`、`intent_category`、`sentiment`
- 服务建议：`service_suggestions[].type`、`topic`、`message`
- 报告状态和摘要：`report.generated_by`、`report.llm_status`、`report.llm_error`、`report.summary`、`report.rule_summary`

## LLM 增强与降级策略

本版本延续项目“规则稳定、LLM 增强”的设计。

- 规则分析始终可用，是游客数据分析的基础结果。
- MiMo LLM 只用于增强摘要和热门问答语义聚类。
- LLM 成功时，管理端显示 `LLM 增强`。
- 未配置模型 key 或 LLM 模式不可用时，返回规则报告并显示 `规则报告`。
- LLM 调用失败、JSON 解析失败或聚类结果不可信时，降级为规则结果并显示 `规则兜底`。
- 后端会校验 LLM 聚类结果，聚类中的问题必须来自真实候选问题，避免编造游客问题。
- 前端不会展示 API key、堆栈信息或供应商内部错误，只展示安全状态。

## 管理端适配成果

管理端不新增页面，所有运营分析内容集成在现有 `/dashboard` 页面。

dashboard 已新增或增强：

- 时间范围切换：今日、本周、近 7 天、近 30 天。
- 核心运营 KPI：今日服务人次、本周服务人次、当前范围服务人次、游客满意度。
- 情感趋势区域。
- 满意度趋势区域。
- 游客关注点 Top 分类。
- 关注点代表问题。
- 游客感受度摘要。
- 服务建议列表。
- 热门问答聚类列表。
- LLM 状态标签。
- 空数据、加载中、错误状态展示。

原有基础 dashboard 模块仍保留，包括累计问答、景点数、路线数、知识库、热门问题、热门景点、游客偏好和近期日志等内容。

## 新增接口

两个新增接口均挂在 `/api/admin` 下，并受管理员鉴权保护。

### `GET /api/admin/operations/overview`

用途：提供运营大屏核心指标和趋势。

支持范围：

```text
range=today|week|7d|30d
```

默认范围：`week`

核心返回：

- 今日/本周服务人次
- 今日/本周问答量
- 当前范围服务人次
- 当前范围问答量
- 平均满意度
- 情感趋势
- 满意度趋势

### `GET /api/admin/visitor-insights/report`

用途：提供游客感受度报告、关注点分析、服务建议和热门问答聚类。

支持范围：

```text
range=today|week|7d|30d
```

默认范围：`7d`

核心返回：

- 关注点分类
- 关注点数量和占比
- 情感分布
- 代表问题
- 服务建议
- 热门问答聚类
- 报告摘要
- `generated_by`
- `llm_status`
- 安全 `llm_error`

## 技术栈总结

后端技术栈：

- FastAPI：后台接口。
- SQLAlchemy：读取现有 SQLite 会话和问答日志。
- SQLite：本地演示数据库。
- pytest：后端行为测试。
- MiMo 兼容 LLM client：摘要增强和语义聚类。

前端技术栈：

- React 18：管理端页面。
- Vite 6：构建和本地开发。
- TypeScript：接口类型和页面逻辑。
- Ant Design：Statistic、Card、List、Progress、Tag、Table 等管理端 UI 组件。
- Playwright：管理端自动化回归验证。

关键代码位置：

- 后端路由：`backend/app/api/admin.py`
- 后端服务：`backend/app/services/operations.py`
- 后端测试：`backend/tests/test_operations_overview.py`
- 后端测试：`backend/tests/test_visitor_insights_report.py`
- 前端 API：`frontend/src/api/dashboard.ts`
- 前端类型：`frontend/src/types/api.ts`
- 管理端页面：`frontend/src/pages/admin/AdminDashboardPage.tsx`
- 管理端验证：`frontend/scripts/verify-admin-flow.mjs`

## 验证情况

本版本最终回归结果：

- 后端完整测试通过：`102 passed`
- 前端构建通过：`npm run build`
- 管理端验证通过：`npm run verify:admin`
- 管理端验证脚本使用 mock API 和 mock 管理员登录态，不依赖真实 MiMo 网络调用。
- 本次验证生成的 `frontend/test-results/admin-flow` 已清理。

构建过程中仍存在项目既有提示：

- Noto Serif SC 字体资源在构建时有运行时解析提示。
- 前端主 chunk 大于 Vite 默认建议值。

以上为既有构建提示，本版本未将其作为运营分析开发范围处理。

## 后续建议

- 如果后续增加游客端点赞、点踩或评分入口，可将真实反馈作为满意度主数据源，规则推断作为补充。
- 如果问答日志规模继续增长，可考虑增加日聚合表、缓存层或后台定时任务。
- 如果管理端需要更强视觉表达，可在明确需求后评估是否引入图表库；当前版本刻意使用 Ant Design 组件保持轻量。
- 如果要继续扩展 LLM 能力，应继续保留规则兜底和真实问题校验，避免把 LLM 输出作为唯一数据源。

## 建议技能

后续继续开发该模块时，建议优先使用：

- `$tdd`：新增接口、分析规则、LLM 降级或 dashboard 行为时继续走红绿重构。
- `$diagnose`：当运营指标、趋势、LLM 状态或 dashboard 展示出现异常时，用于定位数据链路问题。
- `$to-issues`：当需要把后续反馈评分、图表库、缓存聚合等新需求拆成开发步骤时使用。
- `$handoff`：跨会话交接时继续更新总结文档，避免上下文丢失。
