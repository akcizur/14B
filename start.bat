@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 20+ is required.& pause & exit /b 1)
if not exist node_modules (
  echo Installing Three.js and Vite...
  call npm install || (pause & exit /b 1)
)
call npm run dev
pause
