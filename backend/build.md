# 后端初始化
cd D:\A5-backend-optimization-backend-optimization\backend
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env
# 填写api_key

# 前端初始化
cd ..
cd frontend
npm install
.\BUILD-FRONTEND.bat
<!--
# 或者
cd frontend
npm run build
cd ..
-->
