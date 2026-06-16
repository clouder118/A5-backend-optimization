@echo off
setlocal

for %%P in (5173 5174 5175 5176 8001 5200) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
    echo Stopping process %%A on port %%P
    taskkill /F /PID %%A >nul 2>nul
  )
)

echo Local V1 ports are clear: 5173, 5174, 5175, 5176, 8001, 5200
if /I not "%~1"=="nopause" pause
