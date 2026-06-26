# A5 双端口整合与数字人对话优化交接总结

生成时间：2026-06-26

## 1. 背景与范围

本轮工作以当前项目为基础，整合同事版本 `A5-backend-optimization-1b9d7783d4b1bc7df41978351fd3a4dbb92d491c/` 中的双端口分离、游客/管理端鉴权、管理端数据大屏等能力，同时保留当前版本已有的游客端业务体验、路线导航链路、Live2D Haru 数字人导游和来源可追溯问答能力。

需求边界已在 PRD 中沉淀，后续如需追溯完整需求，请优先阅读：

- `PRD/integration-dual-entry-dashboard-auth-prd-zh.md`

本总结只记录本次已经完成的实现成果、优化内容、验证结果和后续交接注意点。

## 2. 整合成果概览

### 双端口入口

项目现在采用游客端与管理端分离的运行方式：

- 游客端：`http://127.0.0.1:5173/`
- AI 导游：`http://127.0.0.1:5173/guide`
- 管理端：`http://127.0.0.1:5174/`
- 后端：`http://127.0.0.1:8001`
- 后端文档：`http://127.0.0.1:8001/docs`

游客端不再展示管理端入口，顶部菜单移除了 `[ OPS ]`。游客端访问 `/admin` 不会进入管理界面；管理端独立从 `5174` 访问，管理路由使用根级路径，例如 `/login`、`/dashboard`、`/spots`、`/routes`、`/knowledge`、`/logs`。

### 游客端保护

游客端新增登录/注册保护。未登录用户只能看到首页和登录注册入口，不能访问：

- `/spots`
- `/spots/:spotId`
- `/routes`
- `/route-drafts/:draftId`
- `/tour/:tourId`
- `/tour/:tourId/recap`
- `/guide`

游客业务 API 仍保持原访问方式，保护主要发生在前端页面入口层；管理端 API 使用后端 Bearer token 鉴权。

### 管理端鉴权

后端新增统一认证能力：

- 游客注册/登录
- 管理员登录
- `/api/auth/me`
- 管理端 Bearer token 校验
- 默认管理员初始化
- 可选兼容旧 `x-admin-token` 模式

管理端页面会在本地保存 admin token，并在访问管理 API 时自动携带 Bearer token。无 token、过期 token、游客 token 访问管理接口都会被拒绝。

### 管理数据大屏

同事版本的数据大屏能力已整合进现有 `dashboard`，没有新增独立页面。后端并入了运营概览和游客洞察相关服务与接口，包括：

- `/api/admin/operations/overview`
- `/api/admin/visitor-insights/report`

管理端 dashboard 现在可以展示更完整的运营指标、问答趋势、游客洞察、来源统计等内容。

### 游客路线导航链路

路线导航相关能力以当前版本为准，保留并继续可用：

- 路线推荐
- 地图与 `map_id`
- 路线草稿 `/route-drafts/:draftId`
- 游览中 `/tour/:tourId`
- 游览回顾 `/tour/:tourId/recap`
- 当前版本路线、地图、tour/session/recap 后端能力

这部分没有被同事版本覆盖，避免破坏已有游客端核心演示链路。

## 3. 数字人对话实现与优化

当前数字人对话仍以本项目已有的沉浸式 Haru 导游体验为主，不采用同事版本的控制台式导游页。页面结构是：

- 左侧 Haru Live2D 数字人舞台
- 中间聊天窗口
- 右侧三个快速问题入口

主要调用链为：

`/guide` 页面 -> `AiGuidePage` -> `streamChatWithGuide` -> `/api/chat/stream` -> 后端 RAG/LLM/TTS -> SSE 返回 `delta/final` -> 前端展示回答、来源卡片和语音播放入口 -> `AvatarGuide` 驱动 Haru 状态。

数字人状态包括：

