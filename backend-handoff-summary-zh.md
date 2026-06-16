# A5 游知灵后端开发交接总结

日期：2026-05-31  
范围：`v1/backend` 后端 P0、前后端联调、AI 导游问答延迟优化

## 1. 当前状态总览

今天已经完成了 A5 景区导览服务 AI 数字人 P0 后端主链路，并与前端完成联调。当前系统支持：

- FastAPI 后端启动、健康检查、Swagger 文档。
- SQLite 数据库初始化与灵山胜境种子数据导入。
- 景点、路线推荐、管理后台、知识库状态、聊天日志等 P0 API。
- 默认真实 MIMO 大模型调用，保留 mock/fallback/disabled 策略。
- 基于景区公开资料包的两级检索 P0 路径。
- 后端 TTS 生成音频，并已从 `/api/chat` 主响应中解耦。
- AI 导游文本回答已改为 SSE 流式输出。
- 前端默认调用真实后端，不再需要手动设置 `VITE_USE_MOCK_API=false`。
- 聊天响应和聊天日志返回耗时指标，方便判断慢在检索、LLM 还是 TTS。

关键目录：

- 后端：`D:\ws01\v1\backend`
- 前端：`D:\ws01\v1\frontend`
- 知识库资料：`D:\ws01\v1\Scenic Area Public Information Package`
- 后端 P0 PRD：`D:\ws01\v1\frontend\.scratch\backend-p0\PRD.md`
- 延迟优化 PRD：`D:\ws01\v1\frontend\.scratch\chat-latency-optimization\PRD.md`

## 2. 后端具体实现内容

### 2.1 FastAPI 后端基础

后端位于 `v1/backend`，主要结构：

```text
backend/
  app/
    api/
    core/
    db/
    models/
    schemas/
    services/
    main.py
  data/
    app.db
    tts/
  tests/
  .env
  .env.example
  requirements.txt
```

已实现：

- `GET /health`
- Swagger：`http://127.0.0.1:8000/docs`
- SQLite 默认数据库：`backend/data/app.db`
- CORS 默认支持 Vite 常见端口：5173、5174、5175
- `.env` 自动加载：`v1/backend/.env`

注意：`http://127.0.0.1:8000/` 返回 `{"detail":"Not Found"}` 是正常现象，因为根路径没有定义业务路由。

### 2.2 灵山胜境数据与知识库

已从 `v1/Scenic Area Public Information Package` 引入灵山胜境资料，用于：

- 景点种子数据
- 路线种子数据
- 知识文档与 chunk
- RAG 问答来源卡片

管理后台写入数据库，不修改原始 Word/Excel 资料包。

相关接口：

- `GET /api/spots`
- `GET /api/spots/{spot_id}`
- `GET /api/routes`
- `POST /api/routes/recommend`
- `GET /api/knowledge/docs`
- `POST /api/knowledge/rebuild`

### 2.3 管理后台 API

已实现数据库级 CRUD：

- `POST /api/admin/spots`
- `PUT /api/admin/spots/{spot_id}`
- `DELETE /api/admin/spots/{spot_id}`
- `POST /api/admin/routes`
- `PUT /api/admin/routes/{route_id}`
- `DELETE /api/admin/routes/{route_id}`
- `GET /api/logs/chats`

可选管理令牌：

```env
ENABLE_ADMIN_TOKEN=true
ADMIN_TOKEN=<your-admin-token>
```

默认关闭真实登录，符合 P0 决策。

### 2.4 大模型调用策略

配置入口在 `v1/backend/.env`。不要把真实 key 写入文档或提交到仓库。

当前关键配置：

```env
LLM_MODE=openai_compatible
LLM_PROVIDER=mimo
LLM_BASE_URL=https://api.xiaomimimo.com/v1
LLM_MODEL=mimo-v2.5-pro

TTS_MODE=provider
TTS_PROVIDER=mimo
TTS_BASE_URL=https://api.xiaomimimo.com/v1
TTS_MODEL=mimo-v2.5-tts

MIMO_API_KEY=<redacted>
```

