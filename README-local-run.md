# A5 本地开发启动手册

## 1. 项目地址

```bash
cd /Users/bebop/code/中软/A5--main
```

## 2. macOS 首次部署

```bash
./scripts/bootstrap-macos.sh
```

部署完成后应存在：

```text
.tools/node/bin/node
.tools/node/bin/npm
.tools/python/bin/python3
backend/.venv/bin/python
frontend/node_modules
backend/.env
frontend/.env.local
```

## 3. macOS 开发启动

```bash
./scripts/start-dev-macos.sh
```

访问地址：

| 页面 | 地址 |
| --- | --- |
| 游客端首页 | http://127.0.0.1:5173/ |
| AI 导游页 | http://127.0.0.1:5173/guide |
| 管理后台 | http://127.0.0.1:5174/ |
| 后端接口 | http://127.0.0.1:8001 |
| Swagger 文档 | http://127.0.0.1:8001/docs |
| 健康检查 | http://127.0.0.1:8001/health |

## 4. macOS 停止服务

```bash
./scripts/stop-dev-macos.sh
```

## 5. macOS 日志

```text
backend/backend-dev-server-8001.log
backend/backend-dev-server-8001.err.log
frontend/frontend-dev-server-5173.log
frontend/frontend-dev-server-5173.err.log
```

查看日志：

```bash
tail -n 80 backend/backend-dev-server-8001.log
tail -n 80 backend/backend-dev-server-8001.err.log
tail -n 80 frontend/frontend-dev-server-5173.log
tail -n 80 frontend/frontend-dev-server-5173.err.log
```

## 6. macOS 常用验证

后端测试：

```bash
cd backend
../.tools/python/bin/python3 -m pytest -q
```

前端构建：

```bash
cd frontend
../.tools/node/bin/npm run build
```

游客端流程验证：

```bash
cd frontend
../.tools/node/bin/npm run verify:visitor
```

管理端流程验证：

```bash
cd frontend
../.tools/node/bin/npm run verify:admin
```

## 7. Python 手动下载

如果 `bootstrap-macos.sh` 下载 Python 很慢，手动下载这个文件：

```text
https://github.com/astral-sh/python-build-standalone/releases/download/20260610/cpython-3.12.13%2B20260610-aarch64-apple-darwin-install_only.tar.gz
```

下载后放到以下任一位置：

```text
/Users/bebop/code/中软/A5--main/cpython-3.12.13+20260610-aarch64-apple-darwin-install_only.tar.gz
/Users/bebop/code/中软/A5--main/.tools/cpython-3.12.13+20260610-aarch64-apple-darwin-install_only.tar.gz
```

然后重新运行：

```bash
cd /Users/bebop/code/中软/A5--main
./scripts/bootstrap-macos.sh
```

## 8. Windows 启动

Windows 使用：

```bat
START-HERE.bat
```

或：

```bat
start-local.bat
```

Windows 停止服务：

```bat
stop-local.bat
```

Windows 前端重新构建：

```bat
BUILD-FRONTEND.bat
```

## 9. 环境变量

本地后端配置文件：

```text
backend/.env
```

前端开发配置文件：

```text
frontend/.env.local
```

默认前端接口地址：

```text
VITE_API_BASE_URL=http://127.0.0.1:8001
VITE_USE_MOCK_API=false
```

真实模型、TTS 或联网补充密钥只写入本地 `backend/.env`，不要写入仓库文档。
