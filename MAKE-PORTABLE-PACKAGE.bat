@echo off
setlocal
chcp 65001 >nul

set "ROOT=%~dp0"
set "SCRIPT=%ROOT%scripts\make-portable-package.ps1"
set "POWERSHELL=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

"%POWERSHELL%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"

exit /b %ERRORLEVEL%
