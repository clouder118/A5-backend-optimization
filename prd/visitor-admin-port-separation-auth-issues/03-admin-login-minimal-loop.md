# 管理端独立登录最小闭环

Status: completed

## Parent

[游客端与管理端端口分离及登录注册 PRD](../visitor-admin-port-separation-auth.md)

## What to build

实现管理端真实登录闭环。后端启动时创建默认管理员账号，默认用户名为 `admin`，默认密码为 `123456`，且只在账号不存在时创建。管理端提供登录页，不提供注册入口；管理员登录成功后保存管理员 token 并进入 dashboard，退出后回到管理登录页。

本切片只要求管理端登录身份闭环跑通，不要求所有后台 API 完成权限拦截。

## Acceptance criteria

- [ ] 后端统一用户数据模型支持 `admin` role。
- [ ] 后端启动时在不存在默认管理员时创建 `admin / 123456`。
- [ ] 默认管理员用户名和密码可通过配置覆盖，默认密码为 `123456`。
- [ ] 默认管理员已存在时，启动流程不覆盖已有密码。
- [ ] 管理员登录接口只允许 admin role 登录。
- [ ] 管理员登录成功返回 admin token 和用户信息，前端保存为 `a5_admin_token`。
- [ ] 管理端登录页没有注册入口。
- [ ] 管理员登录成功后进入 dashboard。
- [ ] 管理端 LOG OUT 清除 `a5_admin_token` 并回到登录页。
- [ ] 后端测试覆盖默认管理员创建、管理员登录成功、错误密码、游客账号不能登录管理端。

## Blocked by

- [01-visitor-auth-minimal-loop.md](01-visitor-auth-minimal-loop.md)
