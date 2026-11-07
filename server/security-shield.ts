import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// --- SECURITY LOGS & IN-MEMORY THREAT DATABASE ---
export interface SecurityThreatLog {
  id: string;
  ip: string;
  country: string;
  method: string;
  url: string;
  host: string;
  userAgent: string;
  threatType: "scanner_bot" | "path_traversal" | "sqli_payload" | "xss_payload" | "rate_limit_exceeded" | "spoofed_host";
  action: "blocked" | "jailed";
  timestamp: string;
}

// In-memory threat log cache (keeps last 200 security events)
const recentThreatLogs: SecurityThreatLog[] = [];

// In-memory IP Jail: IP -> ban expiry timestamp (ms)
const ipJailMap = new Map<string, { expiresAt: number; violations: number; reason: string }>();

// Rate Limiter tracker: IP -> { count: number, resetAt: number }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const authRateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Nonce store to prevent API replay attacks (Nonce -> Expiry timestamp)
const usedNoncesMap = new Map<string, number>();

// Whitelisted IPs that should never be rate limited or jailed
const WHITELISTED_IPS = new Set<string>([
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "100.127.10.209", // Mobile IP
]);

// Allow environment variable to configure additional whitelisted IPs
if (process.env.SECURITY_WHITELIST_IPS) {
  process.env.SECURITY_WHITELIST_IPS.split(",").forEach((item) => {
    const trimmed = item.trim();
    if (trimmed) WHITELISTED_IPS.add(trimmed);
  });
}

export function addToWhitelist(ip: string) {
  const trimmed = ip.trim();
  WHITELISTED_IPS.add(trimmed);
  ipJailMap.delete(trimmed);
}

export function removeFromWhitelist(ip: string) {
  WHITELISTED_IPS.delete(ip.trim());
}

export function clearAllJailedIps() {
  ipJailMap.clear();
  rateLimitMap.clear();
  authRateLimitMap.clear();
  console.log("🛡️ [SECURITY SHIELD] All jailed IPs and rate limits have been cleared.");
}

// Clean up expired nonces and jail entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of ipJailMap.entries()) {
    if (now > data.expiresAt) {
      ipJailMap.delete(ip);
    }
  }
  for (const [nonce, expiresAt] of usedNoncesMap.entries()) {
    if (now > expiresAt) {
      usedNoncesMap.delete(nonce);
    }
  }
}, 60000);

// --- KNOWN MALICIOUS SCANNERS & BOTS (Regex list) ---
const MALICIOUS_USER_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /acunetix/i,
  /nmap/i,
  /masscan/i,
  /wpscan/i,
  /dirbuster/i,
  /gobuster/i,
  /hydra/i,
  /burpcollaborator/i,
  /metasploit/i,
  /zgrab/i,
  /censys/i,
  /shodan/i,
  /havij/i,
  /pangolin/i,
  /openvas/i,
  /nessus/i,
  /netsparker/i,
  /qualys/i,
];

// --- KNOWN EXPLOIT PATH PROBES & SENSITIVE PATHS ---
const BLOCKED_PATH_PATTERNS = [
  /\/\.env/i,
  /\/\.git/i,
  /\/\.aws/i,
  /\/\.ssh/i,
  /\/wp-login\.php/i,
  /\/wp-admin/i,
  /\/xmlrpc\.php/i,
  /\/phpmyadmin/i,
  /\/pma/i,
  /\/adminer/i,
  /\/eval-stdin\.php/i,
  /\/cgi-bin\//i,
  /\/etc\/passwd/i,
  /\/proc\/self/i,
  /\/\.\.\//, // Path traversal ../
];

