@echo off
setlocal
chcp 65001 >nul

set "ROOT=%~dp0.."
set "FRONTEND=%ROOT%\frontend"
set "PORT=%~1"
if "%PORT%"=="" set "PORT=5173"
set "LOG=%FRONTEND%\frontend-local-server-%PORT%.log"
set "ERR=%FRONTEND%\frontend-local-server-%PORT%.err.log"
set "NODE=node"

where node >nul 2>nul
if errorlevel 1 if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe" (
  set "NODE=C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe"
)

cd /d "%ROOT%"
set "FRONTEND_PORT=%PORT%"
"%NODE%" scripts\serve-frontend-static.mjs 1>> "%LOG%" 2>> "%ERR%"
