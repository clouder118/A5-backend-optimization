@echo off
setlocal
chcp 65001 >nul

set "ROOT=%~dp0.."
set "FRONTEND=%ROOT%\frontend"
set "LOG=%FRONTEND%\frontend-local-server-5173.log"
set "ERR=%FRONTEND%\frontend-local-server-5173.err.log"
set "NODE=node"

where node >nul 2>nul
if errorlevel 1 if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe" (
  set "NODE=C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe"
)

cd /d "%ROOT%"
"%NODE%" scripts\serve-frontend-static.mjs 1>> "%LOG%" 2>> "%ERR%"
