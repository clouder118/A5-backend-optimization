@echo off
setlocal
chcp 65001 >nul

set "ROOT=%~dp0.."
set "BACKEND=%ROOT%\backend"
set "PYTHON=%BACKEND%\.venv\Scripts\python.exe"
set "LOG=%BACKEND%\backend-local-server-8001.log"
set "ERR=%BACKEND%\backend-local-server-8001.err.log"

cd /d "%BACKEND%"
"%PYTHON%" -m uvicorn app.main:app --host 127.0.0.1 --port 8001 1>> "%LOG%" 2>> "%ERR%"
