# 游客未登录 HOME 与功能门禁

Status: completed

## Parent

[游客端与管理端端口分离及登录注册 PRD](../visitor-admin-port-separation-auth.md)

## What to build

实现游客端未登录和已登录两种清晰状态。未登录游客可以进入 HOME，并看到景区介绍、登录和注册入口；未登录时不显示 SPOTS、ROUTES、GUIDE、OPS，不允许进入受保护游客功能页。登录后恢复现有游客端完整导航和功能入口，顶部显示用户名和退出登录。

本切片要保证游客端体验不暴露后台入口，并且不破坏登录后的 HOME、景点、路线、AI 导游既有功能。

## Acceptance criteria

- [ ] 未登录访问游客端 HOME 时，顶部只显示 HOME、LOGIN、REGISTER。
- [ ] 未登录 HOME 中原本直接进入 SPOTS、ROUTES、GUIDE 的快捷入口被隐藏或替换为登录/注册引导。
- [ ] 未登录访问 `/spots`、`/spots/:spotId`、`/routes`、`/guide` 时回到 HOME 或被清晰拦截。
- [ ] 未登录状态下游客端不显示 OPS 管理入口。
- [ ] 登录后游客端显示 HOME、SPOTS、ROUTES、GUIDE，不显示 OPS。
- [ ] 登录后顶部显示 username 和 LOG OUT。
- [ ] 点击 LOG OUT 清除 `a5_visitor_token`，界面回到未登录 HOME 状态。
- [ ] 游客 token 无效时前端清理登录态并回到未登录 HOME。
- [ ] HOME 所需摘要数据仍可公开展示。
- [ ] 登录后的景点列表、景点详情、路线推荐、AI 导游问答入口保持可用。

## Blocked by

- [01-visitor-auth-minimal-loop.md](01-visitor-auth-minimal-loop.md)