实现要点：

- `MIMO_API_KEY` 会同时作为 LLM 和 TTS 的默认 key。
- `LLM_API_KEY=` 或 `TTS_API_KEY=` 为空时不会覆盖 `MIMO_API_KEY`。
- 修改 `.env` 后必须重启后端，运行中的进程不会自动重读 key。
- 缺 key、provider 失败或网络失败时，后端会返回 fallback，而不是启动失败。

### 2.5 AI 导游问答与 RAG

同步接口仍保留：

```text
POST /api/chat
```

现在前端默认使用流式接口：

```text
POST /api/chat/stream
```

流式接口使用 SSE：

```text
event: delta
data: {"text":"..."}

event: final
data: {...完整 ChatResponse...}
```

`final` 中包含：

- `answer`
- `sources`
- `session_id`
- `audio_url`
- `tts_job_id`
- `tts_status`
- `mode`
- `degraded`
- `metrics`

已修复的重要问题：

- 如果 MIMO streaming 已经输出真实文本，但尾部阶段抛异常，不再追加本地兜底文本。
- 这种情况下 final 保留真实模型文本，返回 `mode=openai_compatible`、`degraded=false`。
- 只有一个真实 chunk 都没有输出时，才走 fallback。

### 2.6 TTS 解耦

旧链路：

```text
检索 -> LLM 完整生成 -> TTS 完整生成 -> /api/chat 返回 -> 前端显示
```

新链路：

```text
检索 -> LLM 流式输出 -> /api/chat/stream final 返回 tts_status=pending
后台 TTS job 继续生成 -> 前端轮询获取 audio_url
```

新增接口：

```text
GET /api/tts/jobs/{tts_job_id}
```

典型返回：

```json
{
  "id": "tts_xxx",
  "status": "ready",
  "audio_url": "/static/tts/xxx.mp3"
}
```

状态含义：

- `pending`：语音生成中
- `ready`：音频已生成
- `failed`：TTS 失败
- `disabled`：TTS 关闭

当前 TTS job store 是进程内内存实现。适合 P0 本地演示；后端重启后未完成 job 会丢失，不适合生产多实例部署。

### 2.7 耗时指标 metrics

`/api/chat`、`/api/chat/stream` 的 final、`/api/logs/chats` 都包含 metrics。

示例：

```json
{
  "retrieval_ms": 1.55,
  "llm_ms": 29517.43,
  "tts_ms": 0.53,
  "total_ms": 29525.10,
  "cache_hit": false,
  "degraded": false
}
```

含义：

- `retrieval_ms`：知识库检索耗时
- `llm_ms`：大模型生成耗时
- `tts_ms`：在 chat 请求中启动 TTS job 的耗时，不是完整后台 TTS 推理耗时
- `total_ms`：后端本次 chat 请求总耗时
- `cache_hit`：是否命中缓存；当前还未实现缓存，通常是 `false`
- `degraded`：是否触发兜底

今天实测结论：

- 检索通常只有几毫秒，不是主要瓶颈。
- 解耦前总耗时约 50 秒，其中 LLM 约 30 秒、TTS 约 20 秒。
- 解耦后文字返回不再等待 TTS，总耗时基本只剩 LLM 生成时间。

## 3. 前端联调实现内容

前端 API 层已经从 mock-first 改成 real-backend-first：

```ts
USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true'
API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
```

已完成适配：

- `GET /api/spots` 的 `{items,total}` 到前端景点类型
- `POST /api/routes/recommend` 的 snake_case/camelCase 转换
- `POST /api/chat/stream` SSE 流式文本
- `GET /api/tts/jobs/{id}` TTS 状态轮询
- `GET /api/logs/chats` metrics 映射
- `POST /api/knowledge/rebuild` 映射

AI 导游页面当前行为：

1. 用户输入问题。
2. 前端创建一条空的 assistant 消息。
3. 收到 `delta` 后逐段追加文本。
4. 收到 `final` 后补齐 sources、metrics、tts job 信息。
5. 如果 `tts_status=pending`，按钮显示“语音生成中”。
6. 轮询 TTS job，ready 后更新 `audioUrl`，按钮恢复“播放讲解”。

