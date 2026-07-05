# 灵山胜境项目交接文档：151 Unity WebGL 数字人继续改进

更新时间：2026-07-02  
项目路径：`D:\codex files\zrb-1`

这份文档是给下一个 Codex / 新账号 / 新线程看的。当前最重要的任务不是路线、RAG 或后台，而是继续把 `/guide` 页面里的 151 数字人调到比赛展示可用的状态。

## 1. 项目当前状态概览

这是“灵山胜境景点导览”比赛项目的最新本地版本，主要功能包括：

- 游客端首页、景点导览、景点详情、路线推荐、路线编辑、开始游览、行程回顾。
- 双景区地图：灵山胜境、拈花湾。
- 路线规划：已做过个性化推荐、路网路径、路线草稿、游览会话。
- AI 导游问答：MiMo + RAG + 百炼 embedding 的方向已经做过多轮改造。
- 当前正在重点替换数字人形象：从旧 Live2D / three-vrm 方案，改为 Unity WebGL 151 模型播放器。

当前用户最关心的是：

1. 数字人动作要接近 Unity 里预览时的效果，不能乱动。
2. 数字人背景要透明，不能出现 Unity 黑色加载框。
3. 数字人要有自然眨眼、讲解口型、状态表情。
4. 现在仍有“脸部一闪一闪”的问题，需要继续解决。

## 2. 启动方式

项目根目录：

```powershell
cd "D:\codex files\zrb-1"
```

推荐启动：

```powershell
.\START-HERE.bat
```

注意：

- 用户明确说过：`start-local.bat` 只启动前端，不完整。
- `START-HERE.bat` 才是前后端一起启动。
- 常用前端地址：`http://127.0.0.1:5173`
- 后端地址：`http://127.0.0.1:8001`
- AI 导游页面：`http://127.0.0.1:5173/guide`

测试登录账号：

```text
账号：visitor_001
密码：123456
```

本地验证时可以用浏览器登录，也可以在 Playwright 里调用登录接口后写入 `localStorage`。

## 3. 不要提交或泄露的内容

不要提交：

- `.env`
- 真实 API Key
- `backend/.venv`
- `frontend/node_modules`
- 本地数据库、日志、缓存
- 临时截图目录
- Unity 临时工程
- 真实评测完整回答报告

当前项目里真实 API Key 可能存在于本机 `.env` 中，交接时不要复制到文档、不要输出到终端。

## 4. 当前数字人方案：Unity WebGL，而不是前端硬套动作

之前失败过的方案：

- 前端用 three-vrm 加载 VRM/FBX。
- 直接把 Mixamo FBX 动作“改骨骼名后”套到 VRM 上。
- 结果：骨骼轴向不一致，动作会乱飞、手臂变形、身体乱扭。

现在采用的方案：

- 在 Unity 中正规 Humanoid Retarget。
- 将 Unity 里已经能正常播放动作的 151 模型场景构建成 WebGL。
- 前端只嵌入 Unity WebGL 输出，不再负责动作重定向。
- 前端只向 Unity 发送状态：`welcome / idle / thinking / speaking / fallback`。

这条路线是对的，因为用户明确说：“希望达到我们之前在 Unity 里看到的动作效果。”

## 5. 数字人相关文件

### 前端组件

```text
D:\codex files\zrb-1\frontend\src\components\guide\UnityWebGLGuideStage.tsx
```

职责：

- 加载 Unity WebGL loader。
- 创建隐藏的 Unity 原始 canvas。
- 读取 Unity canvas 帧，抠掉背景色后画到 composite canvas。
- 根据聊天状态向 Unity 发送数字人状态。
- 隐藏 Unity 默认黑框和 Unity Logo 加载过程。

### 前端配置

```text
D:\codex files\zrb-1\frontend\src\config\avatar151Guide.ts
```

职责：

- 定义 Unity WebGL 资源路径。
- 定义资源版本号，避免浏览器缓存旧包。
- 当前版本号已更新到：

```ts
const unityWebglVersion = '20260702-avatar151-webgl-v10-soft-light-face';
```

如果重新构建数字人资源，建议继续改这个版本号。

### 全局样式

```text
D:\codex files\zrb-1\frontend\src\styles\global.css
```

