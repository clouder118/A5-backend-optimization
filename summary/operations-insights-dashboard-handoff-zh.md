# 运营分析大屏开发交接摘要

## 当前成果

本阶段已经在现有管理端数据看板内补齐「游客感受度报告」和「数据大屏概览」能力，不新增管理端页面。管理端仍从 `http://127.0.0.1:5174/` 进入，运营分析内容集成在 dashboard 首页。

已完成能力：

- 后端新增运营概览接口，按时间范围统计当日、本周、当前范围服务人次、问答量、满意度均值、情感趋势和满意度趋势。
- 后端新增游客感受度报告接口，基于问答日志规则抽取游客关注点、情感倾向、服务建议和热门问答聚类。
- 报告支持 MiMo 兼容 LLM 增强摘要和语义聚类；LLM 不可用、未配置或调用失败时，自动降级为本地规则报告。
- 管理端 dashboard 新增时间范围切换，支持 `today`、`week`、`7d`、`30d`。
- 管理端 dashboard 展示运营 KPI、情感趋势、满意度趋势、游客关注点分析、服务建议、热门问答聚类和 LLM 状态。
- 管理端自动验证脚本已覆盖运营概览、游客感受度报告、热门问答聚类、LLM 增强状态、LLM 失败降级和空数据状态。

## 技术栈与位置

- 后端：FastAPI、SQLAlchemy、SQLite、pytest。
- 前端：React 18、Vite 6、TypeScript、Ant Design、Playwright。
- 后端接口路由：`backend/app/api/admin.py`
- 后端业务服务：`backend/app/services/operations.py`
- 后端测试：`backend/tests/test_operations_overview.py`、`backend/tests/test_visitor_insights_report.py`
- 前端 API 客户端：`frontend/src/api/dashboard.ts`
- 管理端页面：`frontend/src/pages/admin/AdminDashboardPage.tsx`
- 管理端验证脚本：`frontend/scripts/verify-admin-flow.mjs`

## 新增后台接口

两个接口均需要管理端登录态，前端通过管理端 API client 携带 token 调用。

### `GET /api/admin/operations/overview`

查询参数：

```text
range=today|week|7d|30d
```

默认范围为 `week`。

返回内容包括：

- `summary.today_service_sessions`
- `summary.week_service_sessions`
- `summary.range_service_sessions`
- `summary.today_questions`
- `summary.week_questions`
- `summary.range_questions`
- `summary.avg_satisfaction_score`
- `sentiment_trend`
- `satisfaction_trend`

### `GET /api/admin/visitor-insights/report`

查询参数：

```text
range=today|week|7d|30d
```

默认范围为 `7d`。

返回内容包括：

- `topic_categories`
- `popular_question_clusters`
- `concern_topics`
- `service_suggestions`
- `report.generated_by`
- `report.llm_status`
- `report.summary`
- `report.rule_summary`
- `report.llm_error`

`report.generated_by` 当前可能为：

- `rule_based`
- `llm_enhanced`

`report.llm_status` 当前可能为：

- `success`
- `skipped_no_key`
- `failed`

LLM 不可用时，接口仍返回 200 和规则报告；`llm_error` 只暴露安全错误码，不返回密钥、堆栈或第三方原始异常。

## 管理端展示

管理端 dashboard 保留原有累计问答、景点数、路线数、知识库、热门问题、热门景点、问答日志等模块，并新增：

- 时间范围切换：今日、本周、近 7 天、近 30 天。
- 运营概览 KPI：今日服务人次、本周服务人次、范围服务人次、游客满意度。
- 情感趋势：正向、中性、负向趋势。
- 满意度趋势：按天展示满意度均值；无数据时展示 `null`。
- 游客关注点分析：展示关注主题、占比、代表问题和情感分布。
- 服务建议：按高频主题和负向主题生成管理建议。
- 热门问答聚类：展示聚类名称、代表问题、归类意图、情感和样例问题。
- LLM 状态：展示 `LLM 增强`、`规则报告` 或 `规则兜底`。

空数据场景下，dashboard 会展示空状态，不阻断管理端其它模块。

## 启动步骤

Windows 一键启动：

```bat
START-HERE.bat
```

停止服务：

```bat
stop-local.bat
```

启动后访问：

| 页面 | 地址 |
| --- | --- |
| 游客端首页 | http://127.0.0.1:5173/ |
| AI 导游页 | http://127.0.0.1:5173/guide |
| 管理后台 | http://127.0.0.1:5174/ |
| 后端接口 | http://127.0.0.1:8001 |
| Swagger 文档 | http://127.0.0.1:8001/docs |

## 验证命令

后端完整测试：

```powershell
cd backend
python -m pytest -q
```

前端构建：

```powershell
cd frontend
npm run build
```

管理端回归验证：

```powershell
cd frontend
npm run verify:admin
```

`verify:admin` 会以 `VITE_USE_MOCK_API=true` 启动管理端验证环境，并 mock 管理员登录态，不依赖真实 MiMo 网络调用。

## 运行产物说明

以下文件只属于本地运行产物，不应作为源码提交：

- `.env`、`.env.local`
- `*.db`、`*.sqlite`
- `*.log`
- `frontend/test-results/`
- 临时截图和浏览器测试输出

真实模型、TTS 或联网补充密钥只保存在本地环境变量或 `backend/.env`，不要写入仓库文档。
