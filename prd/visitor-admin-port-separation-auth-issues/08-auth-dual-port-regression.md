# 认证与双端口回归验证

Status: completed

## Parent

[游客端与管理端端口分离及登录注册 PRD](../visitor-admin-port-separation-auth.md)

## What to build

补齐本次端口分离和登录注册改造的自动化与手动验证闭环。验证重点是外部行为：游客注册登录、未登录 HOME、游客功能门禁、管理端登录、后台 API 权限、双端口启动、移动端布局，以及现有 AI 导游、路线推荐、后台运营页面不回退。

## Acceptance criteria

- [ ] 后端测试覆盖游客注册、游客登录、管理员登录、重复用户名、密码长度、无效 token、默认管理员创建。
- [ ] 后端测试覆盖管理接口在无 token、游客 token、管理员 token、兼容 `x-admin-token` 下的行为。
- [ ] 前端游客验证覆盖未登录 HOME、LOGIN/REGISTER、隐藏 SPOTS/ROUTES/GUIDE/OPS、登录后完整导航恢复、退出登录。
- [ ] 前端管理验证覆盖 5174 未登录登录页、登录进入 dashboard、退出回登录页。
- [ ] 验证脚本或手动流程覆盖 5173 `/admin*` 不能进入后台。
- [ ] 验证脚本或手动流程覆盖 5174 根级后台路由。
- [ ] 运行 `cd backend && python -m pytest -q` 通过。
- [ ] 运行 `cd frontend && npm run build` 通过。
- [ ] 优先运行或更新 `verify:visitor` 和 `verify:admin`，使其适配双端口。
- [ ] 桌面和移动视口下登录/注册页、游客 HOME、管理登录页无横向滚动、遮挡或按钮文字溢出。

## Blocked by

- [01-visitor-auth-minimal-loop.md](01-visitor-auth-minimal-loop.md)
- [02-visitor-home-gating.md](02-visitor-home-gating.md)
- [03-admin-login-minimal-loop.md](03-admin-login-minimal-loop.md)
- [04-admin-api-permissions.md](04-admin-api-permissions.md)
- [05-dual-frontend-entrypoints.md](05-dual-frontend-entrypoints.md)
- [06-login-ui-responsive-polish.md](06-login-ui-responsive-polish.md)
- [07-one-click-start-stop.md](07-one-click-start-stop.md)
