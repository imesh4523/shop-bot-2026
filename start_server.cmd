@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "c:\Users\Administrator\Downloads\shop-bot-2026-main\shop-bot-2026-main"
echo [START] Starting ShopBot Production Server...
node --max-http-header-size=80000 --max-old-space-size=4096 dist/index.cjs