数字人相关点：

- `.unity-avatar-canvas-source`：Unity 原始 canvas 被放到屏幕外，不直接显示，避免黑色加载框。
- `.unity-avatar-composite-canvas`：实际展示给用户看的透明合成 canvas。
- 数字人大小、位置、缩放也在这里。

之前用户多次调过数字人的尺寸与位置，目前大致要求是：

- 不露全身；
- 下界大概到膝盖或大腿附近；
- 人物比最初大很多；
- 不能只露头；
- 不能挡住聊天框太多。

### Unity 控制脚本

```text
D:\codex files\zrb-1\tools\unity\Avatar151GuideWebGLController.cs
```

职责：

- 接收前端状态。
- 切换 Unity Animator 状态。
- 控制眨眼、口型、表情。
- 当前已经改为精确绑定 151 模型真实存在的 blendshape：

```text
vrc.blink_left
vrc.blink_right
vrc.lowerrid_left
vrc.lowerrid_right
vrc.v_aa
vrc.v_ih
vrc.v_ou
vrc.v_e
vrc.v_oh
```

运行时浏览器 console 中曾确认：

```text
[Avatar151] Exact blend targets - blink:2, lowerrid:2, aa:1, ih:1, ou:1, e:1, oh:1
```

这说明表情键确实绑定到了。

### Unity 构建器

```text
D:\codex files\zrb-1\tools\unity\Avatar151GuideWebGLBuilder.cs
```

职责：

- 创建 Unity WebGL 场景。
- 配置模型、动作、相机、灯光、材质。
- 构建 WebGL 输出。

最近为了修脸部闪烁，做过：

- 降低主光强度；
- 增强环境柔光；
- 关闭阴影；
- 降低材质高光、smoothness、glossiness；
- 尝试减少鼻子位置突然发亮。

### Unity 构建脚本

```text
D:\codex files\zrb-1\scripts\build-avatar151-webgl.ps1
```

