# 登录注册 UI 与移动端适配

Status: completed

## Parent

[游客端与管理端端口分离及登录注册 PRD](../visitor-admin-port-separation-auth.md)

## What to build

把游客登录/注册和管理端登录界面打磨到与现有 UI 风格一致。游客登录/注册使用暗色景区导览风格，可结合景区照片背景、括号化按钮和简洁表单；管理登录使用暗色运营控制台风格。桌面和移动端都需要可用、稳定、无溢出。

## Acceptance criteria

- [ ] 游客登录页符合当前暗色、括号化、景区导览视觉语言。
- [ ] 游客注册页与游客登录页风格一致。
- [ ] 管理端登录页符合暗色运营控制台风格，不出现游客营销式后台入口混杂。
- [ ] 登录、注册、错误提示、提交中状态、禁用重复提交状态都清晰可见。
- [ ] 桌面视口下表单布局稳定，背景或装饰元素不遮挡输入。
- [ ] 移动视口下表单可完整使用，无横向滚动、文字溢出、按钮挤压或内容遮挡。
- [ ] UI 使用现有 Ant Design、Ant Design Icons、全局样式和项目视觉 token，不引入新 UI 框架。
- [ ] 页面文案保持简洁，不添加大段使用说明。

## Blocked by

- [01-visitor-auth-minimal-loop.md](01-visitor-auth-minimal-loop.md)
- [03-admin-login-minimal-loop.md](03-admin-login-minimal-loop.md)
- [05-dual-frontend-entrypoints.md](05-dual-frontend-entrypoints.md)