- `idle` 待命
- `thinking` 检索/生成中
- `speaking` 播报中
- `sleep` 空闲休眠
- `wake` 唤醒
- `tap` 点击反馈
- `fallback` 异常/兜底提示

对话后端仍采用结构化优先策略：

1. 问题分类。
2. 优先检索结构化事实、景点资料、标签、别名、知识片段。
3. 证据不足且属于实时/外部事实时，触发联网补充。
4. 使用 MiMo/OpenAI-compatible LLM 生成游客友好回答。
5. 返回答案、来源、指标、降级状态和 TTS 状态。
6. 保存问答日志，供管理端 dashboard 和日志页面使用。

### 本轮新增的对话来源优化

本轮最后补充了一个针对外部实时问题的来源可见性规则：

当问题类似“今天北京的天气怎么样？”这类外部实时问题时，后端仍可内部检索景区资料辅助判断，但返回给前端展示的 `sources` 只保留 `source_type == "realtime_web"` 的联网来源。

这样可以避免前端来源卡片出现与问题无关的“灵山胜境景点资料”“景点结构化数据集”等内容。

相关实现点：

- `backend/app/services/chat.py`
- 新增 `_visible_sources(...)`
- `/api/chat` 和 `/api/chat/stream` 均使用该来源过滤逻辑

相关测试：

- `backend/tests/test_chat.py::test_weather_question_uses_realtime_web_without_scenic_entity`

该测试已按实际问题“今天北京的天气怎么样？”覆盖，断言返回来源全部为 `realtime_web`。

## 4. 启动与脚本调整

开发模式：

- `frontend/package.json` 的 `dev` 已改为双端口启动。
- `npm run dev:visitor` 启动游客端。
- `npm run dev:admin` 启动管理端。

稳定演示模式：

- `START-HERE.bat` / `start-local.bat` 会启动后端、游客端 `5173` 和管理端 `5174`。
- `scripts/start-stable.mjs` 已支持双静态前端端口。
- `stop-local.bat` 会清理 `5173`、`5174`、`8001` 等本地端口。

前端验证脚本新增或适配了：

- `verify:visitor-auth`
- `verify:dual-entrypoints`
- `verify:admin-login`
- `verify:admin-api-auth`
- `verify:login-responsive`
- `verify:spot-detail`

同时修复了 Windows 下 Playwright/Vite 子进程残留问题，新增：

- `frontend/scripts/process-tree.mjs`

验证脚本现在会使用进程树清理，避免多次运行后端口被遗留 Node/Vite 进程占用。

## 5. 验证结果

本轮已执行并通过的关键验证：

- 后端全量测试：`130 passed`
- 聊天专项测试：`35 passed`
- MiMo 配置测试：`5 passed`
- 前端构建：`npm run build`
- 游客端流程：`npm run verify:visitor`
- 游客鉴权：`npm run verify:visitor-auth`
- 双端口入口隔离：`npm run verify:dual-entrypoints`
- 管理端流程：`npm run verify:admin`
- 管理端登录：`npm run verify:admin-login`
- 管理 API 鉴权：`npm run verify:admin-api-auth`
- 登录页响应式：`npm run verify:login-responsive`
- 来源溯源：`npm run verify:source-provenance`
- 景点详情：`npm run verify:spot-detail`
- Haru Live2D：`npm run verify:haru`

`verify:haru` 已在本地真实 API key 配置完成后通过，覆盖内容包括：

- `/guide` 页面可打开
- Haru Live2D 成功加载
- 点击反馈、休眠、唤醒、思考、说话状态正常
- 真实后端问答没有出现服务异常或兜底回答
- 移动端 Live2D 正常且无横向溢出

Haru 验证结果输出目录：

- `frontend/test-results/haru-live2d`

## 6. 重要文件索引

需求与交接：

- `PRD/integration-dual-entry-dashboard-auth-prd-zh.md`
- `README-local-run.md`
- `AGENTS.md`
- `frontend/FRONTEND_BACKEND_HANDOFF.md`

