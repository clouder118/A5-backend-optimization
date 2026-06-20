# 一键启动与停止脚本升级

Status: completed

## Parent

[游客端与管理端端口分离及登录注册 PRD](../visitor-admin-port-separation-auth.md)

## What to build

更新本地稳定演示启动脚本，让一次命令同时启动后端、游客端和管理端，并能一次停止所有相关服务。保持现有项目的“一键启动”习惯，不增加演示操作者负担。

## Acceptance criteria

- [ ] `START-HERE.bat` 能启动后端 `http://127.0.0.1:8001`。
- [ ] `START-HERE.bat` 能启动游客端 `http://127.0.0.1:5173`。
- [ ] `START-HERE.bat` 能启动管理端 `http://127.0.0.1:5174`。
- [ ] `start-local.*` 与脚本内部调用逻辑同步支持双前端端口。
- [ ] `stop-local.bat` / `stop-local.*` 能停止后端、游客端、管理端。
- [ ] 日志文件能区分游客端和管理端，便于排查启动失败。
- [ ] 如果端口占用，脚本给出可理解的失败信息或沿用现有稳定处理方式。
- [ ] 脚本不改变后端默认端口 8001、游客端默认端口 5173、管理端默认端口 5174。

## Blocked by

- [05-dual-frontend-entrypoints.md](05-dual-frontend-entrypoints.md)
