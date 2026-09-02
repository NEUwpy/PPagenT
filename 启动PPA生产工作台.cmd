@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。请先安装 Node.js 20 或更高版本。
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo 首次运行，正在安装公开依赖...
  call npm ci
  if errorlevel 1 goto :failed
)

call npm run setup:workspace
if errorlevel 1 goto :failed

node src\launcher\ppa-production-main.cjs
if errorlevel 1 goto :failed
exit /b 0

:failed
echo.
echo PPA 生产工作台启动失败，请查看上方错误信息。
pause
exit /b 1
