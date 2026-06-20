# 游客注册登录最小闭环

Status: completed

## Parent

[游客端与管理端端口分离及登录注册 PRD](../visitor-admin-port-separation-auth.md)

## What to build

实现游客端真实后端注册登录闭环。游客可以用用户名和密码注册，后端保存密码哈希并签发 7 天有效的 Bearer token；注册成功后前端自动保存游客 token 并回到游客 HOME。游客也可以用已有账号登录，前端可通过当前用户接口恢复登录态。

本切片只要求游客身份最小闭环跑通，不要求完成所有游客功能门禁，也不要求管理端登录。

## Acceptance criteria

- [ ] 后端存在统一用户数据模型，支持 `visitor` role，并保存密码哈希而不是明文密码。
- [ ] 游客注册接口校验 username 3-32 位、仅字母数字下划线、同 role 下不可重复；password 6-64 位。
- [ ] 游客注册成功返回游客 token 和用户信息，前端保存为 `a5_visitor_token`。
- [ ] 游客登录成功返回游客 token 和用户信息。
- [ ] 当前用户接口能用游客 Bearer token 返回游客身份。
- [ ] token 无效时后端返回 401。
- [ ] 游客注册页和登录页可完成基本输入、错误展示、注册成功自动登录、登录成功回 HOME。
- [ ] 后端测试覆盖注册成功、重复用户名、非法用户名、短密码、登录成功、登录失败、无效 token。

## Blocked by

None - can start immediately