运行方式：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\codex files\zrb-1\scripts\build-avatar151-webgl.ps1"
```

输出：

```text
临时输出：D:\avatar151-guide
复制到前端：D:\codex files\zrb-1\frontend\public\avatar\uketsukejou151\unity-webgl
日志：D:\codex files\zrb-1\.codex-avatar-debug\unity-avatar151-webgl-build.log
```

### Unity 临时工程

```text
D:\avatar151-unity-project
```

这是构建脚本使用的 Unity 工程。注意它不在项目目录内，但当前数字人构建依赖它。

## 6. 当前动作配置

用户选定 151 模型后，筛过动作。

当前重点动作：

- 初始欢迎：`01` 文件夹里的 8 号动作。
- 空闲状态：
  - `01` 文件夹里的 4 号动作；
  - `05` 文件夹里的 19 号动作。
- 思考状态：
  - `05` 文件夹里的 20 号动作；
  - `05` 文件夹里的 29 号动作。
- 讲解状态：
  - `01` 文件夹里的 14 号动作；
  - `01` 文件夹里的 15 号动作；
  - `05` 文件夹里的 32 号动作；
  - `05` 文件夹里的 48 号动作。

在 Unity 构建器里对应状态名大致是：

```csharp
new GuideClip("welcome_wave_08", "welcome", false, "guide_welcome_waving_01.fbx"),
new GuideClip("idle_neutral_04", "idle", true, "guide_idle_neutral_01.fbx"),
new GuideClip("idle_or_think_19", "idle", true, "19_"),
new GuideClip("think_20", "thinking", true, "20_"),
new GuideClip("think_deep_nod_29", "thinking", true, "29_"),
new GuideClip("talk_basic_14", "speaking", true, "guide_talk_basic_02.fbx"),
new GuideClip("talk_basic_15", "speaking", true, "guide_talk_basic_03.fbx"),
new GuideClip("talk_confirm_32", "speaking", true, "32_"),
new GuideClip("talk_waist_48", "speaking", true, "48_"),
```

状态切换用 Unity `Animator.CrossFade`，不是前端切动画。

## 7. 已经解决过的问题

### 7.1 动作乱飞

根因：前端硬套 FBX 到 VRM。  
解决：改为 Unity WebGL 播放器。

### 7.2 Unity 黑色加载框 / Made with Unity Logo

之前用户非常反感打开页面时出现 Unity 黑框和 Logo。

当前策略：

- Unity 原始 canvas 不直接显示；
- 放在屏幕外；
- 只有当合成 canvas 检测到真实人物画面后才显示；
- 不显示 Unity 加载阶段。

如果再次出现黑框，重点查：

```text
D:\codex files\zrb-1\frontend\src\components\guide\UnityWebGLGuideStage.tsx
D:\codex files\zrb-1\frontend\src\styles\global.css
```

### 7.3 绿色闪一下 / 绿边

之前为了抠透明，Unity 背景改成了绿色键控。后来用户说绿边更难看。

前端做过处理：

- 绿色背景像素透明；
- 人物边缘做 despill；
- 绿色边缘转暖白/透明；
- 避免绿边明显。

如果又出现绿边，重点看 `drawTransparentAvatarFrame`。

### 7.4 人物位置和大小

经历过多轮调整：

- 一开始太小；
- 后来只露头；
- 又调到大腿/膝盖附近；
- 用户目前希望是大一些、但不要只露头。

相关位置在两个地方：

1. Unity 相机：

```text
D:\codex files\zrb-1\tools\unity\Avatar151GuideWebGLBuilder.cs
```

2. 前端 CSS 合成画布：

```text
D:\codex files\zrb-1\frontend\src\styles\global.css
```

建议优先调 Unity 相机，少用 CSS 硬缩放。

## 8. 当前还没完全解决的问题

### 8.1 脸部一闪一闪

用户最新反馈：

> 大部分时候都是正常状态，然后突然闪一下，像是光线没打好一样，鼻子那一块比较亮，闪一下又回去。

可能原因按优先级：

1. Unity 光照/材质高光：动作或头部轻微转动时，高光扫到鼻子。
2. 前端绿幕抠像：某些帧的皮肤像素被误判或颜色被 despill 改坏。
3. 表情 blendshape：如果某个表情键误触发，会让脸部形状/法线变化，看起来像闪。
4. WebGL 帧率/合成：`getImageData` 每帧读取可能导致帧不稳定，但这更像卡顿，不太像鼻子变亮。

最近已做但尚未得到用户确认的修复：

- Unity 控制脚本精确绑定表情键；
- 加了 `lowerrid` 辅助眨眼；
- 眨眼权重提高；
- 口型权重提高；
- Unity 环境光提高、主光降低；
- 材质高光/smoothness/glossiness 调为 0；
- 重新构建 WebGL；
- 前端 `npm run build` 通过；
- 自动截图已输出到：

```text
D:\codex files\zrb-1\.codex-avatar-debug\avatar-v10-idle-0.png
D:\codex files\zrb-1\.codex-avatar-debug\avatar-v10-idle-1.png
D:\codex files\zrb-1\.codex-avatar-debug\avatar-v10-idle-2.png
D:\codex files\zrb-1\.codex-avatar-debug\avatar-v10-speaking-0.png
D:\codex files\zrb-1\.codex-avatar-debug\avatar-v10-speaking-1.png
D:\codex files\zrb-1\.codex-avatar-debug\avatar-v10-speaking-2.png
D:\codex files\zrb-1\.codex-avatar-debug\avatar-v10-speaking-3.png
D:\codex files\zrb-1\.codex-avatar-debug\avatar-v10-speaking-4.png
```

但是当前线程还没来得及人工查看截图，用户就要求写交接文档了。

下一步建议：

- 先让用户 `Ctrl+F5` 强刷 `/guide`。
- 看 v10 版本是否还闪。
- 如果还闪，优先做“非抠像方案”：尝试让 Unity WebGL canvas 原生透明，而不是绿幕抠透明。

### 8.2 眨眼不明显

已经绑定到了：

```text
vrc.blink_left
vrc.blink_right
vrc.lowerrid_left
vrc.lowerrid_right
```

当前参数：

- blink：最高 92
- lowerrid：最高 34
- 眨眼间隔：1.8–3.8 秒

如果用户仍觉得不明显，可以：

- blink 提到 100；
- lowerrid 降低或提高看效果；
- 让第一次进入页面 1 秒后强制眨眼一次，方便用户看到。

### 8.3 嘴型不明显

已经绑定到了：

```text
vrc.v_aa
vrc.v_ih
vrc.v_ou
vrc.v_e
vrc.v_oh
```

当前参数已经提高过：

- aa：100
- ih：68
- ou：78
- e：62
- oh：92

如果仍不明显，下一步建议：

1. 在 Unity 里临时做一个“口型测试模式”，每秒单独切一个 viseme，确认哪个键实际能让嘴最明显张开。
2. 如果 `vrc.v_aa` 也不明显，就不能只靠 blendshape，可能需要 jaw bone 或换表情资源。
3. 不建议再用模糊匹配，否则可能又触发脸部闪烁。

## 9. 调试数字人的推荐方法

### 9.1 浏览器手动测试

启动项目后打开：

```text
http://127.0.0.1:5173/guide
```

登录 `visitor_001 / 123456`。

观察：

- 页面首次进入：是否打招呼；
- 停留 10 秒：是否有眨眼；
- 点击播放或提问：是否进入讲解状态；
- 讲解时：嘴型是否动；
- 脸部：是否还会鼻子一亮一暗。

### 9.2 控制台调试

前端暴露了调试接口：

```js
window.__avatar151Debug.playMotion('idle')
window.__avatar151Debug.playMotion('thinking')
window.__avatar151Debug.playMotion('speaking')
window.__avatar151Debug.speakText('欢迎来到灵山胜境，我来为你讲讲这里的看点。')
window.__avatar151Debug.getCurrentState()
```

注意：

- `playMotion('speaking')` 只切换动作；
- `speakText(...)` 会重置嘴型时间；
- 如果没有 TTS，也可以用这个模拟说话。

### 9.3 Playwright 自动截图

可以用 Playwright 截图，但截图只能看某一帧，眨眼和口型最好还是让用户肉眼看动态效果。

之前生成截图的目录：

```text
D:\codex files\zrb-1\.codex-avatar-debug
```

## 10. 重要构建命令

### 重建 Unity WebGL 数字人

```powershell
cd "D:\codex files\zrb-1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\codex files\zrb-1\scripts\build-avatar151-webgl.ps1"
```

成功输出类似：

```text
Avatar151 Unity WebGL temp output: D:\avatar151-guide
Avatar151 Unity WebGL copied to: D:\codex files\zrb-1\frontend\public\avatar\uketsukejou151\unity-webgl
Unity build log: D:\codex files\zrb-1\.codex-avatar-debug\unity-avatar151-webgl-build.log
```

### 前端构建

```powershell
cd "D:\codex files\zrb-1\frontend"
npm.cmd run build
```

最近一次构建通过。

### 可能出现的无害报错

PowerShell 经常输出：

```text
File D:\Users\22560\22560\WindowsPowerShell\profile.ps1 cannot be loaded because running scripts is disabled...
```

这通常是 PowerShell 个人 profile 加载失败，不影响构建是否成功。看 exit code 和实际构建输出即可。

## 11. 文件修改边界

用户要求：

- 只替换/改进数字人部分；
- 不要把路线、RAG、页面其他部分改乱；
- 原来冗余的数字人部分可以删除，但如果风险高，先不要删，先隔离弃用。

因此继续工作时，优先只动这些文件：

```text
D:\codex files\zrb-1\tools\unity\Avatar151GuideWebGLController.cs
D:\codex files\zrb-1\tools\unity\Avatar151GuideWebGLBuilder.cs
D:\codex files\zrb-1\frontend\src\components\guide\UnityWebGLGuideStage.tsx
D:\codex files\zrb-1\frontend\src\config\avatar151Guide.ts
D:\codex files\zrb-1\frontend\src\styles\global.css
D:\codex files\zrb-1\frontend\public\avatar\uketsukejou151\unity-webgl\
```

除非用户明确要求，不要改：

```text
backend/app/services/chat.py
backend/app/services/rag.py
frontend/src/pages/visitor/RouteRecommendPage.tsx
frontend/src/components/scenic/*
```

## 12. 当前 git 状态提醒

当前工作区不是干净的，里面有很多历史改动和未跟踪文件，包括：

- RAG / MiMo / embedding 改动；
- 路线和游客端改动；
- `frontend/dist` 变化；
- Unity / avatar151 新资源；
- 调试截图和临时目录。

不要随便 `git reset --hard`，不要随便清理。

如果下一位要提交，建议先让用户确认提交范围。数字人相关提交至少应包含：

```text
frontend/src/components/guide/UnityWebGLGuideStage.tsx
frontend/src/config/avatar151Guide.ts
frontend/src/styles/global.css
frontend/public/avatar/uketsukejou151/unity-webgl/
scripts/build-avatar151-webgl.ps1
scripts/build-avatar151-webgl.bat
tools/unity/Avatar151GuideWebGLBuilder.cs
tools/unity/Avatar151GuideWebGLController.cs
```

是否提交 `frontend/dist` 由用户决定。

## 13. 如果继续解决“闪烁”，建议路线

### 优先方案 A：彻底去掉绿幕抠像，改 Unity 原生透明

这是最干净的方向。

现在前端还在做：

```text
Unity 绿色背景 -> getImageData -> 抠绿 -> composite canvas
```

缺点：

- 每帧读取像素比较重；
- 抠像可能影响脸部颜色；
- 可能造成绿边、白边或颜色闪烁。

更好的方向：

- Unity 相机 clear alpha = 0；
- WebGL canvas 用 alpha；
- 前端直接显示 Unity canvas；
- 不再逐帧抠像。

难点：

- Unity 2020 WebGL 原生透明有兼容坑；
- 需要改 WebGL template 或 camera clear；
- 但如果成功，画面会稳定很多。

### 备选方案 B：保留绿幕，但只抠背景，不碰人物颜色

如果不做原生透明，可以减少对人物像素的处理：

- 背景色严格用纯绿；
- 只把“非常绿”的像素 alpha=0；
- 对边缘像素少做颜色重写；
- 不对皮肤区域做 despill；
- 或者人物周围加一点浅色描边遮瑕。

### 备选方案 C：固定脸部材质为 Unlit/Toon

如果闪烁来自高光：

- 皮肤材质改成 `Unlit/Texture` 或 toon shader；
- 或 Standard 材质彻底关 specular；
- 灯光影响会小很多；
- 缺点是质感可能更平，但至少不会闪。

当前已经尝试关闭 Standard 高光，但如果仍闪，说明还需要更强的材质策略。

## 14. 用户沟通偏好

用户希望：

- 直接帮他做，不要反复让他自己查；
- 但最终视觉效果需要他人工确认；
- 出现问题要说明原因和下一步；
- 不要卡住，长任务要持续汇报；
- 不要把项目文件弄到别的目录；
- 当前项目就是 `D:\codex files\zrb-1`。

如果需要启动项目：

- 用 `START-HERE.bat`；
- 不要用 `start-local.bat` 来冒充完整启动。

## 15. 给下一位 Codex 的第一步建议

接手后建议按这个顺序做：

1. 打开本文件阅读。
2. 确认服务是否在跑：

   ```powershell
   Get-NetTCPConnection -LocalPort 5173,8001 -ErrorAction SilentlyContinue
   ```

3. 打开 `/guide`，强刷缓存：`Ctrl + F5`。
4. 用浏览器控制台测试：

   ```js
   window.__avatar151Debug.playMotion('speaking')
   window.__avatar151Debug.speakText('欢迎来到灵山胜境，我来为你讲讲这里的看点。')
   ```

5. 看 v10 是否还闪。
6. 如果仍闪，优先尝试“Unity 原生透明 canvas”，减少前端逐帧抠像。
7. 如果只是嘴型不明显，先在 Unity 里做单独 viseme 测试，不要再扩大模糊匹配。

## 16. 一句话总结

当前项目功能主线已经基本完整，数字人也已经从“前端硬套动作”切到了正确的 Unity WebGL 路线。现在最需要继续打磨的是：151 模型在 `/guide` 页面中的视觉稳定性、眨眼、口型和表情质感。最近一次 v10 已经构建完成，但仍需要用户人工确认是否解决“脸部一闪一闪”的问题。

