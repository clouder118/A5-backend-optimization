# 管理后台 API 权限闭环

Status: completed

## Parent

[游客端与管理端端口分离及登录注册 PRD](../visitor-admin-port-separation-auth.md)

## What to build

让管理后台不再只是前端登录门面，而是真正由后端校验管理员身份。管理相关 API 需要 admin Bearer token，同时保留现有 `x-admin-token` 兼容路径供脚本或调试使用。管理端 API client 自动携带管理员 token，token 无效时回到管理端登录页。

## Acceptance criteria

- [ ] `/api/admin/*` 需要 admin Bearer token 或有效兼容 `x-admin-token`。
- [ ] `/api/knowledge/*` 管理能力需要 admin Bearer token 或有效兼容 `x-admin-token`。
- [ ] `/api/logs/*` 需要 admin Bearer token 或有效兼容 `x-admin-token`。
- [ ] 无 token 访问受保护管理接口返回 401。
- [ ] 游客 token 访问受保护管理接口返回 401 或 403。
- [ ] 管理端 API client 自动携带 `a5_admin_token`。
- [ ] 管理端遇到无效 token 时清理登录态并回到登录页。
- [ ] 现有 `ENABLE_ADMIN_TOKEN` / `ADMIN_TOKEN` / `x-admin-token` 兼容路径不被破坏。
- [ ] 后端测试覆盖无 token、游客 token、管理员 token、兼容 token 四类访问行为。

## Blocked by

- [03-admin-login-minimal-loop.md](03-admin-login-minimal-loop.md)
