zrb-15 半自动部署迁移说明

一、首次部署步骤

1. 将 zrb-15.zip 解压到目标电脑的一个路径中，例如 D:\zrb-15。
2. 双击运行 检查环境.bat。
3. 双击运行 初始化环境.bat，等待后端 Python 虚拟环境和依赖安装完成。
4. 打开 backend\.env，根据 backend\.env.example 填写需要的密钥：
   - LLM_API_KEY：数字人问答模型密钥。
   - TTS_API_KEY：语音合成密钥，可和 LLM_API_KEY 相同，也可留空使用降级模式。
   - RAG_EMBEDDING_API_KEY 或 DASHSCOPE_API_KEY：联网/向量检索增强能力，可留空。
   - AMAP_KEY、AMAP_SECURITY_CODE：高德地图定位能力，可留空。
5. 双击运行 启动服务.bat。

二、访问地址

游客端：http://127.0.0.1:5173/
数字人导游：http://127.0.0.1:5173/guide
后台管理：http://127.0.0.1:5174/
后端接口：http://127.0.0.1:8001
接口文档：http://127.0.0.1:8001/docs

三、停止服务

双击运行 停止服务.bat。

四、环境要求

1. Windows 10/11。
2. Python 3.10 或更高版本，推荐 Python 3.11。安装时建议勾选 Add python.exe to PATH。
3. Node.js，推荐 18 或更高版本。部署包已包含 frontend\dist，不需要在目标电脑安装前端依赖。
4. 如果目标电脑无法访问 Python 包源，初始化环境时 pip install 可能失败，需要先配置网络或镜像源。

五、打包策略说明

本压缩包保留项目运行所需的源码、静态前端构建、知识数据、演示数据库、启动脚本和文档。
本压缩包不会保留真实 backend\.env、backend\.venv、frontend\node_modules、日志、缓存、测试临时目录和本机运行痕迹。

六、备用脚本

如果目标电脑的命令行对中文文件名兼容不好，也可以运行英文备用脚本：
check-env.bat、init-env.bat、start-service.bat、stop-service.bat。