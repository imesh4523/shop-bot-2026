@echo off
title ShopBot + Nginx Startup
echo [1/3] Killing old node/nginx processes...
taskkill /F /IM nginx.exe >nul 2>nul
taskkill /F /IM node.exe >nul 2>nul
timeout /t 2 >nul

echo [2/3] Starting Node.js App on port 5000...
set PATH=C:\Program Files\nodejs;C:\Program Files\PostgreSQL\17\bin;%PATH%
set PORT=5000
set NODE_ENV=production
set DATABASE_URL=postgres://postgres:postgres@localhost:5432/shopbot
set SESSION_SECRET=shopbot_super_secret_session_key_2026
set ADMIN_EMAIL=admin@shopeefy.com
set ADMIN_PASSWORD=admin123
start ""ShopBot App"" /B node --max-old-space-size=4096 --max-http-header-size=80000 dist\index.cjs
timeout /t 5 >nul

echo [3/3] Starting Nginx Reverse Proxy on port 80...
start ""Nginx"" /B C:\nginx\nginx.exe
timeout /t 2 >nul

echo.
echo ====================================
echo  ShopBot is running!
echo  App  : http://localhost:5000
echo  Web  : http://youuhost.com
echo ====================================
pause