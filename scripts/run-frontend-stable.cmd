@echo off
setlocal
chcp 65001 >nul

set "ROOT=%~dp0.."
set "FRONTEND=%ROOT%\frontend"
set "PORT=%~1"
set "ENTRY=%~2"
if "%PORT%"=="" set "PORT=5173"
if "%ENTRY%"=="" set "ENTRY=visitor"
set "LOG=%FRONTEND%\frontend-%ENTRY%-local-server-%PORT%.log"
set "ERR=%FRONTEND%\frontend-%ENTRY%-local-server-%PORT%.err.log"
set "NODE=node"

where node >nul 2>nul
if errorlevel 1 if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe" (
  set "NODE=C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe"
)

cd /d "%ROOT%"
set "FRONTEND_PORT=%PORT%"
set "FRONTEND_ENTRY=%ENTRY%"
"%NODE%" scripts\serve-frontend-static.mjs 1>> "%LOG%" 2>> "%ERR%"
