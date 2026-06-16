# Live2D 资源说明

本目录用于前端 Live2D 数字人演示。

## 当前模型

- `models/Haru/` 来自本地下载的 `haru_greeter_pro_jp/runtime`，项目内只保留运行必需资产。
- 前端 SDK Framework 采用官方 `CubismWebFramework` 的 `5-r.4` tag，以匹配当前 Core 5.1 运行时。
- 使用前请确认 Haru 模型、Live2D Core 和 Framework 的许可与比赛展示用途。
- 后续替换为定制景区讲解员模型时，保持 `.model3.json`、`.moc3`、纹理、motions 等相对路径完整即可。

## Cubism Core

官方 Cubism Core 不在 GitHub 中公开。本项目当前已放置：

- `core/live2dcubismcore.min.js`

该文件来自 Live2D 官方 Cubism Core for Web 运行时下载地址，版本日志显示为 `Live2D Cubism SDK Core Version 5.1.0`。

缺少该文件时，前端会自动回退到当前 PNG 数字人，不会白屏。

参赛或公开部署前，请再次确认 Live2D Core、Framework 和 Haru 模型的许可条款，并在项目说明中标注素材来源。
