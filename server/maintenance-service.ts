/**
 * Advanced System Maintenance Mode Engine
 * Controls store & API lockdown, live Lottie display, and VIP/Staff whitelist access.
 */

import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { apiKeys, telegramUsers } from "@shared/schema";
import { eq, or, sql } from "drizzle-orm";

interface MaintenanceConfig {
  enabled: boolean;
  title: string;
  message: string;
  estimatedEnd: string;
  whitelistEmails: string[];
  whitelistTelegram: string[];
}

let cachedConfig: MaintenanceConfig | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 1000;

export async function getMaintenanceConfig(forceFresh = false): Promise<MaintenanceConfig> {
  const now = Date.now();
  if (!forceFresh && cachedConfig && (now - lastCacheTime < CACHE_TTL_MS)) {
    return cachedConfig;
  }

  const enabledSetting = await storage.getSetting("MAINTENANCE_MODE");
  const titleSetting = await storage.getSetting("MAINTENANCE_TITLE");
  const messageSetting = await storage.getSetting("MAINTENANCE_MESSAGE");
  const endSetting = await storage.getSetting("MAINTENANCE_ESTIMATED_END");
  const emailsSetting = await storage.getSetting("MAINTENANCE_WHITELIST_EMAILS");
  const telegramSetting = await storage.getSetting("MAINTENANCE_WHITELIST_TELEGRAM");

  let whitelistEmails: string[] = [];
  try {
    if (emailsSetting?.value) {
      whitelistEmails = JSON.parse(emailsSetting.value);
    }
  } catch {
    whitelistEmails = (emailsSetting?.value || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  }

  let whitelistTelegram: string[] = [];
  try {
    if (telegramSetting?.value) {
      whitelistTelegram = JSON.parse(telegramSetting.value);
    }
  } catch {
    whitelistTelegram = (telegramSetting?.value || "").split(",").map(t => t.trim().replace(/^@/, "").toLowerCase()).filter(Boolean);
  }

  cachedConfig = {
    enabled: enabledSetting?.value === "true",
    title: titleSetting?.value || "Scheduled Maintenance in Progress",
    message: messageSetting?.value || "We are currently upgrading our cloud infrastructure, security shields, and payment gateways. We'll be back shortly!",
    estimatedEnd: endSetting?.value || "About 30 minutes",
    whitelistEmails,
    whitelistTelegram,
  };
  lastCacheTime = now;
  return cachedConfig;
}

export async function setMaintenanceConfig(config: Partial<MaintenanceConfig>): Promise<MaintenanceConfig> {
  cachedConfig = null;
  lastCacheTime = 0;
  if (typeof config.enabled === "boolean") {
    await storage.setSetting("MAINTENANCE_MODE", config.enabled ? "true" : "false");
  }
  if (config.title !== undefined) {
    await storage.setSetting("MAINTENANCE_TITLE", config.title);
  }
  if (config.message !== undefined) {
    await storage.setSetting("MAINTENANCE_MESSAGE", config.message);
  }
  if (config.estimatedEnd !== undefined) {
    await storage.setSetting("MAINTENANCE_ESTIMATED_END", config.estimatedEnd);
  }
  if (config.whitelistEmails) {
    const cleanEmails = config.whitelistEmails.map(e => e.trim().toLowerCase()).filter(Boolean);
    await storage.setSetting("MAINTENANCE_WHITELIST_EMAILS", JSON.stringify(cleanEmails));
  }
  if (config.whitelistTelegram) {
    const cleanTg = config.whitelistTelegram.map(t => t.trim().replace(/^@/, "").toLowerCase()).filter(Boolean);
    await storage.setSetting("MAINTENANCE_WHITELIST_TELEGRAM", JSON.stringify(cleanTg));
  }

  cachedConfig = null;
  lastCacheTime = 0;
  return await getMaintenanceConfig(true);
}

/**
 * Checks if a specific Telegram user is whitelisted to use bot / services
 */
export async function isTelegramUserWhitelisted(userId: string | number, username?: string | null): Promise<boolean> {
  const config = await getMaintenanceConfig();
  if (!config.enabled) return true;

  const idStr = String(userId).trim().toLowerCase();
  const unameStr = (username || "").trim().replace(/^@/, "").toLowerCase();

  const inIdList = config.whitelistTelegram.some(t => t.toLowerCase() === idStr);
  const inUnameList = unameStr ? config.whitelistTelegram.some(t => t.toLowerCase() === unameStr) : false;

  return inIdList || inUnameList;
}

/**
 * Checks if an incoming HTTP request is authorized to bypass maintenance mode
 */
export async function isRequestWhitelisted(req: Request): Promise<boolean> {
  const config = await getMaintenanceConfig();
  if (!config.enabled) return true;

  // 1. Authenticated Admin Session: ONLY bypasses admin dashboard routes!
  // If requesting public customer store, admin session does NOT bypass unless their email/telegram is whitelisted.
  const path = req.path || "";
  const referer = String(req.headers["referer"] || "").toLowerCase();
  if (path.startsWith("/imeshadmindashbord") || path.startsWith("/api/admin") || referer.includes("/imeshadmindashbord")) {
    if ((req.session as any)?.userId || (req.session as any)?.passport?.user) {
      return true;
    }
  }

  // 2. Direct Header Check (x-customer-email)
  const rawEmailHeader = req.headers["x-customer-email"] as string;
  if (rawEmailHeader) {
    const cleanHeaderEmail = rawEmailHeader.toLowerCase().trim();
    if (config.whitelistEmails.some(e => e.toLowerCase().trim() === cleanHeaderEmail)) {
      return true;
    }
  }

  // 3. Check Customer Session / Token
  let customerUserId = (req.session as any)?.customerUserId;
  if (!customerUserId) {
    const rawAuth = (req.headers["authorization"] as string) || (req.headers["x-customer-auth-token"] as string);
    if (rawAuth && rawAuth.startsWith("Bearer yh_cust_")) {
      const token = rawAuth.replace(/^Bearer\s+/i, "").trim();
      const parts = token.replace("yh_cust_", "").split("_");
      if (parts[0]) customerUserId = parseInt(parts[0], 10);
    }
  }

  if (customerUserId) {
    const user = await storage.getTelegramUserById(customerUserId);
    if (user) {
      // Check customer email
      if (user.email) {
        const uEmail = user.email.toLowerCase().trim();
        if (config.whitelistEmails.some(e => e.toLowerCase().trim() === uEmail)) return true;
      }
      // Check customer telegramId or username
      if (user.telegramId) {
        const uTgId = user.telegramId.toLowerCase().trim();
        if (config.whitelistTelegram.some(t => t.toLowerCase().trim() === uTgId)) return true;
      }
      if (user.username) {
        const uName = user.username.toLowerCase().trim();
        if (config.whitelistTelegram.some(t => t.toLowerCase().trim() === uName)) return true;
      }
      // Check linked account
      if (user.linkedUserId) {
        const linked = await storage.getTelegramUserById(user.linkedUserId);
        if (linked) {
          if (linked.email && config.whitelistEmails.some(e => e.toLowerCase().trim() === linked.email?.toLowerCase().trim())) {
            return true;
          }
          if (linked.telegramId && config.whitelistTelegram.some(t => t.toLowerCase().trim() === linked.telegramId?.toLowerCase().trim())) {
            return true;
          }
          if (linked.username && config.whitelistTelegram.some(t => t.toLowerCase().trim() === linked.username?.toLowerCase().trim())) {
            return true;
          }
        }
      }
    }
  }

  // 4. Check Telegram Mini App InitData
  const initData = req.headers["x-telegram-init-data"] as string;
  if (initData) {
    try {
      const urlParams = new URLSearchParams(initData);
      const userStr = urlParams.get("user");
      if (userStr) {
        const tgData = JSON.parse(userStr);
        if (tgData.id && await isTelegramUserWhitelisted(tgData.id, tgData.username)) {
          return true;
        }
      }
    } catch {}
  }

  // 5. Check Developer API Key (Header: X-API-Key or Authorization: Bearer yh_...)
  const apiKeyHeader = (req.headers["x-api-key"] as string) || (req.headers["authorization"] as string);
  if (apiKeyHeader) {
    const cleanKey = apiKeyHeader.replace(/^Bearer\s+/i, "").trim();
    if (cleanKey.startsWith("yh_") || cleanKey.startsWith("sk_")) {
      const [keyRecord] = await db
        .select()
        .from(apiKeys)
        .leftJoin(telegramUsers, eq(apiKeys.telegramUserId, telegramUsers.id))
        .where(eq(apiKeys.key, cleanKey))
        .limit(1);

      if (keyRecord && keyRecord.api_keys?.status === "active" && keyRecord.telegram_users) {
        const user = keyRecord.telegram_users;
        if (user.email && config.whitelistEmails.some(e => e.toLowerCase().trim() === user.email?.toLowerCase().trim())) {
          return true;
        }
        if (user.telegramId && config.whitelistTelegram.some(t => t.toLowerCase().trim() === user.telegramId?.toLowerCase().trim())) {
          return true;
        }
        if (user.username && config.whitelistTelegram.some(t => t.toLowerCase().trim() === user.username?.toLowerCase().trim())) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Global Express Middleware to enforce Maintenance Shield
 */
export async function maintenanceShieldMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const config = await getMaintenanceConfig();
    if (!config.enabled) {
      return next();
    }

    const path = req.path;

    // Authenticated admin accessing admin dashboard or admin endpoints is ALWAYS allowed
    const isAdmin = Boolean((req.session as any)?.userId || (req.session as any)?.passport?.user);
    const referer = String(req.headers["referer"] || "").toLowerCase();
    const host = String((req.headers["x-forwarded-host"] as string) || (req.headers["host"] as string) || req.hostname || "").split(":")[0].toLowerCase().trim();
    const isAdminDomain = ["imeshmain2.youuhost.com", "localhost", "127.0.0.1"].includes(host) || host.endsWith(".localhost");

    if (isAdmin && (isAdminDomain || referer.includes("/imeshadmindashbord"))) {
      return next();
    }

    // Allowed paths during maintenance (auth, admin, status, static assets)
    const isAlwaysAllowed =
      path.startsWith("/api/system/maintenance-status") ||
      path.startsWith("/api/admin/") ||
      path.startsWith("/api/auth/login") ||
      path.startsWith("/api/auth/logout") ||
      path.startsWith("/api/auth/user") ||
      path.startsWith("/api/auth/customer/") ||
      path.startsWith("/imeshadmindashbord") ||
      path.startsWith("/assets/") ||
      path.endsWith(".js") ||
      path.endsWith(".css") ||
      path.endsWith(".png") ||
      path.endsWith(".jpg") ||
      path.endsWith(".svg") ||
      path.endsWith(".ico") ||
      path.endsWith(".json") ||
      path.endsWith(".lottie");

    if (isAlwaysAllowed) {
      return next();
    }

    // Check if requester is whitelisted
    const whitelisted = await isRequestWhitelisted(req);
    if (whitelisted) {
      return next();
    }

    // Block API endpoints with 503 Service Unavailable
    if (path.startsWith("/api/")) {
      return res.status(503).json({
        error: "maintenance_mode",
        message: config.message || "System is currently undergoing scheduled maintenance. Please try again later.",
        title: config.title || "Scheduled Maintenance in Progress",
        estimatedEnd: config.estimatedEnd,
        status: 503,
      });
    }

    // For HTML browser requests, allow through so the React router displays the full MaintenancePage UI!
    next();
  } catch (err: any) {
    console.error("[Maintenance Middleware Error]:", err.message);
    next();
  }
}
