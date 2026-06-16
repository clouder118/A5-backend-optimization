# P2 一键运行与迁移说明

本项目默认使用稳定演示模式启动：

- 前端：http://127.0.0.1:5173
- AI 导游页：http://127.0.0.1:5173/guide
- 管理后台：http://127.0.0.1:5173/admin
- 后端：http://127.0.0.1:8001
- 后端接口文档：http://127.0.0.1:8001/docs

## 为什么不用动态热更新

之前反复卡住的主要原因是开发态 Vite 热更新服务会监听文件变化，改代码后它会尝试实时刷新页面。这个模式适合开发，但在比赛演示、频繁启动停止、后台脚本运行时容易留下进程或卡住终端。

现在 `START-HERE.bat` 不再使用热更新模式，也不在启动时临时构建页面，而是：

1. 安装/检查依赖。
2. 写入本地运行配置。
3. 检查 `frontend\dist` 静态前端是否存在。
4. 启动后端 `8001`。
5. 用 `vite preview` 在 `5173` 预览构建产物。

这样页面不会因为文件变化实时重载，也不会在启动时被构建流程卡住。改完代码后，先运行 `BUILD-FRONTEND.bat`，再运行 `START-HERE.bat`。

## 本机启动

双击：

```bat
START-HERE.bat
```

或在终端运行：

```bat
start-local.bat
```

脚本会自动完成：

1. 检查 Python 3.10+、Node.js、npm 是否可用。
2. 如果 `backend\.venv` 不存在或不可用，自动重建 Python 虚拟环境。
3. 如果 `frontend\node_modules` 不存在，自动安装前端依赖。
4. 缺少 `backend\.env` 时，从 `backend\.env.example` 复制一份。
5. 写入 `frontend\.env.local`，让前端固定连接 `http://127.0.0.1:8001`。
6. 启动后端和静态前端预览。
7. 启动成功后自动打开浏览器。

为了避免 Windows 批处理在自动清端口时卡住，`START-HERE.bat` 不会自动停止旧服务。需要重启时请先运行：

```bat
stop-local.bat
```

再运行：

```bat
START-HERE.bat
```

## 改代码后刷新页面

改完前端或 Live2D 代码后运行：

```bat
BUILD-FRONTEND.bat
```

构建成功后再运行：

```bat
START-HERE.bat
```

这个流程等价于“重新渲染网页”，但不启用热更新监听，所以更稳定。

## 一键打包给组员

双击：

```bat
MAKE-PORTABLE-PACKAGE.bat
```

它会生成：

```text
.release\P2-Haru-AIGuide-portable.zip
```

把这个 zip 发给组员即可。压缩包会包含当前已构建好的 `frontend\dist`，组员解压后双击 `START-HERE.bat`，不需要手动改本地路径或端口配置。

## 新电脑需要提前安装

脚本不会安装系统级运行时。新电脑只需要提前安装：

- Python 3.10 或以上版本，安装时勾选 `Add python.exe to PATH`。
- Node.js 18 或以上版本。

Python 依赖会放在 `backend\.venv`，前端依赖会放在 `frontend\node_modules`，不会依赖你电脑上的固定路径。

## 停止服务

```bat
stop-local.bat
```

## 日志位置

- 后端日志：`backend\backend-local-server-8001.log`
- 后端错误日志：`backend\backend-local-server-8001.err.log`
- 前端日志：`frontend\frontend-local-server-5173.log`
- 前端错误日志：`frontend\frontend-local-server-5173.err.log`

## 开发模式

只有需要热更新开发时，才进入 `frontend` 手动运行：

```bat
npm.cmd run dev
```

演示、验收、组员部署时不要用开发模式，统一使用 `START-HERE.bat`。