相关文件：

- `frontend/src/api/chat.ts`
- `frontend/src/api/tts.ts`
- `frontend/src/pages/visitor/AiGuidePage.tsx`
- `frontend/src/components/guide/ChatBox.tsx`
- `frontend/src/types/scenic.ts`
- `frontend/src/types/api.ts`

## 4. 前后端联合测试步骤

以下命令均在 PowerShell 中执行。

### 4.1 安装依赖

后端：

```powershell
cd D:\ws01\v1\backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

前端：

```powershell
cd D:\ws01\v1\frontend
npm install
```

如果依赖已经安装，可以跳过。

### 4.2 配置后端 `.env`

文件位置：

```text
D:\ws01\v1\backend\.env
```

至少确认以下项存在：

```env
LLM_MODE=openai_compatible
LLM_PROVIDER=mimo
LLM_BASE_URL=https://api.xiaomimimo.com/v1
LLM_MODEL=mimo-v2.5-pro

TTS_MODE=provider
TTS_PROVIDER=mimo
TTS_BASE_URL=https://api.xiaomimimo.com/v1
TTS_MODEL=mimo-v2.5-tts

MIMO_API_KEY=<redacted>
```

不要在交接文档、PRD、issue 或聊天记录中粘贴真实 key。

### 4.3 清理旧进程

如果端口被旧服务占用，先执行：

```powershell
$ports = @(8000,5173,5174,5175)
$processIds = @()
foreach ($port in $ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' }
  foreach ($connection in $connections) {
    if ($connection.OwningProcess -and $connection.OwningProcess -ne 0) {
      $processIds += [int]$connection.OwningProcess
    }
  }
}
$processIds = $processIds | Sort-Object -Unique
foreach ($processId in $processIds) {
  Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}
```

### 4.4 启动后端

```powershell
cd D:\ws01\v1\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

推荐先不用 `--reload`，Windows 上 reload 父子进程偶尔会留下端口残留。

验证后端：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health | ConvertTo-Json
```

预期：

```json
{
  "status": "ok",
  "service": "a5-ai-guide-backend"
}
```

### 4.5 启动前端

另开一个 PowerShell：

```powershell
cd D:\ws01\v1\frontend
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

打开：

```text
http://127.0.0.1:5173/guide
```

### 4.6 后端同步 chat 验证

```powershell
$body = '{"question":"灵山大佛有什么看点？","spot_id":"spot_ling_shan_buddha"}'
$result = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/chat `
  -Method POST `
  -ContentType 'application/json' `
  -Body $body

$result | ConvertTo-Json -Depth 6
```

真实模型成功时应看到：

```json
{
  "mode": "openai_compatible",
  "degraded": false
}
```

如果看到：

```json
{
  "mode": "fallback",
  "degraded": true
}
```

优先检查：

1. `.env` 是否在 `v1/backend/.env`
2. `MIMO_API_KEY` 是否非空
3. 修改 `.env` 后是否重启后端
4. MIMO API 是否配额、网络、模型名异常

### 4.7 后端流式 chat 验证

```powershell
$payload = '{"question":"灵山大佛有什么看点？","spot_id":"spot_ling_shan_buddha"}'
$response = Invoke-WebRequest `
  -Uri http://127.0.0.1:8000/api/chat/stream `
  -Method POST `
  -ContentType 'application/json' `
  -Body $payload `
  -UseBasicParsing `
  -TimeoutSec 120

$response.Content.Substring(0, [Math]::Min(1000, $response.Content.Length))
```

预期能看到：

```text
event: delta
data: {"text":"..."}

event: final
data: {...}
```

检查 final 是否正常：

```powershell
$final = [regex]::Match($response.Content, 'event: final\ndata: (.*)\n\n').Groups[1].Value |
  ConvertFrom-Json

