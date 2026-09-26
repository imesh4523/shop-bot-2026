@echo off
set "PATH=C:\Program Files\nodejs;C:\Program Files\PostgreSQL\17\bin;C:\Program Files\PostgreSQL\16\bin;%PATH%"
set PORT=5000
set NODE_ENV=production
set DATABASE_URL=postgres://postgres:postgres@localhost:5432/shopbot
set SESSION_SECRET=shopbot_super_secret_session_key_2026
set ADMIN_EMAIL=admin@shopeefy.com
set ADMIN_PASSWORD=admin123

cd /d "c:\Users\Administrator\Downloads\shop-bot-2026-main\shop-bot-2026-main"
echo [START] Starting ShopBot Server on port 5000...
node --max-old-space-size=4096 dist/index.cjs