前端入口与路由：

- `frontend/src/App.tsx`
- `frontend/src/appEntry.ts`
- `frontend/src/apps/VisitorApp.tsx`
- `frontend/src/apps/AdminApp.tsx`
- `frontend/src/layouts/VisitorLayout.tsx`
- `frontend/src/layouts/AdminLayout.tsx`

游客登录与管理登录：

- `frontend/src/pages/visitor/VisitorLoginPage.tsx`
- `frontend/src/pages/visitor/VisitorRegisterPage.tsx`
- `frontend/src/pages/admin/AdminLoginPage.tsx`
- `frontend/src/api/auth.ts`
- `frontend/src/api/adminClient.ts`
- `frontend/src/utils/visitorAuthContext.tsx`

数字人对话：

- `frontend/src/pages/visitor/AiGuidePage.tsx`
- `frontend/src/api/chat.ts`
- `frontend/src/components/guide/AvatarGuide.tsx`
- `frontend/src/components/guide/Live2DGuideStage.tsx`
- `frontend/src/live2d/officialCubismRenderer.ts`
- `backend/app/api/chat.py`
- `backend/app/services/chat.py`
- `backend/app/api/tts.py`
- `backend/app/services/tts_jobs.py`

管理数据大屏：

- `frontend/src/pages/admin/AdminDashboardPage.tsx`
- `frontend/src/api/dashboard.ts`
- `backend/app/api/admin.py`
- `backend/app/services/operations.py`

后端认证：

- `backend/app/api/auth.py`
- `backend/app/services/auth.py`
- `backend/app/api/deps.py`
- `backend/app/models/__init__.py`
- `backend/app/core/config.py`

验证脚本：

- `frontend/scripts/verify-visitor-auth-gating.mjs`
- `frontend/scripts/verify-dual-entrypoints.mjs`
- `frontend/scripts/verify-admin-login-flow.mjs`
- `frontend/scripts/verify-admin-api-auth.mjs`
- `frontend/scripts/verify-login-responsive-polish.mjs`
- `frontend/scripts/verify-spot-detail.mjs`
- `frontend/scripts/verify-haru-live2d.mjs`

## 7. 注意事项

不要把真实 API key、管理员密码或访客隐私写入仓库。当前文档只记录能力和验证结果，不记录任何密钥值。

`backend/.env.example` 包含演示默认项，真实凭据应只放在本地 `backend/.env` 或环境变量中。

游客端业务 API 仍保持原公开访问模式；当前游客保护主要在前端页面入口层。管理端 API 已使用后端 Bearer 鉴权。

同事版本目录 `A5-backend-optimization-1b9d7783d4b1bc7df41978351fd3a4dbb92d491c/` 仍可作为参考源，但本项目当前实现已经完成整合，不应直接覆盖当前游客端路线导航代码。

## 8. 建议后续使用的技能

- `$tdd`：继续改认证、聊天、来源、TTS、dashboard、路线导航等行为时使用，优先写公共接口级测试。
- `$diagnose`：遇到真实模型、联网搜索、TTS、Live2D 加载、Playwright 验证失败时使用。
- `$zoom-out`：接手新模块前用于梳理模块边界和调用关系。
- `$handoff`：阶段性工作结束后继续补交接文档。
- `$to-issues`：如果要把剩余优化拆成可分配任务，可从本总结和 PRD 拆 issue。

## 9. 推荐下一步

如果继续推进产品质量，建议优先做三件事：

1. 针对真实联网问答增加更多外部实时问题样例，例如天气、交通、非景区商品价格，持续验证来源卡片不混入无关景区资料。
2. 对 Haru 的 TTS 播放与口型同步做更细验收，特别是移动端和慢网络场景。
3. 对管理端 dashboard 做一次真实演示数据巡检，确认数据指标、日志来源和游客洞察解释口径一致。