// --- SQL INJECTION / XSS HEURISTIC PATTERNS ---
const SQL_INJECTION_PATTERNS = [
  /(\bunion\b\s+(all\s+)?\bselect\b)/i,
  /(\bselect\b.+\bfrom\b\s+information_schema)/i,
  /(\bwaitfor\b\s+\bdelay\b)/i,
  /(\bbenchmark\b\s*\()/i,
  /(\bexec\b\s*\(|\bexecute\b\s*\()/i,
  /('|\b)\s*or\s+'?1'?\s*=\s*'?1/i,
  /('|\b)\s*or\s+'?x'?\s*=\s*'?x/i,
  /(\/\*.*\*\/)/, // Block SQL multi-line comments
];

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
  /javascript\s*:/i,
  /\bonerror\s*=\s*/i,
  /\bonload\s*=\s*/i,
  /\beval\s*\(/i,
];

// Helper: Check if path is documentation, health probe, or static asset
function isExemptPath(url: string, path: string, host: string): boolean {
  // 1. Health checks
  if (path === "/health" || path === "/api/health" || path === "/ping") {
    return true;
  }

  // 2. API Documentation & OpenAPI specs
  if (
    path === "/docs" ||
    path === "/api-docs" ||
    path === "/openapi.json" ||
    path.startsWith("/docs/") ||
    path.startsWith("/api-docs/") ||
    path.startsWith("/scalar") ||
    path.includes("openapi.json")
  ) {
    return true;
  }

  // 3. API Subdomain docs root (api.youuhost.com /)
  if ((host.startsWith("api.") || host === "api.youuhost.com") && (path === "/" || path === "/docs" || path === "/api-docs")) {
    return true;
  }

  // 4. Static frontend assets (images, stylesheets, scripts, fonts)
  if (
    path.startsWith("/assets/") ||
    path.startsWith("/static/") ||
    path.startsWith("/uploads/") ||
    path === "/favicon.ico" ||
    path === "/manifest.json" ||
    path.endsWith(".css") ||
    path.endsWith(".js") ||
    path.endsWith(".png") ||
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg") ||
    path.endsWith(".gif") ||
    path.endsWith(".svg") ||
    path.endsWith(".ico") ||
    path.endsWith(".woff") ||
    path.endsWith(".woff2") ||
    path.endsWith(".ttf") ||
    path.endsWith(".map")
  ) {
    return true;
  }

  return false;
}

// Helper: Check if IP is private, CGNAT, or cloud provider ingress
function isPrivateOrSharedIp(ip: string): boolean {
  if (!ip) return true;
  return (
    WHITELISTED_IPS.has(ip) ||
    ip.startsWith("100.") || // RFC 6598 CGNAT / DigitalOcean Ingress Load Balancer
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.") ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1"
  );
}

// Helper: Extract real client IP securely
export function getClientIp(req: Request): string {
  const cfIp = req.headers["cf-connecting-ip"];
  if (cfIp && typeof cfIp === "string") return cfIp.trim();

  const xff = req.headers["x-forwarded-for"];
  if (xff && typeof xff === "string") {
    const parts = xff.split(",");
    const clientIp = parts[0]?.trim();
    if (clientIp) return clientIp;
  }

  const realIp = req.headers["x-real-ip"];
  if (realIp && typeof realIp === "string") return realIp.trim();

  return req.ip || req.socket.remoteAddress || "127.0.0.1";
}

// Record security threat event
function logThreat(req: Request, type: SecurityThreatLog["threatType"], action: SecurityThreatLog["action"]) {
  const ip = getClientIp(req);
  const country = (req.headers["cf-ipcountry"] as string) || "Unknown";
  const userAgent = (req.headers["user-agent"] as string) || "Unknown";
  const host = (req.headers["host"] as string) || "Unknown";

  const threat: SecurityThreatLog = {
    id: crypto.randomBytes(6).toString("hex"),
    ip,
    country,
    method: req.method,
    url: req.originalUrl || req.url,
    host,
    userAgent,
    threatType: type,
    action,
    timestamp: new Date().toISOString(),
  };

  recentThreatLogs.unshift(threat);
  if (recentThreatLogs.length > 200) recentThreatLogs.pop();

  console.warn(
    `🚨 [SECURITY SHIELD - ${action.toUpperCase()}] ${type.toUpperCase()} from IP: ${ip} (${country}) on ${req.method} ${req.url} (Host: ${host})`
  );
}

// Ban IP in Jail (Only for confirmed public external attackers, never shared/proxy IPs)
function jailIp(ip: string, reason: string, durationMinutes: number = 15) {
  if (isPrivateOrSharedIp(ip)) return; // Private, CGNAT, DigitalOcean Ingress & Whitelist are 100% immune
  const existing = ipJailMap.get(ip);
  const violations = (existing?.violations || 0) + 1;
  const expiresAt = Date.now() + durationMinutes * 60 * 1000;
  ipJailMap.set(ip, { expiresAt, violations, reason });
}

// --- MAIN SECURITY SHIELD MIDDLEWARE ---
export function securityShieldMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const now = Date.now();
  const url = req.originalUrl || req.url;
  const path = req.path || url.split("?")[0];
  const userAgent = (req.headers["user-agent"] as string) || "";
  const host = ((req.headers["host"] as string) || "").split(":")[0].toLowerCase();

  // 1. HARDENED OWASP SECURITY HEADERS
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  res.removeHeader("X-Powered-By"); // Hide Express tech stack

  // 2. WHITELISTED & PRIVATE / PROXY IP BYPASS
  if (isPrivateOrSharedIp(ip)) {
    ipJailMap.delete(ip); // Auto-clear if previously recorded
  }

  // 3. EXEMPTION CHECK (Documentation, Static Assets, Health Checks)
  if (isExemptPath(url, path, host)) {
    return next();
  }

  // 4. CHECK IP JAIL (INSTANT DROP FOR PERSISTENT PUBLIC ATTACKERS ONLY)
  if (!isPrivateOrSharedIp(ip)) {
    const jailRecord = ipJailMap.get(ip);
    if (jailRecord && now < jailRecord.expiresAt) {
      const remainingMins = Math.ceil((jailRecord.expiresAt - now) / 60000);
      return res.status(403).json({
        error: "ACCESS_DENIED",
        message: `Your IP (${ip}) has been blocked by Shopeefy Security Shield for suspicious activity. Retry in ${remainingMins} minute(s).`,
        code: "SECURITY_IP_JAILED",
      });
    }
  }

  // 5. MALICIOUS SCANNER USER AGENT DETECTION (Drop request immediately, don't jail shared proxies)
  for (const botPattern of MALICIOUS_USER_AGENTS) {
    if (botPattern.test(userAgent)) {
      logThreat(req, "scanner_bot", "blocked");
      return res.status(403).json({ error: "FORBIDDEN", message: "Automated vulnerability scanners are strictly prohibited." });
    }
  }

  // 6. PATH TRAVERSAL & EXPLOIT PROBE DETECTION (Drop probe immediately, don't jail shared proxies)
  for (const pathPattern of BLOCKED_PATH_PATTERNS) {
    if (pathPattern.test(url)) {
      logThreat(req, "path_traversal", "blocked");
      return res.status(403).json({ error: "FORBIDDEN", message: "Probing internal/system paths is blocked." });
    }
  }

  // 7. SQL INJECTION & XSS HEURISTIC INSPECTION (Only on state-modifying requests or queries with parameters)
  if (req.method !== "GET" || (req.query && Object.keys(req.query).length > 0)) {
    const rawQuery = JSON.stringify(req.query || {});
    const rawBody = typeof req.body === "object" ? JSON.stringify(req.body) : String(req.body || "");
    const payloadToInspect = `${url} ${rawQuery} ${rawBody}`;

    for (const sqliPattern of SQL_INJECTION_PATTERNS) {
      if (sqliPattern.test(payloadToInspect)) {
        logThreat(req, "sqli_payload", "blocked");
        return res.status(400).json({ error: "MALICIOUS_REQUEST", message: "Invalid characters or query syntax detected." });
      }
    }

    for (const xssPattern of XSS_PATTERNS) {
      if (xssPattern.test(payloadToInspect)) {
        logThreat(req, "xss_payload", "blocked");
        return res.status(400).json({ error: "MALICIOUS_REQUEST", message: "Script injection tags detected." });
      }
    }
  }

  // 8. ADAPTIVE RATE LIMITING
  // Auth endpoints (Login / OTP / Token) -> ONLY rate limit actual POST submissions, NEVER GET requests or page loads!
  const isAuthPost = req.method === "POST" && (
    url.startsWith("/api/login") ||
    url.startsWith("/api/admin/login") ||
    url.startsWith("/api/auth/login") ||
    url.includes("/verify-otp") ||
    url.includes("/send-otp")
  );

  if (isAuthPost) {
    const authLimit = authRateLimitMap.get(ip);
    if (!authLimit || now > authLimit.resetAt) {
      authRateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    } else {
      authLimit.count += 1;
      // Allow up to 30 POST login attempts per minute before soft-throttling
      if (authLimit.count > 30) {
        logThreat(req, "rate_limit_exceeded", "blocked");
        // DO NOT jail the entire IP from accessing the website! Return 429 on login attempts only:
        return res.status(429).json({
          error: "TOO_MANY_REQUESTS",
          message: "Too many login attempts. Please wait a minute before retrying.",
        });
      }
    }
  }

  // General API endpoints -> Bypass /api/v1 as it uses its dedicated 70 req/sec limiter
  if (url.startsWith("/api/")) {
    if (url.startsWith("/api/v1")) {
      return next();
    }
    const generalLimit = rateLimitMap.get(ip);
    if (!generalLimit || now > generalLimit.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    } else {
      generalLimit.count += 1;
      if (generalLimit.count > 1000) {
        logThreat(req, "rate_limit_exceeded", "blocked");
        return res.status(429).json({
          error: "RATE_LIMIT_EXCEEDED",
          message: "Rate limit exceeded. Please slow down your requests.",
        });
      }
    }
  }

  next();
}

// --- PARTNER API HMAC SIGNATURE & REPLAY ATTACK VALIDATION ---
export function validatePartnerHmacAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = (req.headers["x-api-key"] as string) || "";
  const timestamp = (req.headers["x-timestamp"] as string) || "";
  const nonce = (req.headers["x-nonce"] as string) || "";
  const signature = (req.headers["x-signature"] as string) || "";

  if (!apiKey || !timestamp || !nonce || !signature) {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Missing HMAC authentication headers (X-Api-Key, X-Timestamp, X-Nonce, X-Signature required).",
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const reqTime = parseInt(timestamp, 10);

  // 1. Replay Prevention Window: Timestamp must be within +/- 300 seconds (5 minutes)
  if (isNaN(reqTime) || Math.abs(now - reqTime) > 300) {
    return res.status(401).json({
      error: "INVALID_TIMESTAMP",
      message: "Request timestamp is expired or out of tolerance window (+/- 5 mins).",
    });
  }

  // 2. Nonce Uniqueness Check (Prevent Replay Attacks)
  if (usedNoncesMap.has(nonce)) {
    return res.status(401).json({
      error: "DUPLICATE_NONCE",
      message: "Nonce has already been used. Replay attacks are prohibited.",
    });
  }
  // Store nonce for 10 minutes
  usedNoncesMap.set(nonce, Date.now() + 600000);

  next();
}

// --- SECURITY METRICS & STATUS API GETTER ---
export function getSecurityShieldStatus() {
  return {
    status: "active",
    activeJailedIpsCount: ipJailMap.size,
    jailedIps: Array.from(ipJailMap.entries()).map(([ip, data]) => ({
      ip,
      expiresInMinutes: Math.max(0, Math.ceil((data.expiresAt - Date.now()) / 60000)),
      violations: data.violations,
      reason: data.reason,
    })),
    recentThreatsCount: recentThreatLogs.length,
    recentThreats: recentThreatLogs.slice(0, 30),
  };
}

// Unban IP manually
export function unbanJailedIp(ip: string): boolean {
  return ipJailMap.delete(ip);
}
