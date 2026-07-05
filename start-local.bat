@echo off
setlocal
chcp 65001 >nul

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "PYTHON=%BACKEND%\.venv\Scripts\python.exe"
set "DIST=%FRONTEND%\dist\index.html"
set "BACKEND_LOG=%BACKEND%\backend-local-server-8001.log"
set "BACKEND_ERR=%BACKEND%\backend-local-server-8001.err.log"
set "VISITOR_LOG=%FRONTEND%\frontend-local-server-5173.log"
set "VISITOR_ERR=%FRONTEND%\frontend-local-server-5173.err.log"
set "ADMIN_LOG=%FRONTEND%\frontend-local-server-5174.log"
set "ADMIN_ERR=%FRONTEND%\frontend-local-server-5174.err.log"

echo A5 AI Guide P2 stable launcher
echo Project root: %ROOT%
echo.

if not exist "%PYTHON%" (
  echo Start failed: backend virtual environment was not found.
  echo Missing: %PYTHON%
  echo Please create backend\.venv or run dependency setup first.
  if /I not "%~1"=="nopause" pause
  exit /b 1
)

if not exist "%DIST%" (
  echo Start failed: frontend\dist was not found.
  echo Please run BUILD-FRONTEND.bat first.
  if /I not "%~1"=="nopause" pause
  exit /b 1
)

if not exist "%BACKEND%\.env" if exist "%BACKEND%\.env.example" copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul

echo Skipping automatic port cleanup to avoid startup hangs.
echo If you need a clean restart, run stop-local.bat first, then START-HERE.bat.
echo.

echo Starting backend: http://127.0.0.1:8001
break > "%BACKEND_LOG%"
break > "%BACKEND_ERR%"
start "a5-backend-8001" /min cmd /d /c call "%ROOT%scripts\run-backend-stable.cmd"

echo Starting visitor frontend: http://127.0.0.1:5173
break > "%VISITOR_LOG%"
break > "%VISITOR_ERR%"
start "a5-visitor-5173" /min cmd /d /c call "%ROOT%scripts\run-frontend-stable.cmd" 5173

echo Starting admin frontend: http://127.0.0.1:5174
break > "%ADMIN_LOG%"
break > "%ADMIN_ERR%"
start "a5-admin-5174" /min cmd /d /c call "%ROOT%scripts\run-frontend-stable.cmd" 5174

echo.
echo Services are starting in background.
echo Visitor: http://127.0.0.1:5173/
echo AI Guide: http://127.0.0.1:5173/guide
echo Admin: http://127.0.0.1:5174/
echo Backend docs: http://127.0.0.1:8001/docs
echo.
echo Mode: static frontend server, no Vite, no hot reload.
echo After code changes: run BUILD-FRONTEND.bat, then START-HERE.bat.
echo.

if /I not "%~1"=="nopause" (
  timeout /t 3 /nobreak >nul
  start "" "http://127.0.0.1:5173/"
  pause
)

exit /b 0
