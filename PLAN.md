# P2 游客端视觉重构计划

## 目标

- 参考 `E:\中软\P2\前端参考模板\infinite-scroll-with-parallax-main.zip` 的 Lenis + GSAP 无限滚动、吸附滚动和视差切换思路，重做 P2 游客端视觉体验。
- 首页改为沉浸式首屏，滚动字幕使用项目名称“灵山胜境导览”，数字人固定展示，背景场景随滚动切换。
- 保留游客端核心功能入口，但减少首页冗余信息密度，优先依赖顶部导航和少量快捷操作。

## 已完成的基础准备

- 已在 `P2-Haru-AIGuide-portable` 初始化 Git 仓库。
- 已提交当前已部署版本：`baseline before visual redesign`。
- 已阅览并解压参考模板，确认其核心为原生 HTML/CSS/JS，使用 Lenis、Lenis Snap、GSAP ScrollTrigger 实现三屏滚动视差。
- 已新增前端依赖：`gsap`、`lenis`。

## 实施范围

- 主要修改：
  - `frontend/src/pages/visitor/HomePage.tsx`
  - `frontend/src/layouts/VisitorLayout.tsx`
  - `frontend/src/styles/global.css`
  - `frontend/package.json`
  - `frontend/package-lock.json`
- 管理后台不纳入本轮视觉重构，避免影响演示后台稳定性。
- 后端和 Live2D 模型资源不改动。

## 视觉与交互

- 首页三屏场景：
  - 灵山大佛：`/scenic/spots/buddha-landmark.svg`
  - 灵山梵宫：`/scenic/spots/palace.svg`
  - 九龙灌浴：`/scenic/spots/water-show.svg`
- 数字人继续使用现有 `AvatarGuide` / Live2D Haru，在首页作为固定视觉主体，不跟随滚动离场。
- 顶部导航改为玻璃质感酒店风格：细边框、暗色透明背景、金色高光、优雅标题。
- 首页底部四个重复按钮已删除，避免与顶部导航功能重复。
- 首页保留右上快捷入口：
  - `立即咨询` -> `/guide`
  - `查看景点` -> `/spots`

## 验收标准

- `npm run build` 成功。
- `START-HERE.bat` 启动后可访问：
  - `http://127.0.0.1:5173/`
  - `http://127.0.0.1:5173/spots`
  - `http://127.0.0.1:5173/routes`
  - `http://127.0.0.1:5173/guide`
  - `http://127.0.0.1:8001/docs`
- 首页首屏显示大数字人、滚动字幕“灵山胜境导览”、三屏滚动背景。
- 滚动时数字人保持稳定，背景与文案有视差切换效果。
- 首页不再显示底部四个冗余入口按钮。
- 桌面和移动端不出现明显文字溢出、按钮重叠或数字人被异常遮挡。
