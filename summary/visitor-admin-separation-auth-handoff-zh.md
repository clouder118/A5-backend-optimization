# 游客端与管理端分离及认证开发交接总结

日期：2026-06-20

## 1. 背景

本阶段围绕“游客端与管理端分离、游客/管理员登录、单命令启动、回归验证”完成开发。项目仍然保持一个代码库，前端通过不同 Vite 入口和本地端口区分游客端与管理端，后端继续由 FastAPI 提供统一 API。

需求拆分与逐项实现记录见：

- `prd/visitor-admin-port-separation-auth-issues/01-visitor-auth-minimal-loop.md`
- `prd/visitor-admin-port-separation-auth-issues/02-visitor-home-gating.md`
- `prd/visitor-admin-port-separation-auth-issues/03-admin-login-minimal-loop.md`
- `prd/visitor-admin-port-separation-auth-issues/04-admin-api-permissions.md`
- `prd/visitor-admin-port-separation-auth-issues/05-dual-frontend-entrypoints.md`
- `prd/visitor-admin-port-separation-auth-issues/06-login-ui-responsive-polish.md`
- `prd/visitor-admin-port-separation-auth-issues/07-one-click-start-stop.md`
- `prd/visitor-admin-port-separation-auth-issues/08-auth-dual-port-regression.md`

## 2. 已完成成果

### 2.1 游客端与管理端分离

- 游客端入口：`http://127.0.0.1:5173/`
- 管理端入口：`http://127.0.0.1:5174/`
- 游客端已移除原顶部 `[ OPS ]` 管理入口。
- 游客端访问 `/admin` 不再渲染管理端登录页，会回到游客端首页。
- 管理端在 5174 独立运行，管理页面路径为：
  - `/dashboard`
  - `/spots`
  - `/routes`
  - `/knowledge`
  - `/logs`
- 管理端保留 `/admin/login`、`/admin/*` 到新路径的兼容跳转，避免旧书签完全失效。

### 2.2 游客认证与游客门禁

- 游客端新增登录页与注册页。
- 游客注册第一版只需要用户名和密码。
- 未登录游客可以进入 HOME 首页。
- 未登录游客顶部导航只保留 `[ HOME ]`，不展示景点、路线、导览等功能入口。
- 未登录游客访问 `/spots`、`/routes`、`/guide` 等受保护页面会被导回首页。
- 登录后恢复完整游客端导航和原有游客功能。

### 2.3 管理端认证与后端权限

- 管理端新增独立登录页。
- 管理端登录走真实后端认证接口。
- 管理端 API 客户端会携带管理员 token 访问后台接口。
- 管理端 token 失效或接口返回未授权时，会回到管理端登录页。
- 后端管理 API 已补充权限保护，避免未认证访问后台能力。

### 2.4 一键启动

- 保持用户期望的简单启动方式：一次 `npm run dev` 启动前端双入口。
- Windows 稳定启动脚本会启动：
  - 后端：`8001`
  - 游客端：`5173`
  - 管理端：`5174`
- 相关本地说明文档已更新为当前双入口地址，不再使用旧的 `5173/admin` 作为管理入口。

### 2.5 验证脚本修复

- `frontend/scripts/verify-source-provenance.mjs` 已适配双入口：
  - 使用 `npm run dev:visitor -- --port 5175` 自启动游客端验证入口。
  - 不再强制依赖仓库根目录 `.cache/ms-playwright`。
  - 为 `/guide` 补充游客登录态 mock。
  - 补充 `api/chat/stream` 的预检与 CORS mock。
  - Windows 下会杀掉自己启动的服务进程树，避免残留 5175 Vite 服务污染后续验证。

## 3. 当前技术栈

### 3.1 前端

- React 18
- Vite 6
- TypeScript
- React Router
- Ant Design
- `@ant-design/icons`
- Live2D / Cubism 相关前端渲染代码
- Playwright 用于前端自动化验证脚本