[pscustomobject]@{
  Mode = $final.mode
  Degraded = $final.degraded
  TtsStatus = $final.tts_status
  HasJob = [bool]$final.tts_job_id
  RetrievalMs = $final.metrics.retrieval_ms
  LlmMs = $final.metrics.llm_ms
  TotalMs = $final.metrics.total_ms
} | ConvertTo-Json
```

预期：

```json
{
  "Mode": "openai_compatible",
  "Degraded": false,
  "TtsStatus": "pending",
  "HasJob": true
}
```

### 4.8 TTS job 验证

拿到 `tts_job_id` 后：

```powershell
$jobId = $final.tts_job_id
Start-Sleep -Seconds 8
Invoke-RestMethod "http://127.0.0.1:8000/api/tts/jobs/$jobId" | ConvertTo-Json
```

预期：

```json
{
  "id": "tts_xxx",
  "status": "ready",
  "audio_url": "/static/tts/xxx.mp3"
}
```

如果仍是 `pending`，多等几秒再查。

### 4.9 聊天日志耗时验证

```powershell
$logs = Invoke-RestMethod http://127.0.0.1:8000/api/logs/chats
$logs.items[0].metrics | ConvertTo-Json
```

预期能看到：

```json
{
  "retrieval_ms": 1.55,
  "llm_ms": 29517.43,
  "tts_ms": 0.53,
  "total_ms": 29525.10,
  "cache_hit": false,
  "degraded": false
}
```

### 4.10 自动化回归验证

后端：

```powershell
cd D:\ws01\v1\backend
.\.venv\Scripts\python.exe -m pytest
```

当前最新结果：

```text
27 passed
```

前端：

```powershell
cd D:\ws01\v1\frontend
npm run build
```

当前最新结果：构建通过。Vite chunk size warning 可暂时忽略，不影响 P0 联调。

## 5. 常见问题与排查

### 5.1 前端显示“问答服务异常”

优先判断是否真的 fallback：

```powershell
$payload = '{"question":"灵山大佛有什么看点？","spot_id":"spot_ling_shan_buddha"}'
$response = Invoke-WebRequest -Uri http://127.0.0.1:8000/api/chat/stream -Method POST -ContentType 'application/json' -Body $payload -UseBasicParsing -TimeoutSec 120
$final = [regex]::Match($response.Content, 'event: final\ndata: (.*)\n\n').Groups[1].Value | ConvertFrom-Json
$final.mode
$final.degraded
```

如果后端 final 是 `openai_compatible` 和 `false`，但前端还报异常，重启前端 Vite，浏览器强刷。

如果后端 final 是 `fallback` 和 `true`，继续看：

- `.env` 是否读到 key
- 后端是否重启
- MIMO streaming 是否异常
- 后端日志是否有 provider HTTP 错误

### 5.2 `/api/chat/stream` 正常，但页面仍旧

一般是旧 Vite 进程或浏览器缓存：

1. 停止 5173 旧进程。
2. 重新 `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`。
3. 浏览器 Ctrl+F5 强刷。

### 5.3 修改 `.env` 后不生效

必须重启后端。`.env` 只在进程启动时读取。

### 5.4 TTS 没有立刻播放

这是当前设计。文本优先返回，TTS 后台生成。页面先显示“语音生成中”，ready 后再可播放。

### 5.5 耗时看起来还是长

当前已经解决 TTS 阻塞，用户体感主要剩 LLM 首段输出速度和模型整体生成速度。检索通常是毫秒级，不是当前瓶颈。

## 6. 今日关键修复记录

### 6.1 `.env` 和 MIMO key

- 创建并使用 `v1/backend/.env`。
- 修复 `LLM_API_KEY=` 空值覆盖 `MIMO_API_KEY` 的问题。
- 确认 `MIMO_API_KEY` 可同时作为 LLM/TTS key。
- 不在代码和文档中记录真实 key。

### 6.2 前后端默认真实后端

- 前端默认不走 mock。
- `VITE_USE_MOCK_API` 只有显式为 `true` 才走 mock。
- 前端 API 层完成 snake_case/camelCase 映射。

### 6.3 中文检索修复

- 修复中文整句“灵山大佛有什么看点？”无 `spot_id` 时不命中的问题。
- 通过中文 n-gram/停用词方式让 RAG 能返回 sources。

### 6.4 延迟观测

- `/api/chat` 返回 metrics。
- `/api/logs/chats` 持久化并返回 metrics。
- SQLite 启动时补充 `metrics_json` 兼容迁移。

### 6.5 TTS 解耦

- `/api/chat` 和 `/api/chat/stream` 不再同步等待完整 TTS。
- 返回 `tts_status=pending` 和 `tts_job_id`。
- 前端轮询 `/api/tts/jobs/{id}`。

### 6.6 流式文本输出

- 新增 `POST /api/chat/stream`。
- MIMO 客户端支持 OpenAI-compatible SSE 解析。
- 前端 AI 导游页面改为逐段显示模型输出。
- 修复 MIMO streaming 尾部异常导致真实回答后又拼接兜底的问题。

## 7. 后续开发优化方向

建议顺序：

1. `05-add-phase-aware-chat-ux`
   - 文件：`v1/frontend/.scratch/chat-latency-optimization/issues/05-add-phase-aware-chat-ux.md`
   - 目标：把当前 metrics、stream、tts pending 状态转化成更清晰的 UI 阶段提示。
   - 建议展示：查找资料、模型组织回答、语音生成中、语音已就绪、已降级。

2. `02-build-fast-keyword-retrieval-index`
   - 文件：`v1/frontend/.scratch/chat-latency-optimization/issues/02-build-fast-keyword-retrieval-index.md`
   - 当前检索已很快，但该任务有助于后续资料增多时保持稳定。

3. `03-cache-repeated-chat-answers`
   - 文件：`v1/frontend/.scratch/chat-latency-optimization/issues/03-cache-repeated-chat-answers.md`
   - 对常见问题、演示问题和重复问题很有价值。
   - 需要注意缓存 key 包含问题、sources hash、模型、prompt 版本。

4. `06-add-chat-latency-benchmark`
   - 文件：`v1/frontend/.scratch/chat-latency-optimization/issues/06-add-chat-latency-benchmark.md`
   - 建议在 mock/fake provider 下跑固定 50 问，输出检索、LLM、TTS、总耗时。

5. 更接近电话模式的后续能力
   - 分句 TTS：LLM 每产出一句就送 TTS。
   - 音频流式播放：前端边收边播，不等完整 mp3。
   - 语音输入：ASR、VAD、打断。
   - 这些不建议塞进当前 P0 后端基础任务，应另开 PRD/issue。

## 8. 已知限制

- TTS job store 是进程内内存，不支持后端重启恢复。
- 当前没有 Redis、Celery、任务队列或多实例同步。
- 当前没有 answer cache，`cache_hit` 始终为 false。
- 当前没有真正的音频流式播放，只有文本流式和后台 TTS。
- 当前前端还没有完整展示 metrics，只是在 API 类型和数据链路中保留。
- 当前模型生成速度依赖 MIMO provider，本地只能通过流式显示改善体感，不能直接让模型推理本身变快。

## 9. 建议后续使用的技能

- `diagnose`：用于定位前端异常、fallback、接口 404、provider 调用失败、耗时异常。
- `tdd`：用于继续实现 `05`、`02`、`03`、`06` 等 issue。
- `karpathy-guidelines`：用于保持后续改动克制，避免过度抽象。
- `to-issues`：如果要增加电话模式、ASR、流式音频播放，应先拆新 issue。
- `handoff`：每轮关键后端/联调改动结束后，继续更新交接文档。

## 10. 推荐下一步

最推荐继续做：

```text
v1/frontend/.scratch/chat-latency-optimization/issues/05-add-phase-aware-chat-ux.md
```

原因：

- 后端已经有 metrics。
- 前端已经有 stream 和 TTS pending。
- 用户现在需要看到明确阶段，而不是只看到按钮变化。
- 这是目前最能改善游客体感和演示可解释性的下一步。
