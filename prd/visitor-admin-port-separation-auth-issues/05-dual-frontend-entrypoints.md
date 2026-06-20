# 双前端入口与路由隔离

Status: completed

## Parent

[游客端与管理端端口分离及登录注册 PRD](../visitor-admin-port-separation-auth.md)

## What to build

在一个前端代码库中拆出游客端和管理端两个本地入口。`npm run dev` 一次启动游客端 5173 和管理端 5174。游客端 5173 不再承载 `/admin*`；管理端 5174 使用独立应用根路径和根级后台路由。

本切片要完成可运行的端口分离，让用户只能通过 5174 进入管理端。

## Acceptance criteria

- [ ] `cd frontend && npm run dev` 同时启动游客端 `http://127.0.0.1:5173/` 和管理端 `http://127.0.0.1:5174/`。
- [ ] 游客端 5173 只承载游客应用。
- [ ] 游客端 5173 访问 `/admin` 或 `/admin/*` 时不能进入后台。
- [ ] 管理端 5174 打开 `/` 时进入管理登录页或已登录 dashboard。
- [ ] 管理端 5174 使用 `/dashboard`、`/spots`、`/routes`、`/knowledge`、`/logs` 根级路由。
- [ ] 前端仍然共用现有 API client、类型、样式和业务组件，不拆成两个仓库或两个 UI 技术栈。
- [ ] `cd frontend && npm run build` 仍是一次性构建命令。
- [ ] 现有游客功能和管理功能在各自端口下可继续渲染。

## Blocked by

- [02-visitor-home-gating.md](02-visitor-home-gating.md)
- [03-admin-login-minimal-loop.md](03-admin-login-minimal-loop.md)