前端入口脚本：

- `npm run dev`：同时启动游客端和管理端。
- `npm run dev:visitor`：只启动游客端。
- `npm run dev:admin`：只启动管理端。

### 3.2 后端

- FastAPI
- SQLite
- SQLAlchemy
- Pydantic
- pytest
- RAG 风格的结构化/关键词优先检索
- MiMo 兼容 LLM、TTS、联网补充适配路径

后端继续监听：

- API：`http://127.0.0.1:8001`
- Swagger：`http://127.0.0.1:8001/docs`
- Health：`http://127.0.0.1:8001/health`

## 4. 启动步骤

### 4.1 Windows 推荐启动

在项目根目录运行：

```bat
START-HERE.bat
```

或：

```bat
start-local.bat
```

启动后访问：

```text
游客端首页：http://127.0.0.1:5173/
AI 导游页：http://127.0.0.1:5173/guide
管理端入口：http://127.0.0.1:5174/
后端接口：http://127.0.0.1:8001
后端文档：http://127.0.0.1:8001/docs
```

停止服务：

```bat
stop-local.bat
```

前端重新构建：

```bat
BUILD-FRONTEND.bat
```

### 4.2 前端开发启动

只启动前端双入口：

```powershell
cd frontend
npm run dev
```

单独启动游客端：

```powershell
cd frontend
npm run dev:visitor
```

单独启动管理端：

```powershell
cd frontend
npm run dev:admin
```

### 4.3 后端手动启动

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

### 4.4 macOS 启动

```bash
./scripts/start-dev-macos.sh
```

停止：

```bash
./scripts/stop-dev-macos.sh
```

## 5. 验证命令

后端测试：

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

前端构建：

```powershell
cd frontend
npm run build
```

游客端流程验证：

```powershell
cd frontend
npm run verify:visitor
```

游客端认证与门禁验证：

```powershell
cd frontend
npm run verify:visitor-auth
```

管理端流程验证：

```powershell
cd frontend
npm run verify:admin
```

管理端登录验证：

```powershell
cd frontend
npm run verify:admin-login
```

管理端 API 权限验证：

```powershell
cd frontend
npm run verify:admin-api-auth
```

双入口回归验证：

```powershell
cd frontend
npm run verify:dual-entrypoints
```

来源卡片回归验证：

```powershell
cd frontend
npm run verify:source-provenance
```

## 6. 当前已知注意点

- `npm run build` 可以通过，但仍存在 Noto Serif SC 字体资源解析警告；这是后续可单独处理的字体资源问题。
- `npm run build` 仍提示主 chunk 较大；后续可考虑按管理端、游客端、Live2D 等维度做懒加载拆包。
- 管理端默认账号、密码等本地认证配置应继续放在环境变量或本地 `.env` 中，不要写入仓库文档。
- `frontend/dist` 是稳定演示产物，不是日常开发源代码入口。
- 后续修改登录、权限、双端口启动时，建议同时补跑对应验证脚本，避免再次出现验证脚本与入口结构漂移。

## 7. 建议后续使用的技能

- `$diagnose`：排查启动、登录、验证脚本、端口残留或构建警告等问题。
- `$tdd`：继续开发认证、权限、前端门禁、API 行为时保持测试先行。
- `$karpathy-guidelines`：做小步、保守、可验证的代码修改，避免引入无关重构。
- `$to-issues`：如果要继续拆分字体修复、前端拆包、移动端 UI polish 等后续任务，可继续转为独立 issue。
- `$handoff`：阶段性开发完成后继续沉淀交接文档。

## 8. 交接结论

本阶段已经完成游客端和管理端在同一代码库内的本地端口分离，并补齐游客注册登录、游客端功能门禁、管理端登录、后端权限保护、一键启动和回归验证。当前开发者可以通过 `START-HERE.bat` 或前端 `npm run dev` 快速进入双入口开发状态。
