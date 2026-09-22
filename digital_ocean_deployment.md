# DigitalOcean App Platform & DevSecOps Deployment Guide

## 🌐 Subdomain & Architecture
* **Frontend Domain**: `https://youuhost.com`
* **API Subdomain**: `https://api.youuhost.com`
* **Platform**: DigitalOcean App Platform + Cloudflare WAF Proxy
* **App Spec**: Located at [`.do/app.yaml`](file:///.do/app.yaml)

---

## 🛠️ Step 1: DigitalOcean App Platform Setup
1. Push this repository to your GitHub/GitLab repository.
2. In DigitalOcean, navigate to **Apps** $\rightarrow$ **Create App**.
3. Select your repository and branch (`main`).
4. Import configuration from [`.do/app.yaml`](file:///.do/app.yaml) or set:
   * **Build Command**: `npm run build`
   * **Run Command**: `node dist/index.cjs`
   * **Port**: `5000`
5. Configure encrypted environment variables in App Platform:
   * `DATABASE_URL` (Encrypted Secret)
   * `SESSION_SECRET` (Encrypted Secret)
   * `ADMIN_PASSWORD` (Encrypted Secret)
   * `TELEGRAM_BOT_TOKEN` (Encrypted Secret)
   * `CORS_ALLOWED_ORIGINS`: `https://youuhost.com,https://www.youuhost.com`
   * `NODE_ENV`: `production`

---

## 🔒 Step 2: Cloudflare & DNS Hardening (api.youuhost.com)
1. **DNS CNAME Record**:
   * Name: `api` (points to your DO default domain: `*.ondigitalocean.app`)
   * Proxy Status: **Proxied (Orange Cloud)**
2. **TLS / SSL Settings**:
   * Encryption Mode: **Full (Strict)**
   * Minimum TLS Version: **TLS 1.2** (TLS 1.3 Recommended)
   * **Always Use HTTPS**: Enabled
   * **HSTS**: Max-age 1 Year (`31536000`), Include Subdomains: ON, Preload: ON
3. **WAF Rules**:
   * Challenge suspicious traffic and block non-standard API HTTP methods.

---

## 🗄️ Step 3: Production Database Schema Migration
Run once against the production PostgreSQL instance:
```bash
npm run db:push
```
