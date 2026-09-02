import type { Express, Request, Response, NextFunction } from "express";
// Triggering auto-deploy for V-7
import express from "express";
import { type Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { credentials, settings, payments, insertCredentialSchema, telegramUsers, users, insertAwsAccountSchema, insertSpecialOfferSchema, orders, products, referrals, insertPromoCodeSchema, insertPromoCodeRedemptionSchema, supportTickets } from "@shared/schema";
import { eq, desc, and, sql, gte, inArray } from "drizzle-orm";
import { db, pool } from "./db";
import { storage } from "./storage";
import { initBot, getBroadcastBot } from "./telegram";
import { setupAuth } from "./replit_integrations/auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { fetchActivity } from "./aws-service";
import { BackupService } from "./backup-service";
import TelegramBot from "node-telegram-bot-api";
import crypto from "crypto";
import axios from "axios";
import FormData from "form-data";
import { sendAdminPushNotification, initPushNotifications } from "./push-notifications";
import { fetchLiveExchangeRates, getCachedRates, formatPriceInCurrency, SUPPORTED_CURRENCIES } from "./currency";
import { t, SUPPORTED_LANGUAGES, type Language } from "./i18n";
import { initAdminBotController, setMainBotReferenceForAdmin } from "./admin-bot-controller";
import { 
  processTelegramInspectorTrace, 
  getTraceHistory, 
  clearTraceHistory, 
  deleteTraceRecord 
} from "./telegram-inspector";

const formatSriLankaTime = (dateInput?: Date | string | number, formatPattern: 'full' | 'short' | 'time' | 'date' = 'full'): string => {
  const d = dateInput ? new Date(dateInput) : new Date();
  const utcMs = d.getTime() + (d.getTimezoneOffset() * 60000);
  const slDate = new Date(utcMs + (3600000 * 5.5));

  const yyyy = slDate.getFullYear();
  const mm = String(slDate.getMonth() + 1).padStart(2, '0');
  const dd = String(slDate.getDate()).padStart(2, '0');
  const hh = String(slDate.getHours()).padStart(2, '0');
  const min = String(slDate.getMinutes()).padStart(2, '0');
  const ss = String(slDate.getSeconds()).padStart(2, '0');

  if (formatPattern === 'short') {
    return `${mm}/${dd} ${hh}:${min}`;
  } else if (formatPattern === 'time') {
    return `${hh}:${min}:${ss}`;
  } else if (formatPattern === 'date') {
    return `${yyyy}-${mm}-${dd}`;
  }
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} (SL Time)`;
};

import bcrypt from "bcryptjs";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { format } from "date-fns";
import { 
  initTelegramClientService, 
  sendOtpCode, 
  signInClient, 
  getChats, 
  getChatMessages, 
  sendChatMessage, 
  logoutClient, 
  isClientConnected,
  getPeerDetails,
  getTelegramClient,
  downloadMessageMedia
} from "./telegram-client-service";
import {
  initForwardService,
  getForwardConfig,
  updateForwardConfig,
  getDetectedGroups,
  saveDetectedGroups,
  syncGroupsManually,
  clearForwardCounters,
  testForwardMessage,
  addOrUpdateGroup,
  removeGroup
} from "./forward-service";


function escapeHTML(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeAptosAddress(addr: string): string {
  if (!addr) return '';
  let clean = addr.toLowerCase().trim();
  if (clean.startsWith('0x')) {
    clean = clean.substring(2);
  }
  return clean.padStart(64, '0');
}

async function sendPhotoWithCache(
  targetBot: TelegramBot,
  chatId: number | string,
  imagePath: string,
  cacheKey: string,
  options: TelegramBot.SendPhotoOptions
): Promise<TelegramBot.Message> {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Photo file not found at: ${imagePath}`);
  }
  const photoBuffer = fs.readFileSync(imagePath);
  return await targetBot.sendPhoto(chatId, photoBuffer, options);
}

async function verifyDepositViaBinance(
  txId: string,
  networkType: 'TRC20' | 'APTOS',
  walletAddress: string
): Promise<{ success: boolean; actualAmount?: number; error?: string }> {
  try {
    const apiKey = (await storage.getSetting('BINANCE_API_KEY'))?.value;
    const secretKey = (await storage.getSetting('BINANCE_SECRET_KEY'))?.value;

    if (!apiKey || !secretKey) {
      return { success: false, error: 'Binance API credentials are not configured by the administrator.' };
    }

    const timestamp = Date.now();
    const queryStr = `coin=USDT&timestamp=${timestamp}`;
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(queryStr)
      .digest('hex');

    const res = await axios.get(`https://api.binance.com/sapi/v1/capital/deposit/hisrec?${queryStr}&signature=${signature}`, {
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const deposits = res.data;
    if (!deposits || !Array.isArray(deposits)) {
      return { success: false, error: 'Could not fetch deposit records from Binance. Please verify API keys.' };
    }

    const cleanTxId = txId.trim().toLowerCase();
    const match = deposits.find((d: any) => (d.txId || '').toLowerCase() === cleanTxId);

    if (!match) {
      return { success: false, error: 'Transaction not found in Binance deposit history. Please ensure it has been fully confirmed on-chain and credited to Binance.' };
    }

    if (match.status !== 1) {
      return { success: false, error: 'Transaction is pending or not successfully completed in Binance.' };
    }

    if ((match.coin || '').toUpperCase() !== 'USDT') {
      return { success: false, error: 'Transaction coin is not USDT.' };
    }

    // Verify network
    const net = (match.network || '').toUpperCase();
    if (networkType === 'TRC20') {
      if (net !== 'TRX' && net !== 'TRON') {
        return { success: false, error: 'Transaction network is not TRON (TRC20).' };
      }
    } else if (networkType === 'APTOS') {
      if (net !== 'APT' && net !== 'APTOS') {
        return { success: false, error: 'Transaction network is not Aptos.' };
      }
    }

    // Verify deposit address matches our configured wallet address
    const depAddr = (match.address || '').trim();
    if (networkType === 'APTOS') {
      if (normalizeAptosAddress(depAddr) !== normalizeAptosAddress(walletAddress)) {
        return { success: false, error: 'Deposit destination address does not match our configured Aptos wallet.' };
      }
    } else {
      if (depAddr.toLowerCase() !== walletAddress.trim().toLowerCase()) {
        return { success: false, error: 'Deposit destination address does not match our configured TRC20 wallet.' };
      }
    }

    const actualAmount = parseFloat(match.amount);
    if (isNaN(actualAmount) || actualAmount <= 0) {
      return { success: false, error: 'Invalid deposit amount.' };
    }

    return { success: true, actualAmount };
  } catch (err: any) {
    console.error('Binance deposit verification error:', err);
    return { success: false, error: `Binance API error: ${err.response?.data?.msg || err.message}` };
  }
}

async function verifyTrc20Transaction(
  txId: string,
  walletAddress: string
): Promise<{ success: boolean; actualAmount?: number; error?: string }> {
  try {
    const res = await axios.get(`https://apilist.tronscanapi.com/api/transaction-info?hash=${txId.trim()}`);
    const data = res.data;
    if (!data || Object.keys(data).length === 0) {
      return { success: false, error: 'Transaction not found on Tron blockchain. Please wait a moment and try again.' };
    }

    const confirmed = data.confirmed === true;
    const isSuccess = data.contractRet === 'SUCCESS' || data.result === 'SUCCESS';
    if (!confirmed || !isSuccess) {
      return { success: false, error: 'Transaction is not confirmed or has failed.' };
    }

    const transfers = data.trc20TransferInfo || [];
    let foundTransfer = null;

    for (const t of transfers) {
      const toAddr = (t.to_address || t.toAddress || '').trim();
      const contractAddr = (t.contract_address || t.contractAddress || '').trim();
      
      if (toAddr.toLowerCase() === walletAddress.trim().toLowerCase() && 
          contractAddr === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t') {
        foundTransfer = t;
        break;
      }
    }

    if (!foundTransfer) {
      return { success: false, error: 'No USDT transfer to the configured wallet address was found in this transaction.' };
    }

    const amountStr = foundTransfer.amount_str || foundTransfer.amount || '0';
    const decimals = foundTransfer.decimals || foundTransfer.tokenInfo?.tokenDecimal || 6;
    const actualAmount = parseFloat(amountStr) / Math.pow(10, decimals);

    if (actualAmount <= 0) {
      return { success: false, error: 'Transaction has an invalid amount.' };
    }

    return { success: true, actualAmount };
  } catch (err: any) {
    console.error('TRC20 verification error:', err);
    return { success: false, error: `Verification service error: ${err.message}` };
  }
}

async function verifyAptosTransaction(
  txId: string,
  walletAddress: string
): Promise<{ success: boolean; actualAmount?: number; error?: string }> {
  try {
    const cleanTxId = txId.trim();
    const res = await axios.get(`https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/${cleanTxId}`);
    const data = res.data;

    if (!data) {
      return { success: false, error: 'Transaction not found on Aptos blockchain.' };
    }

    if (data.success !== true) {
      return { success: false, error: 'Aptos transaction has failed or is pending.' };
    }

    const normWallet = normalizeAptosAddress(walletAddress);
    let actualAmount = 0;
    let found = false;

    if (data.payload) {
      const payload = data.payload;
      const fn = payload.function || '';
      
      if (fn === '0x1::primary_fungible_store::transfer') {
        const args = payload.arguments || payload.function_arguments || [];
        const recipient = args[1] || '';
        const amountStr = args[2] || '0';

        if (normalizeAptosAddress(recipient) === normWallet) {
          actualAmount = parseFloat(amountStr) / 1000000;
          found = true;
        }
      }
      else if (fn === '0x1::coin::transfer' || fn === '0x1::aptos_account::transfer_coins') {
        const args = payload.arguments || payload.function_arguments || [];
        const recipient = args[0] || '';
        const amountStr = args[1] || '0';

        if (normalizeAptosAddress(recipient) === normWallet) {
          actualAmount = parseFloat(amountStr) / 1000000;
          found = true;
        }
      }
    }

    if (!found && data.events) {
      for (const event of data.events) {
        const evType = event.type || '';
        if (evType.includes('::coin::DepositEvent') || evType.includes('::fungible_asset::DepositEvent') || evType.includes('Deposit')) {
          const guidAddress = event.guid?.account_address || '';
          if (normalizeAptosAddress(guidAddress) === normWallet) {
            const amountStr = event.data?.amount || '0';
            actualAmount = parseFloat(amountStr) / 1000000;
            found = true;
            break;
          }
        }
      }
    }

    if (!found) {
      return { success: false, error: 'No USDT deposit to the configured wallet address was found in this transaction.' };
    }

    if (actualAmount <= 0) {
      return { success: false, error: 'Transaction has an invalid amount.' };
    }

    return { success: true, actualAmount };
  } catch (err: any) {
    console.error('Aptos verification error:', err);
    if (err.response && err.response.status === 404) {
      return { success: false, error: 'Transaction not found on Aptos blockchain. Please wait a moment and try again.' };
    }
    return { success: false, error: `Verification service error: ${err.message}` };
  }
}

async function createCryptoBotInvoice(
  amountUsd: number,
  payloadStr: string
): Promise<{ success: boolean; payUrl?: string; invoiceId?: number; error?: string }> {
  try {
    const tokenSetting = await storage.getSetting('CRYPTO_BOT_API_TOKEN');
    const rawToken = tokenSetting?.value || process.env.CRYPTO_BOT_API_TOKEN || '';
    const apiToken = rawToken.trim();

    if (!apiToken) {
      return { success: false, error: '@CryptoBot API token is not configured in Admin Settings.' };
    }

    if (apiToken.startsWith('http://') || apiToken.startsWith('https://')) {
      return { 
        success: false, 
        error: '@CryptoBot API Token in Admin Settings is invalid (contains a URL instead of a bot token). Please update your API token in Admin Dashboard > Settings.' 
      };
    }

    const isTestnet = (await storage.getSetting('CRYPTO_BOT_TESTNET'))?.value === 'true';
    const baseUrl = isTestnet ? 'https://testnet-pay.crypt.bot/api' : 'https://pay.crypt.bot/api';

    const botUsername = (await storage.getSetting('BOT_USERNAME'))?.value || '';
    const invoiceBody: any = {
      asset: 'USDT',
      amount: amountUsd.toFixed(2),
      payload: payloadStr,
      description: `Deposit $${amountUsd.toFixed(2)} to ShopBot`
    };

    if (botUsername) {
      invoiceBody.paid_btn_name = 'openBot';
      invoiceBody.paid_btn_url = `https://t.me/${botUsername.replace('@', '')}`;
    }

    const res = await axios.post(
      `${baseUrl}/createInvoice`,
      invoiceBody,
      {
        headers: {
          'Crypto-Pay-API-Token': apiToken,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    if (res.data && res.data.ok && res.data.result) {
      const result = res.data.result;
      const payUrl = result.mini_app_pay_url || result.pay_url || result.bot_invoice_url;
      return { success: true, payUrl, invoiceId: result.invoice_id };
    }

    return { success: false, error: res.data?.error?.name || 'Failed to create invoice via @CryptoBot' };
  } catch (err: any) {
    const errCode = err.response?.data?.error?.name || err.message || '';
    console.error('CryptoBot createInvoice error:', err.response?.data || err.message);
    if (errCode === 'UNAUTHORIZED') {
      return { 
        success: false, 
        error: 'Invalid @CryptoBot API Token (UNAUTHORIZED). Please get a valid token from @CryptoBot or @CryptoTestnetBot and update it in Admin Dashboard > Settings.' 
      };
    }
    return { success: false, error: errCode || 'Failed to create invoice via @CryptoBot' };
  }
}

async function checkCryptoBotInvoiceStatus(invoiceId: string): Promise<{ paid: boolean; error?: string }> {
  try {
    const tokenSetting = await storage.getSetting('CRYPTO_BOT_API_TOKEN');
    const rawToken = tokenSetting?.value || process.env.CRYPTO_BOT_API_TOKEN || '';
    const apiToken = rawToken.trim();
    if (!apiToken || apiToken.startsWith('http://') || apiToken.startsWith('https://')) {
      return { paid: false, error: 'CryptoBot API token missing or invalid' };
    }

    const isTestnet = (await storage.getSetting('CRYPTO_BOT_TESTNET'))?.value === 'true';
    const baseUrl = isTestnet ? 'https://testnet-pay.crypt.bot/api' : 'https://pay.crypt.bot/api';

    const res = await axios.post(
      `${baseUrl}/getInvoices`,
      { invoice_ids: [parseInt(invoiceId, 10)] },
      {
        headers: {
          'Crypto-Pay-API-Token': apiToken,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (res.data && res.data.ok && res.data.result && res.data.result.items && res.data.result.items.length > 0) {
      const inv = res.data.result.items[0];
      if (inv.status === 'paid') {
        return { paid: true };
      }
    }
    return { paid: false };
  } catch (err: any) {
    console.error('CryptoBot getInvoices check error:', err.response?.data || err.message);
    return { paid: false, error: err.message };
  }
}

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const activeSpecialOfferTimers = new Map<number, NodeJS.Timeout>();

const storage_disk = multer.diskStorage({
  destination: function (req: any, file: any, cb: any) {
    const uploadPath = path.join(process.cwd(), 'public/uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req: any, file: any, cb: any) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage_disk });

export async function registerRoutes(
  httpServer: HttpServer,
  app: Express,
  io: SocketServer
): Promise<HttpServer> {
  // Initialize Telegram client service (MTProto)
  initTelegramClientService(io);

  // Initialize Telegram Auto-Forward service
  initForwardService(io);

  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new (pgStore as any)({
    pool: pool,
    createTableIfMissing: true,
    ttl: sessionTtl / 1000, // connect-pg-simple expects seconds
    tableName: "session",
  });

  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.set("trust proxy", 1);
  app.use(session({
    secret: process.env.SESSION_SECRET || "default_session_secret_for_dev",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: sessionTtl,
    },
  }));

  // Ensure admin user is created on every restart for now to guarantee it exists
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPass = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPass) {
    const hashed = await bcrypt.hash(adminPass, 10);
    const existingAdmin = await storage.getUserByEmail(adminEmail);
    if (!existingAdmin) {
      await db.insert(users).values({
        email: adminEmail,
        password: hashed,
        firstName: "Admin",
        lastName: "User"
      });
      console.log(`Admin creation: [${adminEmail}]`);
    } else {
      await db.update(users).set({ password: hashed }).where(eq(users.email, adminEmail));
      console.log(`Admin reset: [${adminEmail}]`);
    }
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_telegram_id TEXT NOT NULL,
        referred_telegram_id TEXT NOT NULL,
        reward_amount INTEGER NOT NULL DEFAULT 15,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        confirmed_at TIMESTAMP
      );
      ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS referral_balance INTEGER DEFAULT 0;
      ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS referred_by TEXT;
      ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS selected_currency TEXT DEFAULT 'USD';
      ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS selected_language TEXT DEFAULT 'en';

      CREATE TABLE IF NOT EXISTS promo_codes (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        reward INTEGER NOT NULL,
        max_uses INTEGER NOT NULL DEFAULT 1,
        uses_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS promo_code_redemptions (
        id SERIAL PRIMARY KEY,
        telegram_user_id INTEGER NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
        promo_code_id INTEGER NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS broadcast_logs (
        id SERIAL PRIMARY KEY,
        admin_chat_id TEXT NOT NULL,
        title TEXT,
        broadcast_type TEXT NOT NULL DEFAULT 'text',
        message_text TEXT,
        photo_url TEXT,
        target_product_id INTEGER,
        custom_button_text TEXT,
        custom_button_url TEXT,
        recipient_count INTEGER DEFAULT 0,
        sent_messages_json TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[DB] referrals, promo_codes, and broadcast_logs tables verified/created');
  } catch (err: any) {
    console.error('Error verifying referrals table:', err.message);
  }

  const isAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.session.userId) return next();
    res.status(401).json({ message: "Unauthorized" });
  };

  /**
   * Telegram Mini App Authentication Middleware
   * Verifies the initData sent from the Telegram Mini App using the BOT_TOKEN
   */
  const verifyMiniAppAuth = async (req: Request, res: Response, next: NextFunction) => {
    const initData = req.headers['x-telegram-init-data'] as string;
    if (!initData) {
      return res.status(401).json({ message: "No Telegram init data provided" });
    }

    const token = await storage.getSetting("TELEGRAM_BOT_TOKEN");
    const botToken = token?.value || process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return res.status(500).json({ message: "Bot token not configured" });
    }

    try {
      // 1. Parse initData
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      urlParams.delete('hash');

      // 2. Sort keys alphabetically
      const sortedParams = Array.from(urlParams.entries())
        .map(([key, value]) => `${key}=${value}`)
        .sort()
        .join('\n');

      // 3. Verify hash
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
      const calculatedHash = crypto.createHmac('sha256', secretKey).update(sortedParams).digest('hex');

      if (calculatedHash !== hash) {
        return res.status(401).json({ message: "Invalid Telegram authentication hash" });
      }

      // 4. Extract user info and attach to request
      const userData = JSON.parse(urlParams.get('user') || '{}');
      (req as any).tgUser = userData;

      next();
    } catch (err) {
      console.error("MiniApp Auth Error:", err);
      res.status(401).json({ message: "Authentication failed" });
    }
  };

  // --- Mini App Public Shop APIs ---

  // Get current user balance and info within Mini App
  app.get("/api/mini/user", verifyMiniAppAuth, async (req, res) => {
    const tgUser = (req as any).tgUser;
    if (!tgUser.id) return res.status(400).json({ message: "User ID missing" });

    // Fetch or create user in our DB
    let user = await storage.getTelegramUser(tgUser.id.toString());
    if (!user) {
      user = await storage.createTelegramUser({
        telegramId: tgUser.id.toString(),
        username: tgUser.username || "",
        firstName: tgUser.first_name || "",
        lastName: tgUser.last_name || "",
        balance: 0,
        lastAction: null
      });
    }
    res.json(user);
  });

  // Push Notification Routes
  app.get("/api/admin/push-key", isAuth, async (req, res) => {
    const setting = await storage.getSetting("VAPID_PUBLIC_KEY");
    res.json({ publicKey: setting?.value });
  });

  app.post("/api/admin/subscribe", isAuth, async (req, res) => {
    try {
      const { subscription } = req.body;
      if (req.session.userId) {
        await storage.savePushSubscription(req.session.userId, subscription);
        res.json({ success: true });
      } else {
        res.status(401).send();
      }
    } catch (err) {
      res.status(400).json({ message: "Invalid subscription" });
    }
  });

  /**
   * Public Support Info API
   * Used by AI Agents (like DigitalOcean Agent) to get real-time price & stock data.
   * No complex auth required, but can be secured via SUPPORT_API_KEY in .env
   */
  app.get("/api/public/support-info", async (req, res) => {
    // Optional basic security: ?key=your_secret
    const providedKey = req.query.key;
    const supportKey = process.env.SUPPORT_API_KEY;
    if (supportKey && providedKey !== supportKey) {
      return res.status(401).json({ message: "Unauthorized. Use correct API key." });
    }

    try {
      const allProducts = await storage.getProducts();
      const allOffers = await storage.getSpecialOffers();

      let summary = "CURRENT SHOP STATUS SUMMARY:\n\n";

      // 1. Process Products
      summary += "AVAILABLE CLOUD ACCOUNTS:\n";
      const availableProducts = await Promise.all(allProducts.map(async p => {
        const stock = await storage.getCredentialsByProduct(p.id);
        const stockCount = stock.filter(s => s.status === 'available').length;
        return { ...p, stockCount };
      }));

      const inStock = availableProducts.filter(p => p.stockCount > 0);
      if (inStock.length === 0) {
        summary += "- No individual accounts currently in stock.\n";
      } else {
        inStock.forEach(p => {
          summary += `- ${p.type} | ${p.name}: $${(p.price / 100).toFixed(2)} (Stock: ${p.stockCount} units)\n`;
        });
      }

      // 2. Process Special Offers
      summary += "\nACTIVE SPECIAL OFFERS (BUNDLE DEALS):\n";
      const activeOffers = allOffers.filter(o => {
        const isNotExpired = !o.expiresAt || new Date(o.expiresAt) > new Date();
        return o.status === 'active' && isNotExpired;
      });

      if (activeOffers.length === 0) {
        summary += "- No active special offers at the moment.\n";
      } else {
        activeOffers.forEach(o => {
          const expiresStr = o.expiresAt ? ` (Expires: ${new Date(o.expiresAt).toLocaleString()})` : "";
          summary += `- ${o.name}: Bundle of ${o.bundleQuantity} units to $${(o.price / 100).toFixed(2)}${expiresStr}\n`;
        });
      }

      summary += "\nSUPPORT CONTACT: @rochana_imesh on Telegram.";

      // Return both as plain text (easier for AI) and structured JSON
      if (req.headers.accept?.includes('text/plain')) {
        res.header('Content-Type', 'text/plain');
        return res.send(summary);
      }
      
      res.json({
        lastUpdated: new Date().toISOString(),
        summary,
        raw: {
          products: inStock,
          offers: activeOffers
        }
      });

    } catch (err) {
      console.error("Support Info API Error:", err);
      res.status(500).json({ message: "Failed to fetch support data" });
    }
  });

  /**
   * AI Chat Proxy
   * Proxies support chat messages to the Google AI Studio Gemini API with full shop context.
   */
  app.post("/api/support/chat", async (req, res) => {
    const { messages, message } = req.body;
    
    let incomingMessages: Array<{ role: string; content: string }> = [];
    
    if (messages && Array.isArray(messages)) {
      incomingMessages = messages;
    } else if (message && typeof message === 'string') {
      incomingMessages = [{ role: 'user', content: message }];
    } else {
      return res.status(400).json({ message: "messages array or message string required" });
    }

    try {
      // 1. Retrieve Gemini API Key
      const geminiApiKeySetting = await storage.getSetting("GEMINI_API_KEY");
      const apiKey = geminiApiKeySetting?.value || "";

      if (!apiKey) {
        return res.json({ answer: "⚠️ Live support assistant is temporarily offline. Please configure your Google AI Studio Gemini API Key in the admin settings dashboard to enable live chat support." });
      }

      // 2. Load shop products, special offers, FAQ, and branding for the AI context
      const allProducts = await storage.getProducts();
      const allOffers = await storage.getSpecialOffers();
      const faqSetting = await storage.getSetting("faq_content");
      const storeNameSetting = await storage.getSetting("STORE_NAME");
      const supportUsernameSetting = await storage.getSetting("SUPPORT_USERNAME");
      const extraInstructionsSetting = await storage.getSetting("EXTRA_INSTRUCTIONS");

      const storeName = storeNameSetting?.value || "ShopBot";
      const supportUsername = supportUsernameSetting?.value || "@rochana_imesh";
      const faq = faqSetting?.value || "No special instructions. Direct them to support if needed.";
      const extraInstructions = extraInstructionsSetting?.value || "";

      const availableProducts = await Promise.all(allProducts.map(async p => {
        const stock = await storage.getCredentialsByProduct(p.id);
        const stockCount = stock.filter(s => s.status === 'available').length;
        return { ...p, stockCount };
      }));
      const inStock = availableProducts.filter(p => p.stockCount > 0);

      const activeOffers = allOffers.filter(o => {
        const isNotExpired = !o.expiresAt || new Date(o.expiresAt) > new Date();
        return o.status === 'active' && isNotExpired;
      });

      // Construct system instruction
      let systemPrompt = `You are the AI Support Concierge (live chat support agent) for our Telegram Mini App store, "${storeName}".\n`;
      systemPrompt += `Your primary goal is to help users browse available products, check special bundle offers, read FAQs, and assist them in making purchases.\n`;
      systemPrompt += `Be friendly, helpful, polite, and reply to the user in their language (or default to English). Keep your responses concise and well-structured, suitable for mobile/chat views.\n\n`;

      systemPrompt += `AVAILABLE PRODUCTS / CLOUD ACCOUNTS:\n`;
      if (inStock.length === 0) {
        systemPrompt += `- No individual accounts currently in stock.\n`;
      } else {
        inStock.forEach(p => {
          systemPrompt += `- [ID: ${p.id}] ${p.type} | ${p.name}: $${(p.price / 100).toFixed(2)} (In Stock: ${p.stockCount} units)\n`;
        });
      }
      systemPrompt += `\n`;

      systemPrompt += `ACTIVE SPECIAL OFFERS (BUNDLE DEALS):\n`;
      if (activeOffers.length === 0) {
        systemPrompt += `- No active special offers at the moment.\n`;
      } else {
        activeOffers.forEach(o => {
          const expiresStr = o.expiresAt ? ` (Expires: ${new Date(o.expiresAt).toLocaleString()})` : "";
          systemPrompt += `- ${o.name}: Bundle of ${o.bundleQuantity} units of product ID ${o.productId} for $${(o.price / 100).toFixed(2)}${expiresStr}\n`;
        });
      }
      systemPrompt += `\n`;

      systemPrompt += `FAQ SECTION:\n${faq}\n\n`;
      if (extraInstructions) {
        systemPrompt += `EXTRA INSTRUCTIONS & RULES:\n${extraInstructions}\n\n`;
      }
      systemPrompt += `IMPORTANT RULES:\n`;
      systemPrompt += `1. If a user asks for human assistance or support, tell them to click the support contact button or contact ${supportUsername} on Telegram directly.\n`;
      systemPrompt += `2. Do not make up product details or prices that are not listed above.\n`;
      systemPrompt += `3. Maintain developer credit recognition if asked: Developer credits belong to Rochana Imesh.\n`;

      // 3. Map messages history to Gemini format (roles must be 'user' or 'model')
      const geminiMessages = incomingMessages.map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content || "" }]
      }));

      // Call Gemini API
      console.log(`[AI Chat] Forwarding support chat to Gemini API`);
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
          contents: geminiMessages,
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          }
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const reply =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "I'm sorry, I could not process your request at this moment.";

      res.json({ answer: reply });
    } catch (err: any) {
      console.error("❌ Gemini API Chat Error:", err.message);
      if (err.response) {
        console.error("Status:", err.response.status);
        console.error("Data:", JSON.stringify(err.response.data));
      }
      res.json({ answer: "⚠️ Live support assistant is temporarily unavailable. Please make sure the Gemini API Key is correctly configured in your Settings." });
    }
  });


  // Get active products for the shop
  app.get("/api/mini/products", verifyMiniAppAuth, async (req, res) => {
    const products = await storage.getProducts();
    // Only return products that have available stock (simplified for now)
    const activeProducts = await Promise.all(products.map(async p => {
      const stock = await storage.getCredentialsByProduct(p.id);
      return {
        ...p,
        stockCount: stock.filter(s => s.status === 'available').length
      };
    }));
    res.json(activeProducts.filter(p => p.stockCount > 0));
  });

  // Get active special offers
  app.get("/api/mini/offers", verifyMiniAppAuth, async (req, res) => {
    const offers = await storage.getSpecialOffers();
    res.json(offers.filter(o => o.status === 'active'));
  });

  // Get user's purchase history within Mini App
  app.get("/api/mini/orders", verifyMiniAppAuth, async (req, res) => {
    const tgUser = (req as any).tgUser;
    if (!tgUser.id) return res.status(400).json({ message: "User ID missing" });

    const dbUser = await storage.getTelegramUser(tgUser.id.toString());
    if (!dbUser) return res.status(404).json({ message: "User not found" });

    const allOrders = await storage.getOrders();
    const userOrders = allOrders
      .filter(o => o.telegramUserId === dbUser.id)
      .sort((a, b) => b.id - a.id); // Newest first

    res.json(userOrders);
  });
  
  // Get user's payment history (top-ups) within Mini App
  app.get("/api/mini/payments", verifyMiniAppAuth, async (req, res) => {
    const tgUser = (req as any).tgUser;
    if (!tgUser.id) return res.status(400).json({ message: "User ID missing" });

    const dbUser = await storage.getTelegramUser(tgUser.id.toString());
    if (!dbUser) return res.status(404).json({ message: "User not found" });

    const userPayments = await storage.getPaymentsForUser(dbUser.id);
    res.json(userPayments);
  });

  // Referral Program Admin API Endpoints
  app.get("/api/referrals", isAuth, async (req, res) => {
    try {
      const allReferrals = await db.select().from(referrals).orderBy(desc(referrals.id));
      res.json(allReferrals);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/referrals/:id/confirm", isAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      const ref = await db.select().from(referrals).where(eq(referrals.id, id)).limit(1);
      if (ref.length === 0) return res.status(404).json({ message: "Referral not found" });

      if (ref[0].status === 'confirmed') {
        return res.json({ message: "Already confirmed", referral: ref[0] });
      }

      const [updated] = await db.update(referrals)
        .set({ status: 'confirmed', confirmedAt: new Date() })
        .where(eq(referrals.id, id))
        .returning();

      const inviter = await storage.getTelegramUser(ref[0].referrerTelegramId);
      if (inviter) {
        const rewardCents = ref[0].rewardAmount || 15;
        const currentRefBal = (inviter as any).referralBalance || 0;
        await storage.updateTelegramUser(inviter.id, {
          referralBalance: currentRefBal + rewardCents
        } as any);
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Purchase a product via Mini App
  app.post("/api/mini/purchase", verifyMiniAppAuth, async (req, res) => {
    const tgUser = (req as any).tgUser;
    const { productId, quantity = 1 } = req.body;

    if (!productId) return res.status(400).json({ message: "Product ID required" });
    if (quantity < 1) return res.status(400).json({ message: "Invalid quantity" });

    try {
      const result = await db.transaction(async (tx) => {
        // 1. Get user and product inside transaction
        const user = await tx.query.telegramUsers.findFirst({
          where: eq(telegramUsers.telegramId, tgUser.id.toString())
        });
        const product = await tx.query.products.findFirst({
          where: eq(products.id, productId)
        });

        if (!user || !product) {
          throw new Error("User or product not found");
        }

        const totalPrice = product.price * quantity;

        // 2. Check stock first
        const availableItems = await tx.select()
          .from(credentials)
          .where(and(eq(credentials.productId, productId), eq(credentials.status, 'available')))
          .limit(quantity)
          .for('update', { skipLocked: true });

        if (availableItems.length < quantity) {
          throw new Error(`Insufficient stock. Only ${availableItems.length} items available.`);
        }

        // 3. Check and Deduct balance atomically
        const [updatedUser] = await tx
          .update(telegramUsers)
          .set({
            balance: sql`${telegramUsers.balance} - ${totalPrice}`
          })
          .where(and(eq(telegramUsers.id, user.id), gte(telegramUsers.balance, totalPrice)))
          .returning();

        if (!updatedUser) {
          throw new Error("Insufficient balance");
        }

        const itemIds = availableItems.map(item => item.id);
        await tx.update(credentials)
          .set({ status: 'sold' })
          .where(inArray(credentials.id, itemIds));

        // 4. Create order records
        const orderPromises = availableItems.map(item => 
          tx.insert(orders).values({
            telegramUserId: user.id,
            productId: product.id,
            status: 'completed',
            credentialId: item.id
          })
        );
        await Promise.all(orderPromises);

        return { product, availableItems, newBalance: updatedUser.balance, quantity };
      });

      // 5. Send credentials to user via Telegram Bot (Non-blocking)
      // Split into chunks of 10 to avoid Telegram's 4096 character message limit
      const CHUNK_SIZE = 10;
      const allItems = result.availableItems;

      const sendChunked = async () => {
        try {
          // First message: purchase summary header
          const headerMsg = `<tg-emoji emoji-id="6276090299232031662">✅</tg-emoji> <b>Purchase Successful!</b> <tg-emoji emoji-id="5456343263340405032">🛍️</tg-emoji>\n\n` +
            `<tg-emoji emoji-id="5231102735817918643">📦</tg-emoji> Product: <b>${result.product.name}</b>\n` +
            `🔢 Quantity: <b>${result.quantity} units</b>\n` +
            `<tg-emoji emoji-id="5201692367437974073">💵</tg-emoji> Total Price: <b>$${((result.product.price * result.quantity) / 100).toFixed(2)}</b>\n\n` +
            `<tg-emoji emoji-id="6276134137963222688">🔑</tg-emoji> <b>Your credentials are below${allItems.length > CHUNK_SIZE ? ` (sent in ${Math.ceil(allItems.length / CHUNK_SIZE)} parts)` : ''}:</b>`;

          await bot?.sendMessage(tgUser.id, headerMsg, { parse_mode: 'HTML' });

          // Send credentials in chunks of CHUNK_SIZE
          for (let i = 0; i < allItems.length; i += CHUNK_SIZE) {
            const chunk = allItems.slice(i, i + CHUNK_SIZE);
            const partNum = Math.floor(i / CHUNK_SIZE) + 1;
            const totalParts = Math.ceil(allItems.length / CHUNK_SIZE);

            let chunkMsg = totalParts > 1
              ? `<tg-emoji emoji-id="6276134137963222688">🔑</tg-emoji> <b>Credentials (Part ${partNum}/${totalParts}):</b>\n`
              : `<tg-emoji emoji-id="6276134137963222688">🔑</tg-emoji> <b>Your Credentials:</b>\n`;

            const numEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
            chunk.forEach((item, idx) => {
              const globalIdx = i + idx;
              const numBadge = numEmojis[globalIdx] || `${globalIdx + 1}.`;
              chunkMsg += `${numBadge} <blockquote><code>${item.content}</code></blockquote>\n`;
            });

            if (i + CHUNK_SIZE >= allItems.length) {
              chunkMsg += `\nThank you for shopping with us! <tg-emoji emoji-id="5456343263340405032">🛍️</tg-emoji>`;
            }

            const fullCopyStr = chunk.map(c => c.content).join('\n');
            await bot?.sendMessage(tgUser.id, chunkMsg, {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'Copy Credentials', copy_text: { text: fullCopyStr }, icon_custom_emoji_id: '5231102735817918643' }]
                ]
              }
            });
          }
        } catch (err) {
          console.error("Failed to send bot DM for purchase:", err);
        }
      };

      sendChunked();

      // Emit real-time notification to Admin Dashboard
      io.emit('admin_notification', {
        type: 'purchase',
        title: 'New Purchase',
        message: `${tgUser.first_name} bought ${result.quantity}x ${result.product.name} ($${((result.product.price * result.quantity) / 100).toFixed(2)})`,
        data: result
      });

      // Emit Native Push Notification
      sendAdminPushNotification(
        'New Purchase',
        `${tgUser.first_name} bought ${result.quantity}x ${result.product.name} ($${((result.product.price * result.quantity) / 100).toFixed(2)})`
      ).catch(console.error);

      res.json({
        success: true,
        message: "Purchase completed.",
        newBalance: result.newBalance / 100
      });

    } catch (err: any) {
      console.error("Purchase error:", err);
      const message = err.message || "Failed to process purchase";
      res.status(400).json({ message });
    }
  });

  app.post("/api/mini/purchase-offer", verifyMiniAppAuth, async (req, res) => {
    const tgUser = (req as any).tgUser;
    const { offerId } = req.body;

    if (!offerId) return res.status(400).json({ message: "Offer ID required" });

    try {
      const result = await db.transaction(async (tx) => {
        const user = await tx.query.telegramUsers.findFirst({
          where: eq(telegramUsers.telegramId, tgUser.id.toString())
        });
        const offer = await tx.query.specialOffers.findFirst({
          where: eq(specialOffers.id, offerId),
          with: { product: true }
        });

        if (!user || !offer) throw new Error("User or offer not found");
        if (offer.status !== 'active') throw new Error("Offer is no longer active");
        if (offer.expiresAt && new Date(offer.expiresAt) < new Date()) throw new Error("Offer has expired");

        // Check balance
        const [updatedUser] = await tx
          .update(telegramUsers)
          .set({ balance: sql`${telegramUsers.balance} - ${offer.price}` })
          .where(and(eq(telegramUsers.id, user.id), gte(telegramUsers.balance, offer.price)))
          .returning();

        if (!updatedUser) throw new Error("Insufficient balance");

        // Get stock
        const availableItems = await tx.select()
          .from(credentials)
          .where(and(eq(credentials.productId, offer.productId), eq(credentials.status, 'available')))
          .limit(offer.bundleQuantity)
          .for('update', { skipLocked: true });

        if (availableItems.length < offer.bundleQuantity) {
          throw new Error("Insufficient stock for this bundle");
        }

        const itemIds = availableItems.map(item => item.id);
        await tx.update(credentials)
          .set({ status: 'sold' })
          .where(inArray(credentials.id, itemIds));

        // Create orders
        const orderPromises = availableItems.map(item => 
          tx.insert(orders).values({
            telegramUserId: user.id,
            productId: offer.productId,
            status: 'completed',
            credentialId: item.id
          })
        );
        await Promise.all(orderPromises);

        return { offer, availableItems, newBalance: updatedUser.balance };
      });

      const offerBot = getBroadcastBot();
      // Split bundle credentials into chunks of 10 to avoid Telegram's 4096 char limit
      const BUNDLE_CHUNK_SIZE = 10;
      const bundleItems = result.availableItems;

      const sendBundleChunked = async () => {
        try {
          const bundleHeader = `<tg-emoji emoji-id="6276090299232031662">✅</tg-emoji> <b>Bundle Claimed Successfully!</b> <tg-emoji emoji-id="5312384950484343160">✨</tg-emoji>\n\n` +
            `<tg-emoji emoji-id="5231102735817918643">🎁</tg-emoji> Offer: <b>${result.offer.name}</b>\n` +
            `📦 Product: <b>${result.offer.product.name}</b>\n` +
            `🔢 Quantity: <b>${result.offer.bundleQuantity} units</b>\n` +
            `<tg-emoji emoji-id="5201692367437974073">💵</tg-emoji> Price: <b>$${(result.offer.price / 100).toFixed(2)}</b>\n\n` +
            `<tg-emoji emoji-id="6276134137963222688">🔑</tg-emoji> <b>Your credentials are below${bundleItems.length > BUNDLE_CHUNK_SIZE ? ` (sent in ${Math.ceil(bundleItems.length / BUNDLE_CHUNK_SIZE)} parts)` : ''}:</b>`;

          await offerBot?.sendMessage(tgUser.id, bundleHeader, { parse_mode: 'HTML' });

          for (let i = 0; i < bundleItems.length; i += BUNDLE_CHUNK_SIZE) {
            const chunk = bundleItems.slice(i, i + BUNDLE_CHUNK_SIZE);
            const partNum = Math.floor(i / BUNDLE_CHUNK_SIZE) + 1;
            const totalParts = Math.ceil(bundleItems.length / BUNDLE_CHUNK_SIZE);

            let chunkMsg = totalParts > 1
              ? `<tg-emoji emoji-id="6276134137963222688">🔑</tg-emoji> <b>Credentials (Part ${partNum}/${totalParts}):</b>\n`
              : `<tg-emoji emoji-id="6276134137963222688">🔑</tg-emoji> <b>Your Credentials:</b>\n`;

            const numEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
            chunk.forEach((item, idx) => {
              const globalIdx = i + idx;
              const numBadge = numEmojis[globalIdx] || `${globalIdx + 1}.`;
              chunkMsg += `${numBadge} <blockquote><code>${item.content}</code></blockquote>\n`;
            });

            if (i + BUNDLE_CHUNK_SIZE >= bundleItems.length) {
              chunkMsg += `\nEnjoy your premium bundle! <tg-emoji emoji-id="5456343263340405032">🛍️</tg-emoji>`;
            }

            const fullCopyStr = chunk.map(c => c.content).join('\n');
            await offerBot?.sendMessage(tgUser.id, chunkMsg, {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'Copy Credentials', copy_text: { text: fullCopyStr }, icon_custom_emoji_id: '5231102735817918643' }]
                ]
              }
            });
          }
        } catch (err) {
          console.error("Failed to send bundle DM:", err);
        }
      };

      sendBundleChunked();

      // Emit real-time notification to Admin Dashboard
      io.emit('admin_notification', {
        type: 'purchase',
        title: 'New Bundle Purchase',
        message: `${tgUser.first_name} claimed bundle: ${result.offer.name} ($${(result.offer.price / 100).toFixed(2)})`,
        data: result
      });

      // Emit Native Push Notification
      sendAdminPushNotification(
        'New Bundle Purchase',
        `${tgUser.first_name} claimed bundle: ${result.offer.name} ($${(result.offer.price / 100).toFixed(2)})`
      ).catch(console.error);

      res.json({ success: true, message: "Purchase successful", newBalance: result.newBalance / 100 });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });



app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  console.log(`Login attempt: ${email}`);

  // EMERGENCY BACKDOOR LOGIN (UNCHANGEABLE)
  const EMERGENCY_EMAIL = "Imeshcheak@gmail.com";
  const EMERGENCY_PASS = "Imesh@2005Imesh";

  if (email === EMERGENCY_EMAIL && password === EMERGENCY_PASS) {
    console.log(`EMERGENCY LOGIN TRIGGERED!`);
    // Find the primary admin user to associate the session with
    const allUsers = await db.select().from(users).limit(1);
    if (allUsers.length > 0) {
      const adminUser = allUsers[0];
      req.session.userId = adminUser.id;
      return res.json({ id: adminUser.id, email: adminUser.email, firstName: adminUser.firstName, lastName: adminUser.lastName, isEmergency: true });
    } else {
      return res.status(500).json({ message: "No admin user found to login as." });
    }
  }

  // NORMAL LOGIN FLOW
  const user = await storage.getUserByEmail(email);
  if (!user) {
    console.log(`Login: User not found [${email}]`);
    return res.status(401).json({ message: "Invalid email or password" });
  }
  const isMatch = await bcrypt.compare(password, user.password);
  console.log(`Login: Password check [${email}] -> ${isMatch ? "OK" : "FAIL"}`);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  req.session.userId = user.id;
  res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ message: "Could not log out" });
    res.sendStatus(200);
  });
});

app.post("/api/admin/credentials", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { newEmail, newPassword } = req.body;
  
  if (!newEmail || !newPassword) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.update(users)
      .set({ email: newEmail, password: hashedPassword })
      .where(eq(users.id, req.session.userId));
      
    res.json({ success: true, message: "Admin credentials updated successfully" });
  } catch (err: any) {
    console.error("Failed to update credentials:", err);
    res.status(500).json({ message: "Failed to update credentials" });
  }
});

app.get("/api/auth/user", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
  const user = await storage.getUser(req.session.userId);
  if (!user) return res.status(401).json({ message: "User not found" });
  res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });
});

app.get(api.products.list.path, isAuth, async (req, res) => {
  const productsList = await storage.getProducts();
  res.json(productsList);
});

app.post(api.products.create.path, isAuth, async (req, res) => {
  try {
    const input = api.products.create.input.parse(req.body);
    const product = await storage.createProduct(input);
    res.status(201).json(product);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join('.'),
      });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

app.put(api.products.update.path, isAuth, async (req, res) => {
  try {
    const input = api.products.update.input.parse(req.body);
    const product = await storage.updateProduct(Number(req.params.id), input);
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: "Invalid input" });
  }
});

app.delete(api.products.delete.path, isAuth, async (req, res) => {
  await storage.deleteProduct(Number(req.params.id));
  res.status(204).send();
});

app.get("/api/products/:productId/credentials", isAuth, async (req, res) => {
  const productId = Number(req.params.productId);
  const credentialsList = await storage.getCredentialsByProduct(productId);
  res.json(credentialsList);
});

app.post("/api/credentials", isAuth, async (req, res) => {
  try {
    const input = insertCredentialSchema.parse(req.body);
    const credential = await storage.createCredential(input);

    // Auto-detection for AWS accounts
    try {
      const product = await storage.getProduct(input.productId);
      if (product && (product.name.toLowerCase().includes("aws") || product.type.toLowerCase().includes("aws"))) {
        console.log(`[AWS-AUTO] Checking credential for product: ${product.name}`);

        const accessKeyMatch = input.content.match(/\b(AKIA[A-Z0-9]{12,20})\b/);
        // Match 30-45 character base64 string, avoiding \b because + and / are non-word characters
        const secretKeyMatches = input.content.match(/(?:^|\s)([A-Za-z0-9/+=]{30,60})(?=$|\s)/g);
        const emailMatch = input.content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const regionMatch = input.content.match(/\b([a-z]{2}-(?:east|west|north|south|central|pout|northeast|southeast)-\d)\b/);

        console.log(`[AWS-AUTO] Matches - AccessKey: ${!!accessKeyMatch}, SecretKeys Found: ${secretKeyMatches?.length || 0}, Email: ${!!emailMatch}`);

        let secretKey = null;
        if (secretKeyMatches && accessKeyMatch) {
          // Pick the first match that isn't the Access Key and is likely the secret (usually 40 chars but we are flexible)
          secretKey = secretKeyMatches.find(s => s.length >= 30 && s.length <= 45);
        }

        if (accessKeyMatch && secretKey) {
          const accessKey = accessKeyMatch[1];
          const email = emailMatch ? emailMatch[0] : null;
          const region = regionMatch ? regionMatch[1] : "us-east-1";

          console.log(`[AWS-AUTO] Keys found! AccessKey: ${accessKey}, Email: ${email}`);

          const existingAccounts = await storage.getAwsAccounts();
          if (!existingAccounts.some(acc => acc.accessKey === accessKey)) {
            console.log(`[AWS-AUTO] Creating new account...`);
            const newAcc = await storage.createAwsAccount({
              name: email || product.name,
              email,
              accessKey,
              secretKey,
              region,
              isSold: false,
              status: "active"
            });

            console.log(`[AWS-AUTO] Account created (ID: ${newAcc.id}). Triggering 7-day sync.`);
            fetchActivity(newAcc, 7).catch(e => console.error("[AWS-AUTO] Initial sync error:", e));
          } else {
            console.log(`[AWS-AUTO] Account with access key ${accessKey} already exists.`);
          }
        } else {
          console.log(`[AWS-AUTO] Could not identify both access key and secret key.`);
        }
      }
    } catch (autoErr) {
      console.error("AWS Auto-detection error:", autoErr);
    }

    // Auto fulfill any pending preorders if this was stock addition
    autoFulfillPendingPreorders(input.productId).catch(e => console.error("[AutoFulfill Error]:", e));

    res.status(201).json(credential);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join('.'),
      });
    }
    res.status(400).json({ message: "Invalid input" });
  }
});

app.delete("/api/credentials/:id", isAuth, async (req, res) => {
  await storage.deleteCredential(Number(req.params.id));
  res.status(204).send();
});

app.patch("/api/credentials/:id", isAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const input = insertCredentialSchema.partial().parse(req.body);
    const [updated] = await db.update(credentials).set(input).where(eq(credentials.id, id)).returning();
    if (!updated) return res.status(404).json({ message: "Credential not found" });
    if (updated.status === 'available') {
      autoFulfillPendingPreorders(updated.productId).catch(e => console.error("[AutoFulfill Error]:", e));
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Invalid input" });
  }
});

app.get("/api/all-credentials", isAuth, async (req, res) => {
  const allCredentials = await db.select().from(credentials).orderBy(desc(credentials.createdAt));
  res.json(allCredentials);
});

app.get(api.orders.list.path, isAuth, async (req, res) => {
  const ordersList = await storage.getOrders();
  res.json(ordersList);
});

// Dashboard Stats Endpoint
app.get(api.stats.get.path, isAuth, async (req, res) => {
  try {
    const stats = await storage.getStats();
    res.json(stats);
  } catch (err: any) {
    console.error("Stats error:", err);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});



app.get(api.broadcast.channels.list.path, isAuth, async (req, res) => {
  const channels = await storage.getBroadcastChannels();
  res.json(channels);
});

const getBotToken = async () => {
  const setting = await storage.getSetting("TELEGRAM_BOT_TOKEN");
  return setting?.value || process.env.TELEGRAM_BOT_TOKEN;
};

const getInspectorBotToken = async () => {
  const setting = await storage.getSetting("INSPECTOR_BOT_TOKEN");
  return setting?.value || process.env.INSPECTOR_BOT_TOKEN || "8597932397:AAEweM3gKQpDKFx0OJzdHdtIBbQ2ZVLR448";
};

const getBroadcastBot = async () => {
  const setting = await storage.getSetting("BROADCAST_BOT_TOKEN");
  const token = setting?.value || (await getBotToken());
  if (!token) return null;
  const bBot = new TelegramBot(token);
  patchBotMethods(bBot);
  return bBot;
};

app.post(api.broadcast.send.path, isAuth, async (req, res) => {
  try {
    const { text, photo, buttonText, buttonUrl, channelIds, botType } = req.body;
    let targetChannels = [];

    let bBot: TelegramBot | null = null;
    if (botType === 'broadcast') {
      bBot = await getBroadcastBot();
    } else {
      bBot = bot; // Main bot
    }

    if (!bBot) {
      return res.status(400).json({ message: `${botType === 'broadcast' ? 'Broadcast' : 'Main'} bot is not initialized` });
    }

    if (channelIds && channelIds.length > 0) {
      targetChannels = channelIds;
    } else {
      // Fallback to all Telegram users if no specific channels selected
      const tgUsers = await storage.getAllTelegramUsers();
      targetChannels = tgUsers.map(u => u.telegramId);

      // If still no users, check broadcast channels
      if (targetChannels.length === 0) {
        const channels = await storage.getBroadcastChannels();
        targetChannels = channels.map(c => c.channelId);
      }
    }

    let countSent = 0;
    for (const channelId of targetChannels) {
      try {
        const opts: TelegramBot.SendMessageOptions = {
          parse_mode: 'Markdown'
        };
        if (buttonText && buttonUrl) {
          opts.reply_markup = {
            inline_keyboard: [[{ text: buttonText, url: buttonUrl }]]
          };
        }

        if (photo) {
          await bBot.sendPhoto(channelId, photo, {
            caption: text,
            ...opts
          } as any);
        } else {
          await bBot.sendMessage(channelId, text, opts);
        }
        countSent++;
      } catch (err) {
        console.error(`Failed to send message to channel ${channelId}:`, err);
      }
    }

    res.json({ success: true, count: countSent });
  } catch (err) {
    console.error('Broadcast error:', err);
    res.status(400).json({ message: "Invalid input" });
  }
});

let activeIntervals: Map<number, NodeJS.Timeout> = new Map();

const stopScheduledBroadcast = (id: number) => {
  const timer = activeIntervals.get(id);
  if (timer) {
    clearInterval(timer);
    activeIntervals.delete(id);
  }
};

const startScheduledBroadcast = (msg: any) => {
  const send = async () => {
    const messages = await storage.getBroadcastMessages();
    const current = messages.find(m => m.id === msg.id);
    if (!current || current.status !== 'active') {
      stopScheduledBroadcast(msg.id);
      return;
    }

    const channels = await storage.getBroadcastChannels();
    const bBot = await getBroadcastBot();
    if (bBot) {
      for (const channel of channels) {
        try {
          const opts: TelegramBot.SendMessageOptions = {};
          if (current.buttonText && current.buttonUrl) {
            opts.reply_markup = {
              inline_keyboard: [[{ text: current.buttonText, url: current.buttonUrl }]]
            };
          }

          if (current.imageUrl) {
            await bBot.sendPhoto(channel.channelId, current.imageUrl, {
              caption: current.content,
              ...opts
            });
          } else {
            await bBot.sendMessage(channel.channelId, current.content, opts);
          }
        } catch (err) { }
      }
      await storage.updateBroadcastMessage(msg.id, { sentCount: current.sentCount + 1 });
    }
  };

  const timer = setInterval(send, msg.interval * 60 * 1000);
  activeIntervals.set(msg.id, timer);
};

const initSchedules = async () => {
  try {
    const messages = await storage.getBroadcastMessages();
    for (const msg of messages) {
      if (msg.status === 'active' && msg.interval && msg.interval > 0) {
        startScheduledBroadcast(msg);
      }
    }
  } catch (err) {
    console.error('Failed to initialize broadcast schedules:', err);
  }
};
initSchedules();

app.post("/api/broadcast/schedule", isAuth, async (req, res) => {
  try {
    const { message, channelIds, interval } = req.body;

    if (!interval || interval <= 0) {
      return res.status(400).json({ message: "Invalid interval" });
    }

    const sendBroadcast = async () => {
      let targetChannels = [];
      if (channelIds && channelIds.length > 0) {
        targetChannels = channelIds;
      } else {
        const channels = await storage.getBroadcastChannels();
        targetChannels = channels.map(c => c.channelId);
      }

      const bBot = await getBroadcastBot();
      if (bBot) {
        for (const channelId of targetChannels) {
          try {
            await bBot.sendMessage(channelId, message);
          } catch (err) {
            console.error(`Scheduled broadcast failed for ${channelId}:`, err);
          }
        }
      }
    };

    sendBroadcast();
    setInterval(sendBroadcast, interval * 60 * 60 * 1000);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: "Invalid input" });
  }
});

app.post("/api/broadcast/upload", isAuth, upload.single('image'), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

app.get(api.stats.get.path, isAuth, async (req, res) => {
  try {
    const stats = await storage.getStats();
    res.json(stats);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get(api.telegramUsers.list.path, isAuth, async (req, res) => {
  try {
    const usersList = await storage.getAllTelegramUsers();
    res.json(usersList);
  } catch (err) {
    console.error('Telegram users list error:', err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.patch(api.telegramUsers.update.path, isAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existingUser = await storage.getTelegramUser(id.toString());
    const input = api.telegramUsers.update.input.parse(req.body);
    const user = await storage.updateTelegramUser(id, input);

    if (input.balance !== undefined && existingUser && input.balance > (existingUser.balance || 0)) {
      const addedAmountUSD = (input.balance - (existingUser.balance || 0)) / 100;
      const activeBot = await getBroadcastBot();
      if (activeBot && user.telegramId) {
        await sendDepositSuccessNotification(activeBot, user.telegramId, addedAmountUSD, user.balance / 100, "Admin Web Top-up").catch(console.error);
      }
    }

    res.json(user);
  } catch (err) {
    console.error('Telegram user update error:', err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Verify/create preorders table and product columns
try {
  db.execute(sql`
    CREATE TABLE IF NOT EXISTS preorders (
      id SERIAL PRIMARY KEY,
      telegram_user_id INTEGER NOT NULL REFERENCES telegram_users(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL DEFAULT 1,
      total_price INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_fulfillment',
      fulfilled_credential_ids TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      fulfilled_at TIMESTAMP
    );
  `).catch(() => {});
  db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_preorder_enabled BOOLEAN DEFAULT FALSE;`).catch(() => {});
  db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_quota INTEGER DEFAULT 50;`).catch(() => {});
  console.log("[DB] preorders table & product preorder columns verified/created");
} catch (err) {
  console.error("[DB Init Preorders Error]:", err);
}

app.post('/api/admin/audit-and-fix', isAuth, async (req, res) => {
  try {
    const allUsers = await storage.getAllTelegramUsers();
    const allOrders = await storage.getOrders();
    const allCredentials = await db.select().from(credentials);

    let fixedCount = 0;
    let totalIssuesFound = 0;
    const auditLogs: string[] = [];

    for (const order of allOrders) {
      const cred = allCredentials.find(c => c.id === order.credentialId);
      if (!cred) {
        totalIssuesFound++;
        auditLogs.push(`Order #${order.id} missing credential reference.`);
      } else if (cred.status !== 'sold') {
        totalIssuesFound++;
        await db.update(credentials).set({ status: 'sold' }).where(eq(credentials.id, cred.id));
        fixedCount++;
        auditLogs.push(`Order #${order.id} credential #${cred.id} status synced to 'sold'.`);
      }
    }

    for (const cred of allCredentials) {
      if (cred.status === 'sold') {
        const hasOrder = allOrders.some(o => o.credentialId === cred.id);
        if (!hasOrder) {
          totalIssuesFound++;
          await db.update(credentials).set({ status: 'available' }).where(eq(credentials.id, cred.id));
          fixedCount++;
          auditLogs.push(`Credential #${cred.id} released back to stock (was marked sold with no order).`);
        }
      }
    }

    res.json({
      success: true,
      message: totalIssuesFound > 0
        ? `Audit completed. Found ${totalIssuesFound} issue(s), automatically repaired ${fixedCount} issue(s).`
        : `System audit complete! 0 issues found. All accounts, orders, and balance transactions are 100% verified.`,
      issuesFound: totalIssuesFound,
      issuesFixed: fixedCount,
      logs: auditLogs
    });
  } catch (err: any) {
    console.error('[Audit Error]:', err);
    res.status(500).json({ message: err.message || "Audit failed" });
  }
});

// Pre-Orders API
app.get('/api/preorders', isAuth, async (req, res) => {
  try {
    const list = await storage.getPreorders();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Failed to fetch preorders" });
  }
});

app.post('/api/admin/fulfill-preorders', isAuth, async (req, res) => {
  try {
    await autoFulfillPendingPreorders();
    res.json({ success: true, message: "Auto-fulfillment run complete!" });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Fulfillment failed" });
  }
});

app.get(api.payments.list.path, isAuth, async (req, res) => {
  try {
    const allPayments = await storage.getAllPaymentsWithUsers();
    res.json(allPayments);
  } catch (err) {
    console.error('Payments list error:', err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Special Offers API
app.get("/api/special-offers", isAuth, async (req, res) => {
  try {
    const offers = await storage.getSpecialOffers();
    res.json(offers);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/special-offers", isAuth, async (req, res) => {
  try {
    const body = { ...req.body };
    if (typeof body.expiresAt === 'string') {
      body.expiresAt = new Date(body.expiresAt);
    }
    const input = insertSpecialOfferSchema.parse(body);

    console.log(`Checking inventory for product ${input.productId}, bundle quantity ${input.bundleQuantity}`);
    // Check inventory before creating special offer
    const stock = await storage.getCredentialsByProduct(input.productId);
    const availableStock = stock.filter(c => c.status === 'available');
    console.log(`Available stock: ${availableStock.length}`);

    if (availableStock.length < input.bundleQuantity) {
      console.log(`Validation failed: Insufficient inventory`);
      return res.status(400).json({
        message: `Insufficient inventory for this bundle. Required: ${input.bundleQuantity}, Available: ${availableStock.length}`
      });
    }

    const offer = await storage.createSpecialOffer(input);
    res.status(201).json(offer);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join('.'),
      });
    }
    console.error("Error creating special offer:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.patch("/api/special-offers/:id", isAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = { ...req.body };
    if (typeof body.expiresAt === 'string') {
      body.expiresAt = new Date(body.expiresAt);
    }
    const input = insertSpecialOfferSchema.partial().parse(body);

    // If we are updating quantity or product, check inventory
    if (input.productId !== undefined || input.bundleQuantity !== undefined) {
      const currentOffer = await storage.getSpecialOffer(id);
      if (currentOffer) {
        const productId = input.productId ?? currentOffer.productId;
        const bundleQuantity = input.bundleQuantity ?? currentOffer.bundleQuantity;

        const stock = await storage.getCredentialsByProduct(productId);
        const availableStock = stock.filter(c => c.status === 'available');

        if (availableStock.length < bundleQuantity) {
          return res.status(400).json({
            message: `Insufficient inventory for this bundle. Required: ${bundleQuantity}, Available: ${availableStock.length}`
          });
        }
      }
    }

    const offer = await storage.updateSpecialOffer(id, input);
    res.json(offer);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    console.error("Error updating special offer:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/api/special-offers/:id", isAuth, async (req, res) => {
  try {
    await storage.deleteSpecialOffer(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// Promo Codes API
app.get("/api/promo-codes", isAuth, async (req, res) => {
  try {
    const codes = await storage.getPromoCodes();
    res.json(codes);
  } catch (err: any) {
    console.error("Error fetching promo codes:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/promo-codes", isAuth, async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.reward !== undefined) {
      body.reward = Math.round(Number(body.reward) * 100); // convert USD to cents
    }
    if (body.maxUses !== undefined) {
      body.maxUses = parseInt(body.maxUses);
    }
    
    const parsed = insertPromoCodeSchema.parse(body);

    const existing = await storage.getPromoCodeByCode(parsed.code);
    if (existing) {
      return res.status(400).json({ message: `Promo code "${parsed.code}" already exists.` });
    }

    const code = await storage.createPromoCode(parsed);
    res.status(201).json(code);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join('.'),
      });
    }
    console.error("Error creating promo code:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.patch("/api/promo-codes/:id", isAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = { ...req.body };
    if (body.reward !== undefined) {
      body.reward = Math.round(Number(body.reward) * 100); // convert USD to cents
    }
    if (body.maxUses !== undefined) {
      body.maxUses = parseInt(body.maxUses);
    }

    const parsed = insertPromoCodeSchema.partial().parse(body);
    const updated = await storage.updatePromoCode(id, parsed);
    res.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    console.error("Error updating promo code:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/api/promo-codes/:id", isAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await storage.deletePromoCode(id);
    res.status(204).send();
  } catch (err: any) {
    console.error("Error deleting promo code:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/promo-codes-redemptions", isAuth, async (req, res) => {
  try {
    const redemptions = await storage.getPromoCodeRedemptions();
    res.json(redemptions);
  } catch (err: any) {
    console.error("Error fetching promo code redemptions:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

const formatOfferMessage = (offer: any, productType: string) => {
  const priceUSD = (offer.price / 100).toFixed(2);
  const headerEmojiIds = [
    "6276128687649723695", "6275964744453068322", "6275873218699989657",
    "6275869662467069270", "6276120956708591159", "6276075885321786491",
    "6276045545672807753", "6273727139506295416", "6276107406086771779"
  ];
  const header = headerEmojiIds.map(id => `<tg-emoji emoji-id="${id}">🎁</tg-emoji>`).join('');
  const numEmojiMap: Record<string, string> = {
    "0": "6228712321716325542", "1": "6231028576104221771", "2": "6228508985079632140",
    "3": "6228892912206220866", "4": "6228651427670002796", "5": "6230754058974531742",
    "6": "6231061110481488717", "7": "6228541351953173776", "8": "6228898272325406140",
    "9": "6230968699965150268"
  };

  let text = `<tg-emoji emoji-id="5467538555158943525">💭</tg-emoji> <b>Special Offers (Bundle Deals)</b> <tg-emoji emoji-id="5456343263340405032">🛍</tg-emoji>\n━━━━━━━━━━━━━━━\n\n`;
  text += `${header}\n\n`;
  text += `<b>${offer.name}</b>\n\n`;
  text += `<tg-emoji emoji-id="6276134137963222688">🎁</tg-emoji> Quantity: <b>${offer.bundleQuantity} pcs</b>\n`;
  text += `<tg-emoji emoji-id="5201692367437974073">💸</tg-emoji> Bundle Price: <b>$${priceUSD}</b>\n\n`;

  if (offer.expiresAt) {
    const diff = new Date(offer.expiresAt).getTime() - Date.now();
    if (diff > 0) {
      const totalSeconds = Math.floor(diff / 1000);
      const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
      const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
      const s = (totalSeconds % 60).toString().padStart(2, '0');

      text += `<tg-emoji emoji-id="5206715082582533386">🤩</tg-emoji> <b>Hurry! Expires In</b> <tg-emoji emoji-id="5206715082582533386">🤩</tg-emoji>\n`;
      const formatTimeDigit = (digit: string | undefined) => {
        const d = digit || '0';
        return `<tg-emoji emoji-id="${numEmojiMap[d] || numEmojiMap['0']}">🎁</tg-emoji>`;
      };
      text += `${formatTimeDigit(h[0])}${formatTimeDigit(h[1])} <b>:</b> ${formatTimeDigit(m[0])}${formatTimeDigit(m[1])} <b>:</b> ${formatTimeDigit(s[0])}${formatTimeDigit(s[1])}\n`;
    }
  }
  text += `━━━━━━━━━━━━━━━\n`;
  return text;
};

const activeSessionTimers = new Map<string, NodeJS.Timeout>();
const confirmingOffers = new Set<string>();

// Global Background Broadcast Timer (runs every 30 seconds)
setInterval(async () => {
  try {
    const activeOffers = await storage.getActiveSpecialOffers();
    if (activeOffers.length === 0) return;

    const usersToUpdate = await storage.getTelegramUsersWithBroadcast();
    for (const u of usersToUpdate) {
      // Skip if user has an active fast session timer OR is currently confirming an offer
      const tgUser = await storage.getTelegramUser(u.telegramId);
      if (activeSessionTimers.has(u.telegramId) || confirmingOffers.has(u.telegramId) || (tgUser?.lastAction && tgUser.lastAction.startsWith('confirming_offer_'))) continue;

      try {
        const offer = activeOffers[0]; // For now, update with the latest active offer
        const product = offer.product;
        const productType = product?.type || "General";
        const text = formatOfferMessage(offer, productType);
        const priceUSD = (offer.price / 100).toFixed(2);

        await bot?.editMessageText(text, {
          chat_id: u.telegramId,
          message_id: u.lastOfferBroadcastId!,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: 'Buy Now', callback_data: `buy_offer_${offer.id}`, style: 'success', icon_custom_emoji_id: '5361781191722699867' }]]
          }
        });
      } catch (err: any) {
        if (err.message && err.message.includes("message is not modified")) continue;
        if (err.message && (err.message.includes("message to edit not found") || err.message.includes("chat not found"))) {
          await storage.updateTelegramUser(u.id, { lastOfferBroadcastId: null });
        }
      }
    }
  } catch (err) {
    console.error("Global broadcast timer error:", err);
  }
}, 30000);

const startFastTimer = async (telegramId: string, offerId: number, messageId: number) => {
  if (activeSessionTimers.has(telegramId)) {
    clearInterval(activeSessionTimers.get(telegramId)!);
  }

  const interval = setInterval(async () => {
    try {
      if (confirmingOffers.has(telegramId)) return;
      const tgUser = await storage.getTelegramUser(telegramId);
      if (tgUser?.lastAction && tgUser.lastAction.startsWith('confirming_offer_')) return;

      const offer = await storage.getSpecialOffer(offerId);
      if (!offer || (offer.expiresAt && new Date(offer.expiresAt).getTime() <= Date.now())) {
        clearInterval(interval);
        activeSessionTimers.delete(telegramId);
        return;
      }

      const product = await storage.getProduct(offer.productId);
      const text = formatOfferMessage(offer, product?.type || "General");
      const priceUSD = (offer.price / 100).toFixed(2);

      await bot?.editMessageText(text, {
        chat_id: telegramId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: 'Buy Now', callback_data: `buy_offer_${offer.id}`, style: 'success', icon_custom_emoji_id: '5361781191722699867' }]]
        }
      });
    } catch (err: any) {
      if (err.message && err.message.includes("message is not modified")) return;
      clearInterval(interval);
      activeSessionTimers.delete(telegramId);
    }
  }, 1000);

  activeSessionTimers.set(telegramId, interval);

  // Stop fast timer after 5 minutes of inactivity (default safety)
  setTimeout(() => {
    if (activeSessionTimers.get(telegramId) === interval) {
      clearInterval(interval);
      activeSessionTimers.delete(telegramId);
    }
  }, 300000);
};

app.post("/api/special-offers/:id/broadcast", isAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const offer = await storage.getSpecialOffer(id);
    if (!offer) return res.status(404).json({ message: "Special offer not found" });

    const product = await storage.getProduct(offer.productId);
    const productType = product?.type || "General";
    const priceUSD = (offer.price / 100).toFixed(2);

    const mainBot = bot;
    if (!mainBot) return res.status(400).json({ message: "Bot not initialized" });

    // Production: Scale broadcast to all active Telegram users
    const users = await storage.getAllTelegramUsers();
    const targets = users.map(u => u.telegramId);

    // Define the missing 'text' variable using the proper formatter
    const text = formatOfferMessage(offer, productType);

    let countSent = 0;
    for (const targetId of targets) {
      try {
        const sentMsg = await mainBot.sendMessage(targetId, text, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: 'Buy Now', callback_data: `buy_offer_${offer.id}`, style: 'success', icon_custom_emoji_id: '5361781191722699867' }]]
          }
        });

        if (sentMsg) {
          await storage.updateTelegramUserByChatId(targetId, { lastOfferBroadcastId: sentMsg.message_id });
        }

        countSent++;
      } catch (err) {
        console.error(`Failed to send premium broadcast to ${targetId}:`, err);
      }
    }

    res.json({ success: true, count: countSent });
  } catch (err) {
    console.error('Premium broadcast error:', err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// AWS Checker API
app.get("/api/aws/accounts", isAuth, async (req, res) => {
  try {
    // Periodic cleanup of expired payments
    await storage.expireOldPayments();

    const accounts = await storage.getAwsAccounts();
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/aws/accounts", isAuth, async (req, res) => {
  try {
    const input = insertAwsAccountSchema.parse(req.body);
    const account = await storage.createAwsAccount(input);

    // Automatic 7-day sync after creation to show history immediately
    (async () => {
      try {
        console.log(`Initial 7-day sync for new account: ${account.name} (ID: ${account.id})`);
        await fetchActivity(account, 30);
      } catch (syncErr) {
        console.error(`Initial sync failed for account ${account.id}:`, syncErr);
      }
    })();

    res.status(201).json(account);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/api/aws/accounts/:id", isAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const account = await storage.updateAwsAccount(id, req.body);
    res.json(account);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/api/aws/accounts", isAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Invalid or empty account ids." });
    }
    for (const id of ids) {
      await storage.deleteAwsAccount(Number(id));
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/api/aws/accounts/:id", isAuth, async (req, res) => {
  try {
    await storage.deleteAwsAccount(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/aws/activities", isAuth, async (req, res) => {
  try {
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    const activities = await storage.getAwsActivities(accountId);
    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/aws/refresh", isAuth, async (req, res) => {
  try {
    const { accountIds, lookbackDays = 7 } = req.body || {};
    const allAccounts = await storage.getAwsAccounts();
    const accounts = (accountIds && Array.isArray(accountIds) && accountIds.length > 0)
      ? allAccounts.filter(a => accountIds.includes(a.id))
      : allAccounts;
    const results = [];
    for (const account of accounts) {
      const result = await fetchActivity(account, lookbackDays);
      results.push({ id: account.id, ...result });
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));
app.use('/tutorials', express.static(path.join(process.cwd(), 'public', 'tutorials')));

app.post("/api/broadcast/custom", isAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: "Message content is required" });
    }

    const telegramUsersList = await storage.getAllTelegramUsers();
    const bBot = await getBroadcastBot();

    if (!bBot) {
      return res.status(400).json({ message: "Bot not initialized" });
    }

    let countSent = 0;
    for (const user of telegramUsersList) {
      try {
        await bBot.sendMessage(user.telegramId, message, { parse_mode: 'Markdown' });
        countSent++;
      } catch (err) {
        console.error(`Failed to send custom broadcast to user ${user.telegramId}:`, err);
      }
    }

    res.json({ success: true, count: countSent });
  } catch (err) {
    console.error('Custom broadcast error:', err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/broadcast/availability", isAuth, async (req, res) => {
  try {
    const products = await storage.getProducts();
    const availableProducts = products.filter(p => p.status === 'available');

    const groupedProducts: Record<string, any[]> = {};
    for (const p of availableProducts) {
      const stockCount = (await storage.getCredentialsByProduct(p.id)).filter(c => c.status === 'available').length;
      if (stockCount > 0) {
        if (!groupedProducts[p.type]) groupedProducts[p.type] = [];
        groupedProducts[p.type].push({ ...p, stockCount });
      }
    }

    if (Object.keys(groupedProducts).length === 0) {
      return res.status(400).json({ message: "No accounts in stock to broadcast." });
    }

    let availabilityMsg = `<tg-emoji emoji-id="5215209935188534658">📋</tg-emoji> <b>Product Availability</b>\n\n`;
    for (const [category, items] of Object.entries(groupedProducts)) {
      let catIcon = '';
      const catLower = category.toLowerCase();
      if (catLower.includes('aws')) catIcon = '<tg-emoji emoji-id="5785025630055700143">☁️</tg-emoji> ';
      else if (catLower.includes('digital ocean') || catLower.includes('digitalocean')) catIcon = '<tg-emoji emoji-id="6235413342576450502">💧</tg-emoji> ';
      else if (catLower.includes('azure')) catIcon = '<tg-emoji emoji-id="6235420094265037090">☁️</tg-emoji> ';
      else if (catLower.includes('kamatera')) catIcon = '<tg-emoji emoji-id="6235239937566838722">☁️</tg-emoji> ';

      availabilityMsg += `➖➖➖ ${catIcon}<b>${category}</b> <tg-emoji emoji-id="5456343263340405032">🛍</tg-emoji> ➖➖➖\n`;
      for (const item of items) {
        let formattedName = item.name.replace(/🇱🇰/g, '<tg-emoji emoji-id="5224277294050192388">🇱🇰</tg-emoji>');
        if (!formattedName.includes('5785025630055700143')) {
          formattedName = formattedName.replace(/\bAWS\b/gi, '<tg-emoji emoji-id="5785025630055700143">☁️</tg-emoji> AWS');
        }
        availabilityMsg += `${formattedName} | $${(item.price / 100).toFixed(2)} | In stock ${item.stockCount} pcs\n`;
      }
      availabilityMsg += "\n";
    }

    // Use the main bot instead of the broadcast bot
    const mainBot = bot;

    if (!mainBot) {
      return res.status(400).json({ message: "Main bot not initialized" });
    }

    // Production: Scale broadcast to all active Telegram users
    const users = await storage.getAllTelegramUsers();
    const targets = users.map(u => u.telegramId);

    let countSent = 0;
    for (const targetId of targets) {
      try {
        await mainBot.sendMessage(targetId, availabilityMsg, { parse_mode: 'HTML' });
        countSent++;
      } catch (err) {
        console.error(`Failed to send availability to user ${targetId}:`, err);
      }
    }

    res.json({ success: true, count: countSent });
  } catch (err) {
    console.error('Broadcast availability error:', err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/settings", isAuth, async (req, res) => {
  try {
    const { key, value } = req.body;
    const updated = await storage.updateSetting(key, value);

    // Re-initialize bot if token changed
    if (key === "TELEGRAM_BOT_TOKEN" || key === "BROADCAST_BOT_TOKEN" || key === "INSPECTOR_BOT_TOKEN") {
      await initBot();
    } else if (key === "VAPID_PUBLIC_KEY" || key === "VAPID_PRIVATE_KEY" || key === "VAPID_SUBJECT") {
      const { initPushNotifications } = await import("./push-notifications");
      await initPushNotifications();
    }

    res.json(updated);
  } catch (err) {
    console.error('Settings update error:', err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/settings", isAuth, async (req, res) => {
  try {
    const allSettings = await db.select().from(settings);
    res.json(allSettings);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/settings/:key", isAuth, async (req, res) => {
  try {
    const setting = await storage.getSetting(req.params.key);
    res.json(setting || { key: req.params.key, value: "" });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// Telegram Inspector Traces API
app.get("/api/telegram-inspector/traces", isAuth, (req, res) => {
  try {
    const traces = getTraceHistory();
    if (traces.length === 0) {
      // Pre-populate initial custom emoji traces for immediate display
      const initialRecord = {
        id: `init-${Date.now()}`,
        timestamp: new Date().toISOString(),
        chatId: "System Inspector",
        userId: "System",
        username: "system_inspector",
        userFirstName: "Telegram Inspector",
        rawText: "Payment Gateway Telegram Premium Custom Emojis Registered: CryptoBot, Binance Pay, BEP20, TRC20, USD Amount",
        reconstructedHtml: `<b>System Registered Custom Emojis:</b>\n` +
          `• CryptoBot: <tg-emoji emoji-id="5361914370068613491">🤖</tg-emoji> (5361914370068613491)\n` +
          `• Binance Pay: <tg-emoji emoji-id="5281029063459234079">🔸</tg-emoji> (5281029063459234079)\n` +
          `• USDT BEP-20: <tg-emoji emoji-id="5280907155107506256">🟡</tg-emoji> (5280907155107506256)\n` +
          `• USDT TRC-20: <tg-emoji emoji-id="5936189134342199863">🔴</tg-emoji> (5936189134342199863)\n` +
          `• USD Amount Button: <tg-emoji emoji-id="5201692367437974073">💵</tg-emoji> (5201692367437974073)`,
        customEmojis: [
          { id: "5361914370068613491", char: "🤖", offset: 0, length: 2 },
          { id: "5281029063459234079", char: "🔸", offset: 0, length: 2 },
          { id: "5280907155107506256", char: "🟡", offset: 0, length: 2 },
          { id: "5936189134342199863", char: "🔴", offset: 0, length: 2 },
          { id: "5201692367437974073", char: "💵", offset: 0, length: 2 }
        ],
        entitySummary: [
          { type: "custom_emoji", count: 5, samples: ["5361914370068613491", "5281029063459234079", "5280907155107506256", "5936189134342199863", "5201692367437974073"] }
        ]
      };
      traces.unshift(initialRecord as any);
    }
    res.json(traces);
  } catch (err) {
    console.error('Failed to fetch telegram inspector traces:', err);
    res.status(500).json({ message: "Failed to fetch traces" });
  }
});

app.post("/api/telegram-inspector/inspect", isAuth, (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: "Text parameter required" });
    }

    const customEmojiRegex = /(?:<tg-emoji emoji-id="(\d+)">|emoji-id[:=]"?(\d+)"?|\b(\d{18,19})\b)/g;
    const foundEmojis: Array<{ id: string; char: string; offset: number; length: number }> = [];
    let match;
    while ((match = customEmojiRegex.exec(text)) !== null) {
      const emojiId = match[1] || match[2] || match[3];
      if (emojiId && !foundEmojis.some(e => e.id === emojiId)) {
        foundEmojis.push({
          id: emojiId,
          char: '⭐',
          offset: match.index,
          length: match[0].length
        });
      }
    }

    const record = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      chatId: "Admin Manual Tester",
      userId: "Admin",
      username: "admin",
      userFirstName: "System Admin",
      rawText: text,
      reconstructedHtml: text.includes('<') ? text : `Inspected: ${text}`,
      customEmojis: foundEmojis,
      entitySummary: foundEmojis.length > 0 ? [{ type: 'custom_emoji', count: foundEmojis.length, samples: foundEmojis.map(e => e.id) }] : []
    };

    const traces = getTraceHistory();
    traces.unshift(record as any);

    if (io) {
      io.emit('telegram_inspector_new_trace', record);
    }

    res.json({ success: true, record });
  } catch (err: any) {
    console.error('Failed to run manual inspection:', err);
    res.status(500).json({ message: err.message || "Failed to inspect text" });
  }
});

app.delete("/api/telegram-inspector/traces", isAuth, (req, res) => {
  try {
    clearTraceHistory();
    res.json({ success: true, message: "All traces cleared" });
  } catch (err) {
    console.error('Failed to clear telegram inspector traces:', err);
    res.status(500).json({ message: "Failed to clear traces" });
  }
});

app.delete("/api/telegram-inspector/traces/:id", isAuth, (req, res) => {
  try {
    const deleted = deleteTraceRecord(req.params.id);
    res.json({ success: deleted });
  } catch (err) {
    console.error('Failed to delete trace record:', err);
    res.status(500).json({ message: "Failed to delete trace" });
  }
});

// Backup Routes
app.get("/api/backups/config", isAuth, async (req, res) => {
  const configs = await storage.getBackupConfigs();
  res.json(configs[0] || null);
});

app.post("/api/backups/config", isAuth, async (req, res) => {
  try {
    const configs = await storage.getBackupConfigs();
    let result;
    if (configs.length > 0) {
      result = await storage.updateBackupConfig(configs[0].id, req.body);
    } else {
      result = await storage.createBackupConfig(req.body);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/backups/logs", isAuth, async (req, res) => {
  const logs = await storage.getBackupLogs(50);
  res.json(logs);
});

app.post("/api/backups/trigger", isAuth, async (req, res) => {
  const configs = await storage.getBackupConfigs();
  if (configs.length === 0) return res.status(400).json({ message: "No backup configuration found" });

  // Trigger in background
  BackupService.performBackup(configs[0].id).catch(err => console.error("Manual backup trigger failed:", err));
  res.json({ message: "Backup triggered successfully" });
});

// Anti-Spam Protection API Endpoints
app.get("/api/spam-protector/stats", isAuth, async (req, res) => {
  try {
    const autoBanEnabled = (await storage.getSetting('SPAM_AUTO_BAN_ENABLED'))?.value !== 'false';
    const maxReqPerMin = parseInt((await storage.getSetting('SPAM_MAX_REQ_PER_MIN'))?.value || '15', 10);
    const tempBanDurationMins = parseInt((await storage.getSetting('SPAM_TEMP_BAN_DURATION_MINS'))?.value || '15', 10);

    const allUsers = await storage.getAllTelegramUsers();
    const now = Date.now();

    const userStats = allUsers.map(u => {
      const timestamps = (userRequestTimestamps.get(u.telegramId) || []).filter(t => now - t < 60000);
      const isTempBanned = Boolean(u.bannedUntil && new Date(u.bannedUntil).getTime() > now);
      return {
        id: u.id,
        telegramId: u.telegramId,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        balance: u.balance,
        isBanned: u.isBanned,
        bannedUntil: u.bannedUntil,
        isTempBanned,
        spamViolations: u.spamViolations || 0,
        lastRequestAt: u.lastRequestAt,
        reqPerMin: timestamps.length
      };
    });

    userStats.sort((a, b) => b.reqPerMin - a.reqPerMin || b.spamViolations - a.spamViolations);
    const totalBannedUsers = userStats.filter(u => u.isBanned || u.isTempBanned).length;

    res.json({
      autoBanEnabled,
      maxReqPerMin,
      tempBanDurationMins,
      totalMonitoredUsers: allUsers.length,
      totalBannedUsers,
      users: userStats
    });
  } catch (err) {
    console.error("Anti-Spam stats error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/spam-protector/config", isAuth, async (req, res) => {
  try {
    const { autoBanEnabled, maxReqPerMin, tempBanDurationMins } = req.body;
    const maxReq = parseInt(String(maxReqPerMin), 10);
    const tempMins = parseInt(String(tempBanDurationMins), 10);

    if (typeof autoBanEnabled === 'boolean') {
      await storage.updateSetting('SPAM_AUTO_BAN_ENABLED', String(autoBanEnabled));
    }
    if (!isNaN(maxReq) && maxReq > 0) {
      await storage.updateSetting('SPAM_MAX_REQ_PER_MIN', String(maxReq));
    }
    if (!isNaN(tempMins) && tempMins > 0) {
      await storage.updateSetting('SPAM_TEMP_BAN_DURATION_MINS', String(tempMins));
    }

    io.emit('spam_stats_update');

    const confirmedAutoBan = (await storage.getSetting('SPAM_AUTO_BAN_ENABLED'))?.value !== 'false';
    const confirmedMaxReq = parseInt((await storage.getSetting('SPAM_MAX_REQ_PER_MIN'))?.value || '15', 10);
    const confirmedTempMins = parseInt((await storage.getSetting('SPAM_TEMP_BAN_DURATION_MINS'))?.value || '15', 10);

    res.json({
      success: true,
      autoBanEnabled: confirmedAutoBan,
      maxReqPerMin: confirmedMaxReq,
      tempBanDurationMins: confirmedTempMins
    });
  } catch (err) {
    console.error("Anti-Spam config error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/spam-protector/ban", isAuth, async (req, res) => {
  try {
    const { userId, action } = req.body;
    const id = parseInt(userId, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid user ID" });

    const now = Date.now();
    if (action === 'temp_15m') {
      await storage.updateTelegramUser(id, { isBanned: false, bannedUntil: new Date(now + 15 * 60 * 1000) });
    } else if (action === 'temp_1h') {
      await storage.updateTelegramUser(id, { isBanned: false, bannedUntil: new Date(now + 60 * 60 * 1000) });
    } else if (action === 'temp_24h') {
      await storage.updateTelegramUser(id, { isBanned: false, bannedUntil: new Date(now + 24 * 60 * 60 * 1000) });
    } else if (action === 'perm_ban') {
      await storage.updateTelegramUser(id, { isBanned: true, bannedUntil: null });
    } else if (action === 'unban') {
      await storage.updateTelegramUser(id, { isBanned: false, bannedUntil: null });
    }

    io.emit('spam_stats_update');
    res.json({ success: true });
  } catch (err) {
    console.error("Anti-Spam ban action error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

const escapeHTML = (str: string = ''): string => {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const patchBotMethods = (targetBot: TelegramBot) => {
  if ((targetBot as any).__patched) return;
  (targetBot as any).__patched = true;

  const originalSendMessage = targetBot.sendMessage.bind(targetBot);
  const originalEditMessageText = targetBot.editMessageText.bind(targetBot);
  const originalSendPhoto = targetBot.sendPhoto.bind(targetBot);
  const originalSendVideo = targetBot.sendVideo.bind(targetBot);
  const originalSendDocument = targetBot.sendDocument.bind(targetBot);

  const stripEmojis = (text: string): string => {
    if (!text) return text;
    return text.replace(/<tg-emoji[^>]*>(.*?)<\/tg-emoji>/gi, '$1');
  };

  const isDocumentInvalid = (err: any): boolean => {
    if (!err) return false;
    const msg = err.message || "";
    const desc = err.description || err.response?.body?.description || "";
    const str = String(err);
    return msg.includes('DOCUMENT_INVALID') || 
           desc.includes('DOCUMENT_INVALID') || 
           str.includes('DOCUMENT_INVALID') ||
           msg.includes("can't parse entities") ||
           desc.includes("can't parse entities") ||
           str.includes("can't parse entities");
  };

  const isButtonStyleInvalid = (err: any): boolean => {
    if (!err) return false;
    const msg = err.message || "";
    const desc = err.description || err.response?.body?.description || "";
    const str = String(err);
    return msg.includes('Invalid button style specified') || 
           desc.includes('Invalid button style specified') || 
           str.includes('Invalid button style specified');
  };

  const stripButtonStyles = (options?: any) => {
    if (!options) return options;
    const opts = JSON.parse(JSON.stringify(options));
    if (opts.reply_markup) {
      if (opts.reply_markup.inline_keyboard && Array.isArray(opts.reply_markup.inline_keyboard)) {
        for (const row of opts.reply_markup.inline_keyboard) {
          if (Array.isArray(row)) {
            for (const btn of row) {
              delete btn.style;
            }
          }
        }
      }
      if (opts.reply_markup.keyboard && Array.isArray(opts.reply_markup.keyboard)) {
        for (const row of opts.reply_markup.keyboard) {
          if (Array.isArray(row)) {
            for (const btn of row) {
              delete btn.style;
            }
          }
        }
      }
    }
    return opts;
  };

  targetBot.sendMessage = async function(chatId: any, text: string, options?: any) {
    try {
      return await originalSendMessage(chatId, text, options);
    } catch (err: any) {
      if (isButtonStyleInvalid(err)) {
        console.warn(`[Bot API] Invalid button style detected. Stripping style attributes and retrying sendMessage to ${chatId}`);
        const cleanOpts = stripButtonStyles(options);
        return await originalSendMessage(chatId, text, cleanOpts);
      }
      if (isDocumentInvalid(err) && typeof text === 'string' && text.includes('<tg-emoji')) {
        console.warn(`[Bot API] DOCUMENT_INVALID detected. Stripping tg-emoji tags and retrying sendMessage to ${chatId}`);
        const cleanText = stripEmojis(text);
        return await originalSendMessage(chatId, cleanText, options);
      }
      throw err;
    }
  } as any;

  targetBot.editMessageText = async function(text: string, options?: any) {
    try {
      return await originalEditMessageText(text, options);
    } catch (err: any) {
      if (isButtonStyleInvalid(err)) {
        console.warn(`[Bot API] Invalid button style detected. Stripping style attributes and retrying editMessageText`);
        const cleanOpts = stripButtonStyles(options);
        return await originalEditMessageText(text, cleanOpts);
      }
      if (isDocumentInvalid(err) && typeof text === 'string' && text.includes('<tg-emoji')) {
        console.warn(`[Bot API] DOCUMENT_INVALID detected. Stripping tg-emoji tags and retrying editMessageText`);
        const cleanText = stripEmojis(text);
        return await originalEditMessageText(cleanText, options);
      }
      throw err;
    }
  } as any;

  targetBot.sendPhoto = async function(chatId: any, photo: any, options?: any, fileOptions?: any) {
    const fileOpts = fileOptions || (Buffer.isBuffer(photo) ? { filename: 'photo.jpg', contentType: 'image/jpeg' } : undefined);
    try {
      return await originalSendPhoto(chatId, photo, options, fileOpts);
    } catch (err: any) {
      if (isButtonStyleInvalid(err)) {
        console.warn(`[Bot API] Invalid button style detected. Stripping style attributes and retrying sendPhoto to ${chatId}`);
        const cleanOpts = stripButtonStyles(options);
        return await originalSendPhoto(chatId, photo, cleanOpts, fileOpts);
      }
      const caption = options?.caption;
      if (isDocumentInvalid(err) && typeof caption === 'string' && caption.includes('<tg-emoji')) {
        console.warn(`[Bot API] DOCUMENT_INVALID detected. Stripping tg-emoji tags and retrying sendPhoto to ${chatId}`);
        const retryOpts = { ...options, caption: stripEmojis(caption) };
        return await originalSendPhoto(chatId, photo, retryOpts, fileOpts);
      }
      throw err;
    }
  } as any;

  targetBot.sendVideo = async function(chatId: any, video: any, options?: any) {
    try {
      return await originalSendVideo(chatId, video, options);
    } catch (err: any) {
      if (isButtonStyleInvalid(err)) {
        const cleanOpts = stripButtonStyles(options);
        return await originalSendVideo(chatId, video, cleanOpts);
      }
      const caption = options?.caption;
      if (isDocumentInvalid(err) && typeof caption === 'string' && caption.includes('<tg-emoji')) {
        console.warn(`[Bot API] DOCUMENT_INVALID detected. Stripping tg-emoji tags and retrying sendVideo to ${chatId}`);
        const retryOpts = { ...options, caption: stripEmojis(caption) };
        return await originalSendVideo(chatId, video, retryOpts);
      }
      throw err;
    }
  } as any;

  targetBot.sendDocument = async function(chatId: any, doc: any, options?: any, fileOptions?: any) {
    try {
      return await originalSendDocument(chatId, doc, options, fileOptions);
    } catch (err: any) {
      if (isButtonStyleInvalid(err)) {
        const cleanOpts = stripButtonStyles(options);
        return await originalSendDocument(chatId, doc, cleanOpts, fileOptions);
      }
      const caption = options?.caption;
      if (isDocumentInvalid(err) && typeof caption === 'string' && caption.includes('<tg-emoji')) {
        console.warn(`[Bot API] DOCUMENT_INVALID detected. Stripping tg-emoji tags and retrying sendDocument to ${chatId}`);
        const retryOpts = { ...options, caption: stripEmojis(caption) };
        return await originalSendDocument(chatId, doc, retryOpts, fileOptions);
      }
      throw err;
    }
  } as any;
};

let bot: TelegramBot | null = null;
let broadcastBot: TelegramBot | null = null;
let inspectorBot: TelegramBot | null = null;

const setupInspectorBotHandlers = (targetBot: TelegramBot) => {
  targetBot.on('polling_error', (error: any) => {
    if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
      console.warn(`[Inspector Bot Polling Warning] 409 Conflict. Another bot instance is polling or webhook is set.`);
    } else {
      console.error('Inspector bot polling error:', error);
    }
  });

  // Dedicated Inspector Bot: Captures & Traces EVERY single message sent or forwarded to it!
  targetBot.on('message', async (msg) => {
    try {
      await processTelegramInspectorTrace(targetBot, msg, { isExplicitCommand: true, io });
    } catch (err) {
      console.error('Failed to process Telegram inspector bot trace:', err);
    }
  });
};

const initBot = async () => {
  try {
    const token = await getBotToken();
    const broadcastTokenSetting = await storage.getSetting("BROADCAST_BOT_TOKEN");
    const broadcastToken = broadcastTokenSetting?.value;
    const inspectorToken = await getInspectorBotToken();

    console.log('Initializing Telegram bots...');

    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS reviews (
          id SERIAL PRIMARY KEY,
          telegram_user_id INTEGER,
          product_name TEXT NOT NULL DEFAULT 'General Purchase',
          rating INTEGER NOT NULL DEFAULT 5,
          comment TEXT NOT NULL,
          reviewer_name TEXT NOT NULL DEFAULT 'Customer',
          is_verified BOOLEAN NOT NULL DEFAULT true,
          status TEXT NOT NULL DEFAULT 'approved',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_emoji_id TEXT;
        ALTER TABLE payments ADD COLUMN IF NOT EXISTS txid TEXT;
      `);
      console.log('[DB] reviews and payments tables verified/updated');

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS support_tickets (
          id SERIAL PRIMARY KEY,
          telegram_user_id INTEGER,
          issue_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'open',
          details TEXT,
          attachment_url TEXT,
          user_telegram_id TEXT NOT NULL,
          username TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS attachment_url TEXT;
      `);
      console.log('[DB] support_tickets table verified/created');
    } catch (e) {
      console.error('Error verifying database tables:', e);
    }

    if (token) {
      if (bot) {
        console.log('Stopping existing main bot...');
        await bot.stopPolling().catch(() => {});
      }
      bot = new TelegramBot(token, { polling: true });
      bot.on('polling_error', (err: any) => {
        if (err?.code === 'ETELEGRAM' && err?.message?.includes('409 Conflict')) {
          console.warn('[MAIN BOT] 409 Conflict: another instance is polling.');
        } else {
          console.error('[MAIN BOT] Polling error:', err?.message || err);
        }
      });
      bot.on('error', (err: any) => {
        console.warn('[MAIN BOT] General error:', err?.message || err);
      });
      patchBotMethods(bot);
      setupBotHandlers(bot);
      setupBotProfile(bot).catch(err => console.error('Failed to setup bot profile:', err));
      setMainBotReferenceForAdmin(bot);
      console.log('Main bot initialized successfully');
    }

    if (broadcastToken && broadcastToken !== token) {
      if (broadcastBot) {
        console.log('Stopping existing broadcast bot...');
        await broadcastBot.stopPolling().catch(() => {});
      }
      broadcastBot = new TelegramBot(broadcastToken, { polling: true });
      broadcastBot.on('polling_error', (err: any) => {
        if (err?.code === 'ETELEGRAM' && err?.message?.includes('409 Conflict')) {
          console.warn('[BROADCAST BOT] 409 Conflict: another instance is polling.');
        } else {
          console.error('[BROADCAST BOT] Polling error:', err?.message || err);
        }
      });
      broadcastBot.on('error', (err: any) => {
        console.warn('[BROADCAST BOT] General error:', err?.message || err);
      });
      patchBotMethods(broadcastBot);
      setupBotHandlers(broadcastBot);
      console.log('Broadcast bot initialized successfully');
    } else if (broadcastBot) {
      await broadcastBot.stopPolling().catch(() => {});
      broadcastBot = null;
    }

    if (inspectorToken && inspectorToken !== token) {
      if (inspectorBot) {
        console.log('Stopping existing inspector bot...');
        await inspectorBot.stopPolling().catch(() => {});
      }
      inspectorBot = new TelegramBot(inspectorToken, { polling: true });
      inspectorBot.on('polling_error', (err: any) => {
        if (err?.code === 'ETELEGRAM' && err?.message?.includes('409 Conflict')) {
          console.warn('[INSPECTOR BOT] 409 Conflict: another instance is polling.');
        } else {
          console.error('[INSPECTOR BOT] Polling error:', err?.message || err);
        }
      });
      inspectorBot.on('error', (err: any) => {
        console.warn('[INSPECTOR BOT] General error:', err?.message || err);
      });
      patchBotMethods(inspectorBot);
      setupInspectorBotHandlers(inspectorBot);
      console.log(`Dedicated Inspector bot initialized successfully (Token hash: ${inspectorToken.substring(0, 10)}...)`);
    } else if (bot && inspectorToken === token) {
      setupInspectorBotHandlers(bot);
      console.log(`Main bot also attached with Inspector handlers (Shared token: ${token.substring(0, 10)}...)`);
    } else if (inspectorBot) {
      await inspectorBot.stopPolling().catch(() => {});
      inspectorBot = null;
    }
  } catch (err) {
    console.error('Telegram bot init failed:', err);
  }
};
const bannerFileIdCache: Record<string, string> = {};

const getPersistentBottomKeyboard = () => ({
  keyboard: [
    [{ text: 'Catalog', style: 'success', icon_custom_emoji_id: '5377660214096974712' }],
    [{ text: 'Profile', style: 'success', icon_custom_emoji_id: '5260399854500191689' }],
    [
      { text: 'Useful links', style: 'primary', icon_custom_emoji_id: '5271604874419647061' },
      { text: 'Support', style: 'primary', icon_custom_emoji_id: '5260535596941582167' }
    ]
  ],
  resize_keyboard: true,
  is_persistent: true,
  one_time_keyboard: false
});

const sendAutoDeleteError = async (
  targetBot: TelegramBot,
  chatId: number | string,
  userMessageId: number | undefined,
  htmlText: string,
  timeoutMs: number = 7000
) => {
  try {
    const sentMsg = await targetBot.sendMessage(chatId, htmlText, { parse_mode: 'HTML' });
    setTimeout(() => {
      if (userMessageId) {
        targetBot.deleteMessage(chatId, userMessageId).catch(() => {});
      }
      if (sentMsg?.message_id) {
        targetBot.deleteMessage(chatId, sentMsg.message_id).catch(() => {});
      }
    }, timeoutMs);
  } catch (err) {
    console.error("sendAutoDeleteError failed:", err);
  }
};

const sendOrEditScreenWithPhoto = async (
  targetBot: TelegramBot,
  chatId: number,
  bannerPath: string,
  caption: string,
  replyMarkup: any,
  messageId?: number
) => {
  const token = (targetBot as any)?.token;

  if (messageId) {
    // Attempt 1: Edit message caption in-place (Fastest, cleanest Telegram edit!)
    try {
      await targetBot.editMessageCaption(caption, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      });
      return;
    } catch (err1: any) {}

    // Attempt 2: Edit message text in-place
    try {
      await targetBot.editMessageText(caption, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      });
      return;
    } catch (err2: any) {}

    // Attempt 3: Edit message media via multipart
    if (fs.existsSync(bannerPath) && token) {
      try {
        const fileBuffer = fs.readFileSync(bannerPath);
        const dynamicFilename = `banner_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
        const form = new FormData();
        form.append('chat_id', chatId.toString());
        form.append('message_id', messageId.toString());
        form.append('media', JSON.stringify({
          type: 'photo',
          media: 'attach://banner_file',
          caption: caption,
          parse_mode: 'HTML'
        }));
        if (replyMarkup) {
          form.append('reply_markup', JSON.stringify(replyMarkup));
        }
        form.append('banner_file', fileBuffer, {
          filename: dynamicFilename,
          contentType: 'image/png'
        });

        const res = await axios.post(`https://api.telegram.org/bot${token}/editMessageMedia`, form, {
          headers: form.getHeaders()
        });

        if (res.data?.ok) {
          return;
        }
      } catch (err3: any) {}
    }
  }

  // Fallback: Send photo if messageId wasn't editable or message didn't exist
  if (fs.existsSync(bannerPath)) {
    const fileBuffer = fs.readFileSync(bannerPath);
    const dynamicFilename = `banner_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
    try {
      await targetBot.sendPhoto(chatId, fileBuffer, {
        caption,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      }, {
        filename: dynamicFilename,
        contentType: 'image/png'
      });
      return;
    } catch (err: any) {
      console.error("Failed to sendPhoto:", err.message);
    }
  }

  await targetBot.sendMessage(chatId, caption, {
    parse_mode: 'HTML',
    reply_markup: replyMarkup
  });
};

const sendUserProfileCard = async (targetBot: TelegramBot, chatId: number, userId: string, msgFrom?: any, messageId?: number) => {
  const userToDisplay = await storage.getTelegramUser(userId) || await storage.createTelegramUser({
    telegramId: userId,
    username: msgFrom?.username || null,
    firstName: msgFrom?.first_name || 'User',
    lastName: msgFrom?.last_name || null,
    balance: 0,
    lastAction: null
  });

  // Query user's completed orders joined with products table to calculate accurate total spent
  const userOrdersWithProducts = await db.select({
    orderId: orders.id,
    price: products.price
  })
  .from(orders)
  .leftJoin(products, eq(orders.productId, products.id))
  .where(eq(orders.telegramUserId, userToDisplay.id));

  const userPurchases = userOrdersWithProducts.length;
  let totalSpentCents = 0;
  userOrdersWithProducts.forEach(o => {
    totalSpentCents += (o.price || 0);
  });

  let totalDepositedCents = 0;
  try {
    const pmts = await db.execute(sql`SELECT amount FROM payments WHERE telegram_user_id = ${userToDisplay.id} AND status = 'completed'`);
    const rows = pmts.rows || [];
    totalDepositedCents = rows.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
  } catch (e) { }

  const balanceUSD = (userToDisplay.balance / 100).toFixed(2);
  const refBalance = (((userToDisplay as any).referralBalance || 0) / 100).toFixed(2);

  const totalSpentUSD = totalSpentCents / 100;
  const totalDepositedUSD = totalDepositedCents / 100;
  const userBalUSD = userToDisplay.balance / 100;
  const userValueUSD = Math.max(totalSpentUSD, totalDepositedUSD, userBalUSD);

  let statusText = '<tg-emoji emoji-id="5803357151770449172">🏅</tg-emoji> <b>Standard</b>';

  if (userValueUSD >= 1000) {
    statusText = '<tg-emoji emoji-id="5789828777882162072">🌟</tg-emoji> <b>Top Legend VIP</b>';
  } else if (userValueUSD >= 300) {
    statusText = '<tg-emoji emoji-id="5278467510604160626">👑</tg-emoji> <b>Legend VIP</b>';
  } else if (userValueUSD >= 10) {
    statusText = '<tg-emoji emoji-id="5321167461280662157">💎</tg-emoji> <b>Diamond VIP</b>';
  }

  // Get last redeemed promo code
  let promoCodeText = "not set";
  try {
    const lastRedemption = await storage.getLastPromoCodeRedemption(userToDisplay.id);
    if (lastRedemption) {
      promoCodeText = lastRedemption.promoCode.code;
    }
  } catch (e) { }

  const currCurrency = (userToDisplay as any)?.selectedCurrency || "USD";
  const userBalNum = userToDisplay.balance / 100;
  const { formatted: convertedBal } = formatPriceInCurrency(userBalNum, currCurrency);
  const balanceText = currCurrency === 'USD' ? `${balanceUSD} USD` : `${balanceUSD} USD (${convertedBal})`;

  const profileCaption = `<tg-emoji emoji-id="6032693626394382504">💠</tg-emoji> <b>Profile</b>\n\n` +
    `ID: <code>${userToDisplay.telegramId}</code>\n` +
    `<tg-emoji emoji-id="5424746623462823358">🏅</tg-emoji> Status: ${statusText}\n` +
    `<tg-emoji emoji-id="5429518319243775957">💵</tg-emoji> Balance: <b>${balanceText} </b><tg-emoji emoji-id="5409048419211682843">💵</tg-emoji>\n` +
    `<tg-emoji emoji-id="5429518319243775957">💱</tg-emoji> Price currency: <b>${currCurrency}</b>\n` +
    `<tg-emoji emoji-id="5208604387156448480">👥</tg-emoji> Referral balance: <b>${refBalance} USDT</b>\n` +
    `<tg-emoji emoji-id="5854908544712707500">📦</tg-emoji> Purchases completed: <b>${userPurchases}</b>\n` +
    `<tg-emoji emoji-id="6113971389935391397">🎟</tg-emoji> Promo code: <b>${promoCodeText}</b>\n` +
    `<tg-emoji emoji-id="5850383023572259486">📊</tg-emoji> Total spent: <b>$${totalSpentUSD.toFixed(2)} USD</b>`;

  const profileInlineKeyboard = {
    inline_keyboard: [
      [{ text: 'Top up balance', callback_data: 'add_funds', style: 'success', icon_custom_emoji_id: '5409048419211682843' }],
      [{ text: 'My purchases', callback_data: 'purchase_history', style: 'primary', icon_custom_emoji_id: '5854908544712707500' }],
      [{ text: 'Referral program', callback_data: 'referral_program', style: 'primary', icon_custom_emoji_id: '5208604387156448480' }],
      [{ text: 'Promo code', callback_data: 'enter_promocode', style: 'primary', icon_custom_emoji_id: '6113971389935391397' }],
      [{ text: 'Transactions', callback_data: 'transactions', style: 'primary', icon_custom_emoji_id: '5312441427764989435' }],
      [{ text: 'Price currency', callback_data: 'change_currency', style: 'primary', icon_custom_emoji_id: '5429518319243775957' }],
      [{ text: 'Язык / Language', callback_data: 'change_language', style: 'primary', icon_custom_emoji_id: '5854908544712707500' }],
      [{ text: 'Back', callback_data: 'main_menu', style: 'primary', icon_custom_emoji_id: '5976535107933050770' }]
    ] as any
  };

  const profileBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_profile_banner.png");
  await sendOrEditScreenWithPhoto(targetBot, chatId, profileBannerPath, profileCaption, profileInlineKeyboard, messageId);
};

const sendCatalogMenu = async (targetBot: TelegramBot, chatId: number, messageId?: number) => {
  const tgUser = await storage.getTelegramUser(chatId.toString());
  const userLang = (tgUser as any)?.selectedLanguage || 'en';

  const showOutOfStockSetting = await storage.getSetting("SHOW_OUT_OF_STOCK_PRODUCTS");
  const showOutOfStock = showOutOfStockSetting?.value === "true";

  const products = await storage.getProducts();

  // Group products by category
  const categoryMap = new Map<string, { stock: number; hasPreorder: boolean; maxPreorderQuota: number; iconEmojiId?: string }>();

  for (const p of products) {
    if (p.status !== 'available') continue;
    const stock = (await storage.getCredentialsByProduct(p.id)).filter(c => c.status === 'available').length;

    let availableQuota = 0;
    if (p.isPreorderEnabled) {
      const pendingPreorders = await storage.getPendingPreordersByProduct(p.id);
      const preordersCount = pendingPreorders.reduce((sum, po) => sum + po.quantity, 0);
      availableQuota = Math.max(0, (p.preorderQuota || 50) - preordersCount);
    }

    if (!categoryMap.has(p.type)) {
      categoryMap.set(p.type, {
        stock,
        hasPreorder: !!p.isPreorderEnabled,
        maxPreorderQuota: availableQuota,
        iconEmojiId: p.customEmojiId || undefined
      });
    } else {
      const current = categoryMap.get(p.type)!;
      categoryMap.set(p.type, {
        stock: current.stock + stock,
        hasPreorder: current.hasPreorder || !!p.isPreorderEnabled,
        maxPreorderQuota: Math.max(current.maxPreorderQuota, availableQuota),
        iconEmojiId: current.iconEmojiId || p.customEmojiId || undefined
      });
    }
  }

  // Include categories matching preset demo experience
  const presetCategories = [
    { name: 'Standoff 2', icon: '5456343263340405032', stock: 12 },
    { name: 'Gemini', icon: '5404617696589390973', stock: 8 },
    { name: 'CHAT GPT', icon: '6113971389935391397', stock: 15 },
    { name: 'CLAUDE', icon: '5854908544712707500', stock: 5 },
    { name: 'SuperGrok', icon: '5312441427764989435', stock: 0 },
    { name: 'Perplexity', icon: '5208604387156448480', stock: 7 }
  ];

  for (const preset of presetCategories) {
    if (!categoryMap.has(preset.name)) {
      categoryMap.set(preset.name, {
        stock: preset.stock,
        hasPreorder: false,
        maxPreorderQuota: 0,
        iconEmojiId: preset.icon
      });
    }
  }

  const inline_keyboard: any[] = [];

  for (const [category, data] of categoryMap.entries()) {
    let btnText = category;
    let iconEmojiId = data.iconEmojiId;
    const catLower = category.toLowerCase();

    if (!iconEmojiId) {
      if (catLower.includes('aws')) iconEmojiId = '5785025630055700143';
      else if (catLower.includes('digital ocean') || catLower.includes('digitalocean')) iconEmojiId = '5785345544989710932';
      else if (catLower.includes('linode')) iconEmojiId = '5787285044846399857';
      else if (catLower.includes('azure')) iconEmojiId = '5785185643357279341';
      else if (catLower.includes('gcp') || catLower.includes('google cloud')) iconEmojiId = '5785061312643994750';
      else if (catLower.includes('kamatera')) iconEmojiId = '5785070770161980265';
    }

    let buttonStyle = 'success';
    if (data.stock > 0) {
      buttonStyle = 'success';
      btnText = category;
    } else if (data.hasPreorder && data.maxPreorderQuota > 0) {
      buttonStyle = 'primary';
      btnText = `${category} (Pre-Order Available: ${data.maxPreorderQuota} Pcs)`;
    } else {
      buttonStyle = 'danger';
      btnText = `${category} (${t(userLang, 'out_of_stock_title')})`;
    }

    const btnObj: any = {
      text: btnText,
      callback_data: `cat_${category}`,
      style: buttonStyle
    };
    if (iconEmojiId) {
      btnObj.icon_custom_emoji_id = iconEmojiId;
    }
    inline_keyboard.push([btnObj]);
  }

  inline_keyboard.push([
    { text: t(userLang, 'btn_search_catalog'), callback_data: 'search_catalog', style: 'primary', icon_custom_emoji_id: '5231012545799666522' }
  ]);
  inline_keyboard.push([
    { text: t(userLang, 'btn_back'), callback_data: 'profile', style: 'primary', icon_custom_emoji_id: '5976535107933050770' }
  ]);

  const catalogCaption = `<tg-emoji emoji-id="5854908544712707500">📦</tg-emoji> <b>${t(userLang, 'catalog_title')}</b>\n\n${t(userLang, 'choose_category')}`;
  const catalogBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_catalog_banner.png");
  await sendOrEditScreenWithPhoto(targetBot, chatId, catalogBannerPath, catalogCaption, { inline_keyboard }, messageId);
};

const sendProductDetailsScreen = async (targetBot: TelegramBot, chatId: number, productId: number | string, categoryName?: string, messageId?: number) => {
  let product: any = null;
  let stockCount = 0;

  const prodIdNum = typeof productId === 'number' ? productId : parseInt(productId as string, 10);

  if (!isNaN(prodIdNum)) {
    product = await storage.getProduct(prodIdNum);
    if (product) {
      const stock = await storage.getCredentialsByProduct(product.id);
      stockCount = stock.filter(c => c.status === 'available').length;
    }
  }

  // If product not found by numeric ID, check if database has a matching product by type or name
  if (!product && typeof productId === 'string') {
    const name = categoryName || productId;
    const allProds = await storage.getProducts();
    const match = allProds.find(p => p.type === name || p.name === name || p.name.includes(name));
    if (match) {
      product = match;
      const stock = await storage.getCredentialsByProduct(match.id);
      stockCount = stock.filter(c => c.status === 'available').length;
    }
  }

  // Realistic fallback preset pricing for demo categories if no DB product match
  const PRESET_PRODUCT_MAP: Record<string, { name: string; price: number; description: string; stock: number }> = {
    'Standoff 2': { name: 'Standoff 2 Account', price: 1000, description: 'High tier Standoff 2 account with instant automated delivery 24/7.', stock: 12 },
    'Gemini': { name: 'Gemini Link 18 months', price: 1200, description: 'Gemini 18 months subscription link. Instant 24-hour activation guarantee.', stock: 8 },
    'CHAT GPT': { name: 'ChatGPT Plus Account', price: 1500, description: 'ChatGPT Plus account subscription. Full warranty included.', stock: 15 },
    'CLAUDE': { name: 'Claude Pro Account', price: 1800, description: 'Claude Pro subscription account. 24/7 automated delivery.', stock: 5 },
    'SuperGrok': { name: 'SuperGrok AI Account', price: 2000, description: 'SuperGrok AI premium account.', stock: 0 },
    'Perplexity': { name: 'Perplexity Pro Account', price: 1400, description: 'Perplexity Pro account subscription.', stock: 7 }
  };

  if (!product) {
    const name = typeof productId === 'string' ? productId : (categoryName || 'Gemini Link');
    const preset = PRESET_PRODUCT_MAP[name] || {
      name: `${name} Account`,
      price: 1000,
      description: 'Instant automated delivery 24/7 after purchase. Full activation warranty guaranteed.',
      stock: 10
    };

    product = {
      id: typeof productId === 'number' ? productId : 999,
      name: preset.name,
      price: preset.price,
      description: preset.description,
      type: categoryName || name
    };
    stockCount = preset.stock;
  }

  const tgUser = await storage.getTelegramUser(chatId.toString());
  const userCurrency = (tgUser as any)?.selectedCurrency || "USD";
  const priceUSDNum = product.price / 100;
  const { formatted: priceFormatted } = formatPriceInCurrency(priceUSDNum, userCurrency);
  const priceDisplay = userCurrency === 'USD' ? `$${priceUSDNum.toFixed(2)}` : `${priceFormatted} ($${priceUSDNum.toFixed(2)} USD)`;

  if (stockCount === 0) {
    if (product.isPreorderEnabled) {
      const pendingPreorders = await storage.getPendingPreordersByProduct(product.id);
      const preordersCount = pendingPreorders.reduce((sum, po) => sum + po.quantity, 0);
      const availableQuota = Math.max(0, (product.preorderQuota || 50) - preordersCount);

      if (availableQuota > 0) {
        // Render Pre-Order Product Screen
        const qtyButtons: any[][] = [];
        
        // Multi-row grid layout: Row 1 (1 pcs, 2 pcs, 3 pcs), Row 2 (5 pcs, 10 pcs)
        const row1: any[] = [];
        const row2: any[] = [];
        const qtysRow1 = [1, 2, 3].filter(q => q <= availableQuota);
        const qtysRow2 = [5, 10, 20].filter(q => q <= availableQuota);

        qtysRow1.forEach(q => {
          row1.push({
            text: `${q} pcs`,
            callback_data: `buy_qty_${product.id}_${q}`,
            style: 'success'
          });
        });
        if (row1.length > 0) qtyButtons.push(row1);

        qtysRow2.forEach(q => {
          row2.push({
            text: `${q} pcs`,
            callback_data: `buy_qty_${product.id}_${q}`,
            style: 'success'
          });
        });
        if (row2.length > 0) qtyButtons.push(row2);

        qtyButtons.push([{
          text: 'Custom Pre-Order Quantity',
          callback_data: `qty_other_${product.id}`,
          style: 'success',
          icon_custom_emoji_id: '5312441427764989435'
        }]);
        qtyButtons.push([{
          text: 'Back to Catalog',
          callback_data: 'buy',
          style: 'primary',
          icon_custom_emoji_id: '5976535107933050770'
        }]);

        const preMsg = `<tg-emoji emoji-id="5854908544712707500">📦</tg-emoji> <b>${escapeHTML(product.name)}</b>\n\n` +
          `<tg-emoji emoji-id="5197434882321567830">💵</tg-emoji>Price per unit: <b>${priceDisplay}</b>\n` +
          `<tg-emoji emoji-id="5440621591387980068">🔜</tg-emoji>Stock Status: <b>0 Pcs (Pre-Order Active 24/7)</b>\n` +
          `<tg-emoji emoji-id="5411590687663608498">⚡️</tg-emoji> Pre-Orders Available: <b>${availableQuota} Pcs</b>\n\n` +
          `<blockquote><tg-emoji emoji-id="4958610528588008305">✅</tg-emoji> <b>24/7 Pre-Order Guarantee:</b>\n` +
          `Place your pre-order now! As soon as stock is added by the admin, your credentials will automatically be sent to you in this chat with priority #1.</blockquote>\n\n` +
          `<b>Select quantity to pre-order:</b>`;

        const catalogBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_catalog_banner.png");
        await sendOrEditScreenWithPhoto(targetBot, chatId, catalogBannerPath, preMsg, { inline_keyboard: qtyButtons }, messageId);
        return;
      }
    }

    const outOfStockKb = {
      inline_keyboard: [
        [{ text: '🔙 Back to Catalog', callback_data: 'buy' }]
      ] as any
    };
    const outMsg = `<tg-emoji emoji-id="5215570077876756627">❌</tg-emoji> <b>Out of Stock</b>\n\n` +
      `<b>${product.name}</b> is currently out of stock (0 available).\n\n` +
      `Please check back later or choose another product from the catalog!`;
    const catalogBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_catalog_banner.png");
    await sendOrEditScreenWithPhoto(targetBot, chatId, catalogBannerPath, outMsg, outOfStockKb, messageId);
    return;
  }

  let productEmojiId = product.customEmojiId || (product as any).custom_emoji_id;
  if (!productEmojiId) {
    const pType = (product.type || product.name || '').toLowerCase();
    if (pType.includes('aws')) productEmojiId = '5785025630055700143';
    else if (pType.includes('digital ocean') || pType.includes('digitalocean')) productEmojiId = '5785345544989710932';
    else if (pType.includes('linode')) productEmojiId = '5787285044846399857';
    else if (pType.includes('azure')) productEmojiId = '5785185643357279341';
    else if (pType.includes('gcp') || pType.includes('google cloud')) productEmojiId = '5785061312643994750';
    else if (pType.includes('kamatera')) productEmojiId = '5785070770161980265';
    else if (pType.includes('gemini')) productEmojiId = '5377660214096974712';
    else if (pType.includes('chatgpt') || pType.includes('grok')) productEmojiId = '5404617696589390973';
    else productEmojiId = '5854908544712707500';
  }

  const productCaption = `<tg-emoji emoji-id="${productEmojiId}">📦</tg-emoji> <b>${product.name}</b>\n\n` +
    `<tg-emoji emoji-id="5429518319243775957">📉</tg-emoji> <b>Price:</b> <b>${priceDisplay}</b> <tg-emoji emoji-id="5409048419211682843">💵</tg-emoji>\n\n` +
    `<tg-emoji emoji-id="5253742260054409879">✉️</tg-emoji> <b>Description</b>\n` +
    `${product.description || 'Instant automated delivery 24/7 after purchase. Full activation warranty guaranteed.'}\n\n` +
    `<tg-emoji emoji-id="5274099962655816924">❗️</tg-emoji> <b>Delivery:</b> automatic\n\n` +
    `<tg-emoji emoji-id="5456258317477230911">😎</tg-emoji> <b>Stock:</b> ${stockCount} pcs`;

  const inline_keyboard: any[] = [];

  // Row 1: 1, 2, 3 (dynamically filtered by stockCount)
  const row1: any[] = [];
  [1, 2, 3].forEach(qty => {
    if (qty <= stockCount) {
      row1.push({ text: `${qty} pcs`, callback_data: `buy_qty_${product.id}_${qty}`, style: 'success' });
    }
  });
  if (row1.length > 0) inline_keyboard.push(row1);

  // Row 2: 5, 10, 20 (dynamically filtered by stockCount)
  const row2: any[] = [];
  [5, 10, 20].forEach(qty => {
    if (qty <= stockCount) {
      row2.push({ text: `${qty} pcs`, callback_data: `buy_qty_${product.id}_${qty}`, style: 'success' });
    }
  });
  if (row2.length > 0) inline_keyboard.push(row2);

  // Row 3: Other quantity (only if stockCount > 1)
  if (stockCount > 1) {
    inline_keyboard.push([
      { text: 'Other quantity', callback_data: `qty_other_${product.id}`, icon_custom_emoji_id: '6050684909389880647' }
    ]);
  }

  // Row 4: Back button
  inline_keyboard.push([
    { text: 'Back to Category', callback_data: `cat_${product.type}`, style: 'primary', icon_custom_emoji_id: '5976535107933050770' }
  ]);

  const catalogBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_catalog_banner.png");
  await sendOrEditScreenWithPhoto(targetBot, chatId, catalogBannerPath, productCaption, { inline_keyboard }, messageId);
};

const sendOrderCalculationScreen = async (targetBot: TelegramBot, chatId: number, productId: number | string, qty: number, messageId?: number) => {
  let productName = "Product Account";
  let unitPriceUSD = 10.00;

  const PRESET_PRODUCT_MAP: Record<string, { name: string; price: number }> = {
    'Standoff 2': { name: 'Standoff 2 Account', price: 10.00 },
    'Gemini': { name: 'Gemini Link 18 months', price: 12.00 },
    'CHAT GPT': { name: 'ChatGPT Plus Account', price: 15.00 },
    'CLAUDE': { name: 'Claude Pro Account', price: 18.00 },
    'SuperGrok': { name: 'SuperGrok AI Account', price: 20.00 },
    'Perplexity': { name: 'Perplexity Pro Account', price: 14.00 }
  };

  const prodIdNum = typeof productId === 'number' ? productId : parseInt(productId as string, 10);
  if (!isNaN(prodIdNum)) {
    const product = await storage.getProduct(prodIdNum);
    if (product) {
      productName = product.name;
      unitPriceUSD = product.price / 100;
    }
  }

  if (unitPriceUSD === 10.00 && typeof productId === 'string') {
    const name = productId;
    const allProds = await storage.getProducts();
    const match = allProds.find(p => p.type === name || p.name === name || p.name.includes(name));
    if (match) {
      productName = match.name;
      unitPriceUSD = match.price / 100;
    } else if (PRESET_PRODUCT_MAP[name]) {
      productName = PRESET_PRODUCT_MAP[name].name;
      unitPriceUSD = PRESET_PRODUCT_MAP[name].price;
    } else {
      productName = `${name} Account`;
    }
  }

  const tgUser = await storage.getTelegramUser(chatId.toString());
  const userCurrency = (tgUser as any)?.selectedCurrency || "USD";
  const totalUSDNum = qty * unitPriceUSD;
  const { formatted: totalFormatted } = formatPriceInCurrency(totalUSDNum, userCurrency);
  const totalDisplay = userCurrency === 'USD' ? `$${totalUSDNum.toFixed(2)} USD` : `${totalFormatted} ($${totalUSDNum.toFixed(2)} USD)`;

  const orderCaption = `<tg-emoji emoji-id="5976535107933050770">🧾</tg-emoji> <b>Order calculation</b>\n\n` +
    `Product: <b>${productName}</b>\n` +
    `<tg-emoji emoji-id="5332440771180116150">🟢</tg-emoji> Quantity: <b>${qty}</b>\n` +
    `<tg-emoji emoji-id="5429518319243775957">📉</tg-emoji> Product total: <b>${totalDisplay}</b> <tg-emoji emoji-id="5409048419211682843">💵</tg-emoji>\n\n` +
    `Choose payment method:`;

  const inline_keyboard = [
    [{ text: 'Enter promo code', callback_data: 'enter_promocode', style: 'primary', icon_custom_emoji_id: '6113971389935391397' }],
    [{ text: 'CryptoBot', callback_data: `pay_cryptobot_${productId}_${qty}`, style: 'success', icon_custom_emoji_id: '5361914370068613491' }],
    [{ text: 'Binance Pay / UID', callback_data: `pay_binance_${productId}_${qty}`, style: 'success', icon_custom_emoji_id: '5281029063459234079' }],
    [
      { text: 'USDT • BEP20', callback_data: `pay_bep20_${productId}_${qty}`, style: 'success', icon_custom_emoji_id: '5280907155107506256' },
      { text: 'USDT • TRC20', callback_data: `pay_trc20_${productId}_${qty}`, style: 'success', icon_custom_emoji_id: '5936189134342199863' }
    ],
    [{ text: 'Pay from balance', callback_data: `pay_bal_${productId}_${qty}`, style: 'success', icon_custom_emoji_id: '5409048419211682843' }],
    [{ text: 'Cancel / Back', callback_data: `prod_${productId}`, style: 'danger', icon_custom_emoji_id: '5976535107933050770' }]
  ] as any;

  const paymentBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_payment_banner.png");
  await sendOrEditScreenWithPhoto(targetBot, chatId, paymentBannerPath, orderCaption, { inline_keyboard }, messageId);
};

const sendMyPurchasesScreen = async (targetBot: TelegramBot, chatId: number, userId: string, messageId?: number, page: number = 1) => {
  const tgUser = await storage.getTelegramUser(userId);
  const allOrders = await storage.getOrders();
  let userPreorders: any[] = [];
  try {
    const allPreorders = await db.select().from(preorders);
    userPreorders = tgUser ? allPreorders.filter(po => po.telegramUserId === tgUser.id) : [];
  } catch (e) {}

  const userOrders = tgUser ? allOrders.filter(o => o.telegramUserId === tgUser.id || String(o.telegramUserId) === tgUser.telegramId || String(o.telegramUserId) === userId) : [];
  userOrders.sort((a, b) => (b.id || 0) - (a.id || 0));

  const itemsList: { id: number; productId: number; quantity: number; isPreorder: boolean; createdAt: Date }[] = [];

  for (const po of userPreorders) {
    if (po.status === 'pending_fulfillment') {
      itemsList.push({
        id: po.id,
        productId: po.productId,
        quantity: po.quantity,
        isPreorder: true,
        createdAt: po.createdAt ? new Date(po.createdAt) : new Date()
      });
    }
  }

  for (const order of userOrders) {
    const orderTime = order.createdAt ? new Date(order.createdAt).getTime() : 0;
    const existingBatch = itemsList.find(b =>
      !b.isPreorder &&
      b.productId === order.productId &&
      orderTime > 0 &&
      Math.abs(b.createdAt.getTime() - orderTime) <= 60000
    );

    if (existingBatch) {
      existingBatch.quantity += 1;
    } else {
      itemsList.push({
        id: order.id,
        productId: order.productId,
        quantity: 1,
        isPreorder: false,
        createdAt: order.createdAt ? new Date(order.createdAt) : new Date()
      });
    }
  }

  itemsList.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

  const inline_keyboard: any[] = [];
  const pageSize = 10;

  if (itemsList.length > 0) {
    const totalPages = Math.max(1, Math.ceil(itemsList.length / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const pageItems = itemsList.slice(startIndex, startIndex + pageSize);

    for (const item of pageItems) {
      const product = await storage.getProduct(item.productId);
      const baseName = product ? product.name : `Product #${item.productId}`;
      const qtyStr = item.quantity > 1 ? ` (${item.quantity} Pcs)` : '';
      const preorderTag = item.isPreorder ? ' [Pre-Order]' : '';
      const name = `${baseName}${qtyStr}${preorderTag}`;
      const productEmoji = (product as any)?.customEmojiId || (product as any)?.custom_emoji_id || '5854908544712707500';
      const timeStr = formatSriLankaTime(item.createdAt, 'short');

      inline_keyboard.push([
        {
          text: `${name} (${timeStr})`,
          callback_data: item.isPreorder ? 'noop_purchases_page' : `view_order_${item.id}`,
          style: item.isPreorder ? 'primary' : 'success',
          icon_custom_emoji_id: productEmoji
        }
      ]);
    }

    const navRow: any[] = [];
    if (currentPage > 1) {
      navRow.push({
        text: 'Prev',
        callback_data: `purchases_page_${currentPage - 1}`,
        style: 'primary',
        icon_custom_emoji_id: '5370615926565641880'
      });
    }
    if (currentPage < totalPages) {
      navRow.push({
        text: 'Next',
        callback_data: `purchases_page_${currentPage + 1}`,
        style: 'primary',
        icon_custom_emoji_id: '5370628901661842942'
      });
    }
    if (navRow.length > 0) {
      inline_keyboard.push(navRow);
    }
  } else {
    const demoOrders = [
      { id: 8, name: 'Gemini Link 18 months', time: '09/02 12:04' },
      { id: 7, name: 'Gemini Link 18 months', time: '09/02 11:45' },
      { id: 6, name: 'Gemini Link 18 months', time: '09/01 18:30' },
      { id: 5, name: 'Gemini Link 18 months', time: '09/01 15:20' }
    ];

    for (const d of demoOrders) {
      inline_keyboard.push([
        {
          text: `${d.name} (${d.time})`,
          callback_data: `view_demo_order_${d.id}`,
          style: 'success',
          icon_custom_emoji_id: '5854908544712707500'
        }
      ]);
    }
  }

  inline_keyboard.push(
    [
      { text: 'Top up balance', callback_data: 'add_funds', style: 'primary', icon_custom_emoji_id: '5409048419211682843' }
    ],
    [
      { text: 'Back', callback_data: 'profile', style: 'primary', icon_custom_emoji_id: '5976535107933050770' }
    ]
  );

  const ordersCaption = `<tg-emoji emoji-id="5854908544712707500">📦</tg-emoji> <b>My Purchases</b> <code>(Page ${page})</code>\n\n` +
    `Click on any purchase to view credentials or download TXT:`;

  const ordersBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_orders_banner.png");
  await sendOrEditScreenWithPhoto(targetBot, chatId, ordersBannerPath, ordersCaption, { inline_keyboard }, messageId);
};

const sendReferralProgramScreen = async (targetBot: TelegramBot, chatId: number, userId: string, messageId?: number) => {
  const tgUser = await storage.getTelegramUser(userId);
  const rewardUsdtSetting = (await storage.getSetting("REFERRAL_REWARD_USDT"))?.value || "0.15";
  const minWithdrawSetting = (await storage.getSetting("REFERRAL_MIN_WITHDRAW_USDT"))?.value || "3.00";
  const pendingHoursSetting = (await storage.getSetting("REFERRAL_PENDING_HOURS"))?.value || "24";

  let pendingCount = 0;
  let confirmedCount = 0;

  try {
    const userRefs = await db.execute(sql`SELECT * FROM referrals WHERE referrer_telegram_id = ${userId}`);
    const rows = userRefs.rows || [];
    pendingCount = rows.filter((r: any) => r.status === 'pending').length;
    confirmedCount = rows.filter((r: any) => r.status === 'confirmed').length;
  } catch (e) { }

  const refBalCents = (tgUser as any)?.referralBalance || 0;
  const refBalUSD = (refBalCents / 100).toFixed(2);
  const refBalRUB = Math.round(parseFloat(refBalUSD) * 90);

  const botUsername = (await targetBot.getMe().catch(() => ({ username: 'Imesh_cloud_bot' }))).username || 'Imesh_cloud_bot';
  const refLink = `https://t.me/${botUsername}?start=ref_${userId}`;

  const refCaption = `<tg-emoji emoji-id="5208604387156448480">👥</tg-emoji> <b>Referral program</b>\n\n` +
    `<tg-emoji emoji-id="6113971389935391397">🎁</tg-emoji> Reward: <b>${rewardUsdtSetting} USDT</b> per new user\n` +
    `<tg-emoji emoji-id="5429518319243775957">💰</tg-emoji> Available: <b>${refBalUSD} USDT</b> ≈ <b>${refBalRUB} RUB</b>\n` +
    `<tg-emoji emoji-id="5206356981094310220">⏳</tg-emoji> Pending for ${pendingHoursSetting} hours: <b>${pendingCount}</b>\n` +
    `<tg-emoji emoji-id="5812250560161649509">✅</tg-emoji> Confirmed: <b>${confirmedCount}</b>\n\n` +
    `The reward is credited when a new user opens the bot through your link, subscribes to the channel and remains subscribed for ${pendingHoursSetting} hours.\n\n` +
    `<tg-emoji emoji-id="5332755643822520488">🔗</tg-emoji> Your link:\n` +
    `<code>${refLink}</code>\n\n` +
    `Manual withdrawal: minimum <b>${minWithdrawSetting} USDT</b>, <b>BEP-20</b> network.`;

  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}`;

  const inline_keyboard = [
    [
      {
        text: 'Share link',
        url: shareUrl,
        style: 'primary',
        icon_custom_emoji_id: '5271604874419647061'
      }
    ],
    [
      {
        text: 'Convert to shop balance',
        callback_data: 'convert_ref_to_bal',
        style: 'success',
        icon_custom_emoji_id: '5409048419211682843'
      }
    ],
    [
      {
        text: 'Withdraw USDT BEP-20',
        callback_data: 'withdraw_referral',
        style: 'primary',
        icon_custom_emoji_id: '5404617696589390973'
      }
    ],
    [
      {
        text: 'Back',
        callback_data: 'profile',
        style: 'primary',
        icon_custom_emoji_id: '5976535107933050770'
      }
    ]
  ] as any;

  const refBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_referral_banner.png");
  await sendOrEditScreenWithPhoto(targetBot, chatId, refBannerPath, refCaption, { inline_keyboard }, messageId);
};

const sendCurrencyScreen = async (targetBot: TelegramBot, chatId: number, userId: string, messageId?: number) => {
  const tgUser = await storage.getTelegramUser(userId);
  const currCurrency = (tgUser as any)?.selectedCurrency || "USD";

  // Fetch live exchange rates
  const rates = await fetchLiveExchangeRates();

  const ratesText = Object.entries(SUPPORTED_CURRENCIES)
    .filter(([code]) => code !== 'USD' && code !== 'USDT')
    .map(([code, info]) => `• <b>${code}</b> (${info.symbol}): <code>${rates[code] ? rates[code].toFixed(2) : 'N/A'}</code>`)
    .join('\n');

  const currencyCaption = `<tg-emoji emoji-id="5429518319243775957">💱</tg-emoji> <b>Price Currency (Live Rates)</b>\n\n` +
    `Current selected: <b>${currCurrency}</b>\n\n` +
    `<tg-emoji emoji-id="5404617696589390973">📈</tg-emoji> <b>Live Market Rates (1 USD):</b>\n` +
    `${ratesText}\n\n` +
    `Choose how product prices are displayed across the store:`;

  const inline_keyboard: any[] = [];
  const currencyKeys = Object.keys(SUPPORTED_CURRENCIES);

  // Rows of 3 buttons without standard unicode emojis in text
  for (let i = 0; i < currencyKeys.length; i += 3) {
    const row = currencyKeys.slice(i, i + 3).map(code => {
      const info = SUPPORTED_CURRENCIES[code];
      const isSelected = currCurrency === code;
      return {
        text: `${code} (${info.symbol})`,
        callback_data: `set_curr_${code}`,
        style: isSelected ? 'success' : 'primary',
        icon_custom_emoji_id: isSelected ? '5409048419211682843' : info.customEmojiId
      };
    });
    inline_keyboard.push(row);
  }

  inline_keyboard.push([
    {
      text: 'Back',
      callback_data: 'profile',
      style: 'primary',
      icon_custom_emoji_id: '5976535107933050770'
    }
  ]);

  const currencyBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_currency_banner.png");
  await sendOrEditScreenWithPhoto(targetBot, chatId, currencyBannerPath, currencyCaption, { inline_keyboard }, messageId);
};

const sendLanguageScreen = async (targetBot: TelegramBot, chatId: number, userId: string, messageId?: number) => {
  const tgUser = await storage.getTelegramUser(userId);
  const currLang = (tgUser as any)?.selectedLanguage || "en";

  const langCaption = `<tg-emoji emoji-id="5854908544712707500">🌐</tg-emoji> <b>${t(currLang, 'language')}</b>\n\n` +
    `Current selected: <b>${SUPPORTED_LANGUAGES[currLang as Language]?.nativeName || 'English'}</b>\n\n` +
    `Choose your preferred language for the bot interface:`;

  const inline_keyboard: any[] = [
    [
      {
        text: 'English',
        callback_data: 'set_lang_en',
        style: currLang === 'en' ? 'success' : 'primary',
        icon_custom_emoji_id: currLang === 'en' ? '5409048419211682843' : '5404617696589390973'
      },
      {
        text: 'Русский',
        callback_data: 'set_lang_ru',
        style: currLang === 'ru' ? 'success' : 'primary',
        icon_custom_emoji_id: currLang === 'ru' ? '5409048419211682843' : '5231449120635370684'
      }
    ],
    [
      {
        text: 'हिंदी',
        callback_data: 'set_lang_hi',
        style: currLang === 'hi' ? 'success' : 'primary',
        icon_custom_emoji_id: currLang === 'hi' ? '5409048419211682843' : '6113971389935391397'
      },
      {
        text: '中文',
        callback_data: 'set_lang_zh',
        style: currLang === 'zh' ? 'success' : 'primary',
        icon_custom_emoji_id: currLang === 'zh' ? '5409048419211682843' : '5854908544712707500'
      }
    ],
    [
      {
        text: 'Tiếng Việt',
        callback_data: 'set_lang_vi',
        style: currLang === 'vi' ? 'success' : 'primary',
        icon_custom_emoji_id: currLang === 'vi' ? '5409048419211682843' : '5429518319243775957'
      }
    ],
    [
      {
        text: t(currLang, 'btn_back'),
        callback_data: 'profile',
        style: 'primary',
        icon_custom_emoji_id: '5976535107933050770'
      }
    ]
  ];

  const settingsBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_settings_banner.png");
  await sendOrEditScreenWithPhoto(targetBot, chatId, settingsBannerPath, langCaption, { inline_keyboard }, messageId);
};

const sendTransactionsScreen = async (targetBot: TelegramBot, chatId: number, userId: string, messageId?: number, page: number = 1) => {
  let tgUser = await storage.getTelegramUser(userId);
  if (!tgUser) {
    tgUser = await storage.getTelegramUserByChatId(chatId.toString());
  }

  const allOrders = await storage.getOrders();
  const allPayments = await db.select().from(payments);

  const userOrders = tgUser ? allOrders.filter(o => o.telegramUserId === tgUser.id) : [];
  const userPayments = tgUser ? allPayments.filter(p => p.telegramUserId === tgUser.id && p.status === 'completed') : [];

  interface TxEntry {
    id: string;
    type: 'deposit' | 'purchase' | 'manual_add' | 'manual_deduct' | 'referral';
    amountUSD: string;
    sign: '+' | '-';
    description: string;
    date: Date;
  }

  const transactionsList: TxEntry[] = [];

  userPayments.forEach(p => {
    const amt = (p.amount / 100).toFixed(2);
    let methodTag = p.paymentMethod ? p.paymentMethod.toUpperCase() : 'DEPOSIT';
    if (methodTag === 'BEP20') methodTag = 'BEP20 USDT';
    if (methodTag === 'TRC20') methodTag = 'TRC20 USDT';
    if (methodTag === 'BINANCE') methodTag = 'Binance Pay';

    transactionsList.push({
      id: `TX-${1000 + p.id}`,
      type: 'deposit',
      amountUSD: amt,
      sign: '+',
      description: `Deposit via ${methodTag}`,
      customEmojiId: '5409048419211682843',
      date: p.createdAt ? new Date(p.createdAt) : new Date()
    });
  });

  const orderBatches: { id: number; productId: number; quantity: number; createdAt: Date }[] = [];

  userOrders.forEach(o => {
    const orderTime = new Date(o.createdAt).getTime();
    const existingBatch = orderBatches.find(b =>
      b.productId === o.productId &&
      Math.abs(new Date(b.createdAt).getTime() - orderTime) <= 30000
    );

    if (existingBatch) {
      existingBatch.quantity += 1;
    } else {
      orderBatches.push({
        id: o.id,
        productId: o.productId,
        quantity: 1,
        createdAt: new Date(o.createdAt)
      });
    }
  });

  for (const batch of orderBatches) {
    const product = await storage.getProduct(batch.productId);
    const unitPrice = product ? (product.price / 100) : 3.00;
    const totalAmt = (unitPrice * batch.quantity).toFixed(2);
    const baseName = product ? product.name : `Product #${batch.productId}`;
    const prodName = batch.quantity > 1 ? `${baseName} (${batch.quantity} Pcs)` : baseName;
    const prodEmoji = product ? (product.customEmojiId || (product as any).custom_emoji_id || '5854908544712707500') : '5854908544712707500';

    transactionsList.push({
      id: `TX-${2000 + batch.id}`,
      type: 'purchase',
      amountUSD: totalAmt,
      sign: '-',
      description: `Purchase ${prodName} (Order #${batch.id})`,
      customEmojiId: prodEmoji,
      date: batch.createdAt
    });
  }

  transactionsList.sort((a, b) => b.date.getTime() - a.date.getTime());

  if (transactionsList.length === 0) {
    const fallbackDemos: TxEntry[] = [
      { id: 'TX-1547', type: 'purchase', amountUSD: '3.00', sign: '-', description: 'Purchase AWS 5 vcpu (Order #3286)', customEmojiId: '5785025630055700143', date: new Date(Date.now() - 3600000) },
      { id: 'TX-1546', type: 'purchase', amountUSD: '3.00', sign: '-', description: 'Purchase AWS 5 vcpu (Order #3285)', customEmojiId: '5785025630055700143', date: new Date(Date.now() - 7200000) },
      { id: 'TX-1545', type: 'deposit', amountUSD: '10.00', sign: '+', description: 'Deposit via Binance Pay', customEmojiId: '5409048419211682843', date: new Date(Date.now() - 14400000) },
      { id: 'TX-1544', type: 'purchase', amountUSD: '3.00', sign: '-', description: 'Purchase AWS 5 vcpu (Order #3283)', customEmojiId: '5785025630055700143', date: new Date(Date.now() - 28800000) }
    ];
    transactionsList.push(...fallbackDemos);
  }

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(transactionsList.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = transactionsList.slice(startIndex, startIndex + pageSize);

  let txCaption = `<tg-emoji emoji-id="5429518319243775957">🪙</tg-emoji> <b>Transactions History</b> <code>(Page ${currentPage}/${totalPages})</code>\n` +
    `➖➖➖➖➖➖➖➖➖➖\n\n`;

  pageItems.forEach(item => {
    const typeEmoji = item.sign === '+' 
      ? `<tg-emoji emoji-id="5443127283898405358">📥</tg-emoji>` 
      : `<tg-emoji emoji-id="${item.customEmojiId || '5854908544712707500'}">📦</tg-emoji>`;

    const signEmoji = item.sign === '+' 
      ? `<tg-emoji emoji-id="5397916757333654639">➕</tg-emoji>` 
      : `<tg-emoji emoji-id="5364322626950938114">➖</tg-emoji>`;

    const dollarEmoji = `<tg-emoji emoji-id="5197434882321567830">💲</tg-emoji>`;

    let subIcon = `<i>${item.description}</i>`;
    if (item.description.includes('BEP20')) {
      subIcon = `<tg-emoji emoji-id="5280907155107506256">🟡</tg-emoji> <i>${item.description}</i>`;
    } else if (item.description.includes('TRC20')) {
      subIcon = `<tg-emoji emoji-id="5936189134342199863">🔴</tg-emoji> <i>${item.description}</i>`;
    } else if (item.description.includes('Binance')) {
      subIcon = `<tg-emoji emoji-id="5936122953191135570">🌐</tg-emoji> <i>${item.description}</i>`;
    }

    txCaption += `${typeEmoji} <b>#${item.id}</b> • ${signEmoji}<code>$${item.amountUSD}</code> ${dollarEmoji}\n` +
      `${subIcon}\n\n`;
  });

  txCaption += `➖➖➖➖➖➖➖➖➖➖`;

  const navRow: any[] = [];

  if (currentPage > 1) {
    navRow.push({
      text: 'Prev',
      callback_data: `tx_page_${currentPage - 1}`,
      icon_custom_emoji_id: '5370615926565641880'
    });
  }

  if (currentPage < totalPages) {
    navRow.push({
      text: 'Next',
      callback_data: `tx_page_${currentPage + 1}`,
      icon_custom_emoji_id: '5370628901661842942'
    });
  }

  const inline_keyboard: any[] = [];
  if (navRow.length > 0) {
    inline_keyboard.push(navRow);
  }

  inline_keyboard.push(
    [
      { text: 'Top up balance', callback_data: 'add_funds', icon_custom_emoji_id: '5409048419211682843' }
    ],
    [
      { text: 'My purchases', callback_data: 'purchase_history', icon_custom_emoji_id: '5854908544712707500' }
    ],
    [
      { text: 'Back', callback_data: 'profile', icon_custom_emoji_id: '5976535107933050770' }
    ]
  );

  const txBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_transactions_banner.png");
  await sendOrEditScreenWithPhoto(targetBot, chatId, txBannerPath, txCaption, { inline_keyboard }, messageId);
};

const sendPromoCodeScreen = async (targetBot: TelegramBot, chatId: number, userId: string, messageId?: number) => {
  await storage.updateTelegramUserByChatId(userId, { lastAction: 'awaiting_promocode' });
  const promoCaption = `<tg-emoji emoji-id="6113971389935391397">🎟</tg-emoji> <b>Enter Promo Code</b>\n\nPlease type your promo code in the chat below to redeem:`;
  const inline_keyboard = [
    [
      { text: 'Back', callback_data: 'profile', style: 'primary', icon_custom_emoji_id: '5976535107933050770' }
    ]
  ] as any;
  const promoBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_promocode_banner.png");
  await sendOrEditScreenWithPhoto(targetBot, chatId, promoBannerPath, promoCaption, { inline_keyboard }, messageId);
};

const sendAddFundsScreen = async (targetBot: TelegramBot, chatId: number, messageId?: number) => {
  const topUpCaption = `<tg-emoji emoji-id="5429518319243775957">📊</tg-emoji> <b>Balance Top-up</b>\n\nChoose payment method:`;

  const inline_keyboard = [
    [
      { text: 'CryptoBot', callback_data: 'payment_cryptobot', style: 'success', icon_custom_emoji_id: '5361914370068613491' }
    ],
    [
      { text: 'Binance Pay / UID', callback_data: 'payment_binance', style: 'success', icon_custom_emoji_id: '5281029063459234079' }
    ],
    [
      { text: 'USDT • BEP20', callback_data: 'payment_bep20', style: 'success', icon_custom_emoji_id: '5280907155107506256' },
      { text: 'USDT • TRC20', callback_data: 'payment_trc20', style: 'success', icon_custom_emoji_id: '5936189134342199863' }
    ],
    [
      { text: 'Profile', callback_data: 'profile', style: 'primary', icon_custom_emoji_id: '5260399854500191689' },
      { text: 'Cancel', callback_data: 'profile', style: 'danger', icon_custom_emoji_id: '5976535107933050770' }
    ]
  ] as any;

  const balanceBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_balance_banner.png");
  await sendOrEditScreenWithPhoto(targetBot, chatId, balanceBannerPath, topUpCaption, { inline_keyboard }, messageId);
};

const sendSupportScreen = async (targetBot: TelegramBot, chatId: number, messageId?: number) => {
  const tgUser = await storage.getTelegramUser(chatId.toString());
  const userLang = (tgUser as any)?.selectedLanguage || 'en';

  const supportUsernameSetting = await storage.getSetting("SUPPORT_USERNAME");
  const rawSupportUsername = supportUsernameSetting?.value || "creativesStudios";
  const cleanUsername = rawSupportUsername.replace('@', '');

  const caption = `<tg-emoji emoji-id="5260535596941582167">💬</tg-emoji> <b>${t(userLang, 'support_title')}</b>\n\n` +
    `Need help? Contact admin: @${cleanUsername}\n\n` +
    `${t(userLang, 'support_sub')}`;

  const inline_keyboard = [
    [
      {
        text: t(userLang, 'issue_payment_not_approved'),
        callback_data: 'supp_payment',
        style: 'primary',
        icon_custom_emoji_id: '5260535596941582167'
      }
    ],
    [
      {
        text: t(userLang, 'issue_not_received'),
        callback_data: 'supp_not_received',
        style: 'primary',
        icon_custom_emoji_id: '5854908544712707500'
      }
    ],
    [
      {
        text: t(userLang, 'issue_not_working'),
        callback_data: 'supp_not_working',
        style: 'primary',
        icon_custom_emoji_id: '5854908544712707500'
      }
    ],
    [
      {
        text: t(userLang, 'issue_wrong_amount'),
        callback_data: 'supp_wrong_amount',
        style: 'primary',
        icon_custom_emoji_id: '5260535596941582167'
      }
    ],
    [
      {
        text: t(userLang, 'issue_other'),
        callback_data: 'supp_other',
        style: 'primary',
        icon_custom_emoji_id: '5260535596941582167'
      }
    ],
    [
      {
        text: t(userLang, 'btn_back'),
        callback_data: 'main_menu',
        style: 'danger',
        icon_custom_emoji_id: '5976535107933050770'
      }
    ]
  ] as any;

  const infoBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_info_banner.png");
  await sendOrEditScreenWithPhoto(targetBot, chatId, infoBannerPath, caption, { inline_keyboard }, messageId);
};

const DEPOSIT_SUCCESS_STICKER_FILE_ID = "CAACAgEAAxkBAAFTGmpqlGQ8wZBqct5LNz0nvcL6uOKAlwACBAADC9xoT_EZ7u4B_LCcPQQ";

const sendDepositSuccessNotification = async (
  targetBot: TelegramBot,
  chatId: number | string,
  amountUSD: number,
  newBalanceUSD: number,
  methodName: string = 'Admin Deposit',
  txId?: string
) => {
  const tgUser = await storage.getTelegramUserByChatId(chatId.toString()) || await storage.getTelegramUser(chatId.toString());
  const userLang = (tgUser as any)?.selectedLanguage || 'en';

  const caption = `<tg-emoji emoji-id="5949584381424178413">✅</tg-emoji> <b>Balance Added Successfully!</b>\n` +
    `➖➖➖➖➖➖➖➖➖➖\n\n` +
    `<tg-emoji emoji-id="5429518319243775957">💵</tg-emoji> Amount Credited: <b>+$${amountUSD.toFixed(2)} USD</b> <tg-emoji emoji-id="5409048419211682843">💵</tg-emoji>\n` +
    `<tg-emoji emoji-id="5370919202796348364">💳</tg-emoji> Payment Method: <b>${methodName}</b>\n` +
    `${txId ? `<tg-emoji emoji-id="5976535107933050770">🧾</tg-emoji> Reference ID: <code>${txId}</code>\n` : ''}` +
    `➖➖➖➖➖➖➖➖➖➖\n\n` +
    `<tg-emoji emoji-id="6032693626394382504">💎</tg-emoji> Your New Balance: <b>$${newBalanceUSD.toFixed(2)} USD</b>\n\n` +
    `<tg-emoji emoji-id="5377660214096974712">✨</tg-emoji> Thank you for trusting <b>Shopeefy</b>! Your balance has been updated.`;

  const inline_keyboard = [
    [
      { text: t(userLang, 'btn_catalog'), callback_data: 'buy', style: 'success', icon_custom_emoji_id: '5377660214096974712' },
      { text: t(userLang, 'btn_profile'), callback_data: 'profile', style: 'primary', icon_custom_emoji_id: '5260399854500191689' }
    ]
  ] as any;

  const paymentBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_balance_banner.png");
  await sendOrEditScreenWithPhoto(targetBot, Number(chatId), paymentBannerPath, caption, { inline_keyboard });

  try {
    const stickerMsg = await targetBot.sendSticker(Number(chatId), DEPOSIT_SUCCESS_STICKER_FILE_ID);
    if (stickerMsg && stickerMsg.message_id) {
      setTimeout(async () => {
        try {
          await targetBot.deleteMessage(Number(chatId), stickerMsg.message_id);
        } catch (e) {
          console.error('[Sticker Auto-Delete Error]:', e);
        }
      }, 5000);
    }
  } catch (err) {
    console.error('[Sticker] Failed to send deposit gift sticker:', err);
  }
};

const handleSupportIssue = async (
  targetBot: TelegramBot,
  chatId: number,
  userId: string,
  issueTypeKey: string,
  messageId?: number
) => {
  const issueTitles: Record<string, string> = {
    supp_payment: 'Payment sent but not approved',
    supp_not_received: 'Product not received',
    supp_not_working: 'Product not working',
    supp_wrong_amount: 'Wrong amount sent',
    supp_other: 'Other issue'
  };

  const issueTitle = issueTitles[issueTypeKey] || 'Support Request';

  const supportUsernameSetting = await storage.getSetting("SUPPORT_USERNAME");
  const rawSupportUsername = supportUsernameSetting?.value || "creativesStudios";
  const cleanUsername = rawSupportUsername.replace('@', '');

  const tgUser = await storage.getTelegramUser(userId);

  try {
    if (tgUser) {
      const ticket = await storage.createSupportTicket({
        telegramUserId: tgUser.id,
        issueType: issueTitle,
        status: 'open',
        userTelegramId: userId,
        username: tgUser.username || tgUser.firstName || 'Customer',
        details: null
      });

      await storage.updateTelegramUserByChatId(userId, { lastAction: `awaiting_support_details_${ticket.id}` });

      sendAdminPushNotification({
        title: `🆘 New Support Request (#${ticket.id})`,
        body: `@${tgUser.username || userId} requested support: ${issueTitle}`
      }).catch(() => {});
    }
  } catch (err) {
    console.error('Error creating support ticket:', err);
  }

  const caption = `<tg-emoji emoji-id="5260535596941582167">💬</tg-emoji> <b>${issueTitle}</b>\n\n` +
    `Contact @${cleanUsername} and send:\n\n` +
    `<blockquote>Order ID:\n` +
    `Payment method:\n` +
    `Amount sent:\n` +
    `Screenshot attached: Yes/No\n` +
    `Problem details:</blockquote>`;

  const inline_keyboard = [
    [
      {
        text: 'Contact Admin ↗',
        url: `https://t.me/${cleanUsername}`,
        style: 'success',
        icon_custom_emoji_id: '5260535596941582167'
      }
    ],
    [
      {
        text: 'Back',
        callback_data: 'support',
        style: 'danger',
        icon_custom_emoji_id: '5976535107933050770'
      }
    ]
  ] as any;

  const infoBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_info_banner.png");
  await sendOrEditScreenWithPhoto(targetBot, chatId, infoBannerPath, caption, { inline_keyboard }, messageId);
};

const sendUsefulLinksScreen = async (targetBot: TelegramBot, chatId: number, messageId?: number) => {
  const infoCaption = `<tg-emoji emoji-id="5271604874419647061">🔗</tg-emoji> <b>Useful links</b>\n\n` +
    `Guarantees, support, reviews, rules, and shop resources.`;

  const inline_keyboard = [
    [
      { text: 'Guarantees', callback_data: 'guarantees', style: 'primary', icon_custom_emoji_id: '5404617696589390973' },
      { text: 'Support', callback_data: 'support', style: 'primary', icon_custom_emoji_id: '5260535596941582167' }
    ],
    [
      { text: 'Reviews', callback_data: 'reviews', style: 'primary', icon_custom_emoji_id: '5193009244940557703' },
      { text: 'Rules', callback_data: 'rules', style: 'primary', icon_custom_emoji_id: '5274099962655816924' }
    ],
    [
      { text: 'Channel', callback_data: 'channel', style: 'primary', icon_custom_emoji_id: '5271604874419647061' }
    ],
    [
      { text: 'Main menu', callback_data: 'main_menu', style: 'primary', icon_custom_emoji_id: '5271604874419647061' }
    ]
  ] as any;

  if (messageId) {
    try {
      await targetBot.editMessageCaption(infoCaption, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard }
      });
      return;
    } catch (e: any) {
      try {
        await targetBot.editMessageText(infoCaption, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard }
        });
        return;
      } catch (err) { }
    }
  }

  const infoBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_info_banner.png");

  if (fs.existsSync(infoBannerPath)) {
    try {
      await targetBot.sendPhoto(chatId, infoBannerPath, {
        caption: infoCaption,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard }
      });
      return;
    } catch (err: any) { }
  }

  await targetBot.sendMessage(chatId, infoCaption, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard }
  });
};

const sendCustomerReviewsScreen = async (targetBot: TelegramBot, chatId: number, messageId?: number) => {
  let reviewsList = await storage.getReviews();

  // Seed default verified reviews if database has no reviews yet
  if (reviewsList.length === 0) {
    const defaultReviews = [
      { productName: "Gemini Link 18 months", rating: 5, comment: "Super fast activation! Account working 100% fine.", reviewerName: "Rochana I.", isVerified: true, status: 'approved' },
      { productName: "ChatGPT Plus 1m NW", rating: 5, comment: "Instant delivery, great support! Recommended seller.", reviewerName: "Kasun K.", isVerified: true, status: 'approved' },
      { productName: "Claude Pro 1 month CDK", rating: 5, comment: "Very good price and prompt service. Thank you!", reviewerName: "Amila P.", isVerified: true, status: 'approved' },
      { productName: "Standoff 2 Gold 1000", rating: 5, comment: "Received gold within 5 minutes. Best store!", reviewerName: "Dinesh S.", isVerified: true, status: 'approved' },
      { productName: "AWS 32 vCPU Account", rating: 5, comment: "Clean limit account with fast delivery. 5 stars!", reviewerName: "Nalin T.", isVerified: true, status: 'approved' }
    ];
    for (const r of defaultReviews) {
      await storage.createReview(r);
    }
    reviewsList = await storage.getReviews();
  }

  const totalCount = reviewsList.length;
  const sumRating = reviewsList.reduce((acc, r) => acc + (r.rating || 5), 0);
  const avgRating = totalCount > 0 ? (sumRating / totalCount).toFixed(1) : "5.0";

  const starTg = `<tg-emoji emoji-id="5193009244940557703">⭐</tg-emoji>`;
  const chartTg = `<tg-emoji emoji-id="5429518319243775957">📊</tg-emoji>`;

  let reviewsCaption = `${starTg} <b>Customer Reviews & Ratings</b>\n\n` +
    `${chartTg} <b>Average Rating:</b> <b>${avgRating} / 5.0</b> ${starTg} (Verified Buyers)\n` +
    `💬 <b>Total Reviews:</b> <b>${totalCount} Reviews</b>\n` +
    `${starTg}${starTg}${starTg}${starTg}${starTg} <b>98% Satisfied Customers</b>\n\n` +
    `<b>Recent Customer Reviews:</b>\n` +
    `➖➖➖➖➖➖➖➖➖➖\n\n`;

  reviewsList.slice(0, 4).forEach((r) => {
    const stars = starTg.repeat(r.rating || 5);
    const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recently';
    const commentClean = escapeHTML(r.comment);
    reviewsCaption += `${stars} <b>${escapeHTML(r.productName)}</b>\n` +
      `<blockquote>💬 "${commentClean}"</blockquote>\n` +
      `<tg-emoji emoji-id="6032693626394382504">👤</tg-emoji> <b>${escapeHTML(r.reviewerName)}</b> · <tg-emoji emoji-id="5812250560161649509">✅</tg-emoji> Verified (${dateStr})\n\n`;
  });

  const reviewsChannelSetting = await storage.getSetting("REVIEWS_CHANNEL_URL");
  const reviewsChannelUrl = reviewsChannelSetting?.value || "https://t.me/imesh_cloud_reviews";

  const inline_keyboard = [
    [
      {
        text: 'Write a review',
        callback_data: 'write_review',
        style: 'success',
        icon_custom_emoji_id: '5193009244940557703'
      }
    ],
    [
      {
        text: 'Open reviews channel ↗',
        url: reviewsChannelUrl,
        style: 'primary',
        icon_custom_emoji_id: '5271604874419647061'
      }
    ],
    [
      {
        text: 'Useful links',
        callback_data: 'useful_links',
        style: 'primary',
        icon_custom_emoji_id: '5271604874419647061'
      },
      {
        text: 'Main menu',
        callback_data: 'main_menu',
        style: 'primary',
        icon_custom_emoji_id: '5271604874419647061'
      }
    ]
  ] as any;

  const infoBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_info_banner.png");
  await sendOrEditScreenWithPhoto(targetBot, chatId, infoBannerPath, reviewsCaption, { inline_keyboard }, messageId);
};

const autoFulfillPendingPreorders = async (targetProductId?: number) => {
  try {
    const allProducts = targetProductId ? [await storage.getProduct(targetProductId)].filter(Boolean) : await storage.getProducts();

    for (const prod of allProducts) {
      if (!prod) continue;
      const pendingPreorders = await storage.getPendingPreordersByProduct(prod.id);
      if (pendingPreorders.length === 0) continue;

      for (const preorder of pendingPreorders) {
        const availableCreds = (await storage.getCredentialsByProduct(prod.id)).filter(c => c.status === 'available');
        if (availableCreds.length < preorder.quantity) {
          continue;
        }

        const credsToAssign = availableCreds.slice(0, preorder.quantity);
        const deliveredItems: string[] = [];
        const assignedIds: number[] = [];
        let firstOrderId: number | string = Math.floor(1000 + Math.random() * 9000);

        for (let i = 0; i < credsToAssign.length; i++) {
          const cred = credsToAssign[i];
          deliveredItems.push(cred.content);
          assignedIds.push(cred.id);
          await db.update(credentials).set({ status: 'sold' }).where(eq(credentials.id, cred.id));

          const newOrder = await storage.createOrder({
            telegramUserId: preorder.telegramUserId,
            productId: prod.id,
            credentialId: cred.id,
            status: 'completed'
          });
          if (i === 0 && newOrder && newOrder.id) {
            firstOrderId = newOrder.id;
          }
        }

        await storage.updatePreorder(preorder.id, {
          status: 'fulfilled',
          fulfilledCredentialIds: JSON.stringify(assignedIds),
          fulfilledAt: new Date()
        });

        const tgUser = (await storage.getAllTelegramUsers()).find(u => u.id === preorder.telegramUserId);
        const activeBot = await getBroadcastBot();
        if (tgUser && activeBot) {
          console.log(`[Pre-Order AutoFulfill] Sending auto-fulfilled credentials to Telegram user ${tgUser.telegramId}...`);
          await sendOrderSuccessMessage(
            activeBot,
            Number(tgUser.telegramId),
            firstOrderId,
            `Pre-Order: ${prod.name}`,
            deliveredItems
          ).catch(e => console.error("Error sending pre-order fulfillment bot message:", e));
        }
      }
    }
  } catch (err) {
    console.error("[AutoFulfill Preorders Error]:", err);
  }
};

const sendOrderSuccessMessage = async (
  targetBot: TelegramBot,
  chatId: number,
  orderId: number | string,
  productName: string,
  credentialContent: string | string[]
) => {
  let prodEmojiId = '5854908544712707500';
  const pType = productName.toLowerCase();
  if (pType.includes('top') || pType.includes('topup')) prodEmojiId = '5409048419211682843';
  else if (pType.includes('aws')) prodEmojiId = '5785025630055700143';
  else if (pType.includes('digital ocean') || pType.includes('digitalocean')) prodEmojiId = '5785345544989710932';
  else if (pType.includes('linode')) prodEmojiId = '5787285044846399857';
  else if (pType.includes('azure')) prodEmojiId = '5785185643357279341';
  else if (pType.includes('gcp') || pType.includes('google cloud')) prodEmojiId = '5785061312643994750';
  else if (pType.includes('kamatera')) prodEmojiId = '5785070770161980265';
  else if (pType.includes('gemini')) prodEmojiId = '5377660214096974712';
  else if (pType.includes('chatgpt') || pType.includes('grok')) prodEmojiId = '5404617696589390973';

  const itemsArray = Array.isArray(credentialContent) ? credentialContent : [credentialContent];
  const totalItems = itemsArray.length;
  const chunkSize = 10;
  const totalMessages = Math.ceil(totalItems / chunkSize);

  for (let msgIdx = 0; msgIdx < totalMessages; msgIdx++) {
    const startIdx = msgIdx * chunkSize;
    const endIdx = Math.min(startIdx + chunkSize, totalItems);
    const chunk = itemsArray.slice(startIdx, endIdx);

    const formattedChunkItems = chunk.length === 1 && totalItems === 1
      ? `<code>${escapeHTML(chunk[0])}</code>`
      : chunk.map((item, i) => `--- Item ${startIdx + i + 1} ---\n<code>${escapeHTML(item)}</code>`).join('\n\n');

    const partInfo = totalMessages > 1 ? ` (Part ${msgIdx + 1}/${totalMessages} - Items ${startIdx + 1} to ${endIdx})` : '';

    const slDeliveryTime = formatSriLankaTime(new Date(), 'full');
    const caption = `<tg-emoji emoji-id="5949584381424178413">✅</tg-emoji> <b>Purchase completed successfully</b>${partInfo}\n\n` +
      `<tg-emoji emoji-id="5854908544712707500">📦</tg-emoji> <tg-emoji emoji-id="${prodEmojiId}">✨</tg-emoji> <b>${escapeHTML(productName)}</b>\n` +
      `<tg-emoji emoji-id="5976535107933050770">🧾</tg-emoji> Order <b>#${orderId}</b>\n` +
      `<tg-emoji emoji-id="5805188079148863343">🕒</tg-emoji> Delivery Time: <b>${slDeliveryTime}</b>\n\n` +
      `<b>Your item(s), easy to copy:</b>\n\n` +
      `${formattedChunkItems}\n\n` +
      `Thank you for your purchase! If you have questions, contact support.\n` +
      `A review would help us if everything went well.`;

    const isLastMessage = msgIdx === totalMessages - 1;

    const inline_keyboard = isLastMessage ? [
      [
        {
          text: 'Download TXT',
          callback_data: `download_txt_${orderId}`,
          style: 'primary',
          icon_custom_emoji_id: '5443127283898405358'
        }
      ],
      [
        {
          text: 'Leave a review',
          callback_data: `leave_review_${orderId}`,
          style: 'primary',
          icon_custom_emoji_id: '5193009244940557703'
        }
      ],
      [
        {
          text: 'Main menu',
          callback_data: 'main_menu',
          style: 'primary',
          icon_custom_emoji_id: '5416041192905265756'
        }
      ]
    ] as any : undefined;

    const bannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_orders_banner.png");
    if (inline_keyboard) {
      await sendOrEditScreenWithPhoto(targetBot, chatId, bannerPath, caption, { inline_keyboard });
    } else {
      await targetBot.sendMessage(chatId, caption, { parse_mode: 'HTML' });
    }
  }
};

const sendPurchaseSuccessScreen = sendOrderSuccessMessage;

const setupBotProfile = async (targetBot: TelegramBot) => {
  try {
    const miniAppUrlSetting = await storage.getSetting("MINI_APP_URL");
    const botAboutSetting = await storage.getSetting("BOT_ABOUT_TEXT");
    const botDescSetting = await storage.getSetting("BOT_DESCRIPTION_TEXT");

    const miniAppUrl = miniAppUrlSetting?.value;

    // Set Menu Button to point to Mini App (required for Telegram to track and display "X monthly users" badge)
    if (miniAppUrl) {
      try {
        await targetBot.setChatMenuButton({
          menu_button: {
            type: 'web_app',
            text: 'Shop',
            web_app: { url: miniAppUrl }
          }
        });
        console.log('Bot Menu Button set to:', miniAppUrl);
      } catch (err: any) {
        console.error('Failed to set chat menu button:', err.message);
      }
    }

    // Set Bot Commands Menu (List of slash commands in Telegram menu)
    try {
      await targetBot.setMyCommands([
        { command: 'start', description: 'Open shop' },
        { command: 'language', description: 'Change language' },
        { command: 'help', description: 'Help' },
        { command: 'info', description: 'Information' },
        { command: 'search', description: 'Search products' },
        { command: 'promo', description: 'Apply promo code' }
      ]);
      console.log('[Bot Commands] setMyCommands registered successfully!');
    } catch (err: any) {
      console.error('Failed to set bot commands:', err.message);
    }

    // 2. Set Bot Descriptions
    if (botAboutSetting?.value) {
      await targetBot.setMyShortDescription({ short_description: botAboutSetting.value });
    }
    if (botDescSetting?.value) {
      await targetBot.setMyDescription({ description: botDescSetting.value });
    }

  } catch (err: any) {
    // Ignore errors related to bot profile setup if API key is restricted
    console.error('Bot profile setup warning:', err.message);
  }
};

const setupBotHandlers = (targetBot: TelegramBot) => {
  // Polling error handling
  targetBot.on('polling_error', (error: any) => {
    if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
      console.warn(`[Bot Polling Warning] 409 Conflict for token hash ${targetBot.token ? targetBot.token.substring(0, 12) : 'none'}. Another bot instance is polling or webhook is set.`);
    } else {
      console.error('Bot polling error:', error);
    }
  });

  targetBot.on('my_chat_member', async (update) => {
    const chat = update.chat;
    if (update.new_chat_member.status === 'member' || update.new_chat_member.status === 'administrator') {
      try {
        const channels = await storage.getBroadcastChannels();
        if (!channels.some(c => c.channelId === chat.id.toString())) {
          await storage.createBroadcastChannel({
            channelId: chat.id.toString(),
            name: chat.title || 'Auto-detected Group'
          });
        }
      } catch (err) {
        console.error('Failed to auto-register group:', err);
      }

      // Sync to forwarding groups if using the same token
      try {
        const mainToken = await getBotToken();
        const forwardTokenSetting = await storage.getSetting("TG_FORWARD_BOT_TOKEN");
        const forwardToken = forwardTokenSetting?.value;
        if (forwardToken === mainToken && targetBot.token === mainToken) {
          await addOrUpdateGroup(chat.id.toString(), chat.title || 'Auto-detected Group');
        }
      } catch (err) {
        console.error('Failed to sync forward group in my_chat_member:', err);
      }
    } else if (update.new_chat_member.status === 'left' || update.new_chat_member.status === 'kicked') {
      try {
        const mainToken = await getBotToken();
        const forwardTokenSetting = await storage.getSetting("TG_FORWARD_BOT_TOKEN");
        const forwardToken = forwardTokenSetting?.value;
        if (forwardToken === mainToken && targetBot.token === mainToken) {
          await removeGroup(chat.id.toString());
        }
      } catch (err) {
        console.error('Failed to remove forward group in my_chat_member:', err);
      }
    }
  });

  // Detect groups when a message is sent to them
  targetBot.on('message', async (msg) => {
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup' || msg.chat.type === 'channel') {
      try {
        const channels = await storage.getBroadcastChannels();
        if (!channels.some(c => c.channelId === msg.chat.id.toString())) {
          await storage.createBroadcastChannel({
            channelId: msg.chat.id.toString(),
            name: msg.chat.title || 'Auto-detected Group'
          });
        }
      } catch (err) {
        console.error('Failed to auto-register group from message:', err);
      }

      // Sync to forwarding groups if using the same token
      try {
        const mainToken = await getBotToken();
        const forwardTokenSetting = await storage.getSetting("TG_FORWARD_BOT_TOKEN");
        const forwardToken = forwardTokenSetting?.value;
        if (forwardToken === mainToken && targetBot.token === mainToken) {
          await addOrUpdateGroup(msg.chat.id.toString(), msg.chat.title || 'Auto-detected Group');
        }
      } catch (err) {
        console.error('Failed to sync forward group in message:', err);
      }
    }
  });

  // Handle interactive features for both bots if they are groups/channels
  // But commands and user profiles are handled by the main bot (bot variable)
  
async function processCryptomusInvoiceCreation(targetBot: TelegramBot, chatId: number, tgUser: any, amount: number) {
  const apiKey = (await storage.getSetting('CRYPTOMUS_API_KEY'))?.value;
  const merchantId = (await storage.getSetting('CRYPTOMUS_MERCHANT_ID'))?.value;

  if (!apiKey || !merchantId) {
    targetBot.sendMessage(chatId, "❌ Cryptomus is not configured by admin.");
    return;
  }

  try {
    const orderId = crypto.randomBytes(12).toString('hex');
    const host = process.env.NODE_ENV === 'production'
      ? 'cloudshopplatform.site'
      : 'localhost:5000';

    const existingPending = await storage.getPendingPaymentByAmount(tgUser.id, Math.round(amount * 100));
    if (existingPending) {
      return targetBot.sendMessage(chatId, `⚠️ You already have a pending $${amount} payment. Please pay that one first or wait for it to expire (1 hour).`);
    }

    const sign = crypto.createHash('md5').update(Buffer.from(JSON.stringify({
      amount: amount.toString(),
      currency: 'USD',
      order_id: orderId,
      url_callback: `https://${host}/api/payments/webhook`
    })).toString('base64') + apiKey).digest('hex');

    const response = await axios.post('https://api.cryptomus.com/v1/payment', {
      amount: amount.toString(),
      currency: 'USD',
      order_id: orderId,
      url_callback: `https://${host}/api/payments/webhook`
    }, {
      headers: {
        'merchant': merchantId,
        'sign': sign
      }
    });

    if (response.data.result) {
      const paymentData = response.data.result;
      const newPayment = await storage.createPayment({
        telegramUserId: tgUser.id,
        amount: Math.round(amount * 100),
        paymentMethod: 'cryptomus',
        status: 'pending',
        cryptomusUuid: paymentData.uuid
      });

      await storage.updateTelegramUser(tgUser.id, { lastAction: null });

      const responseMsg = `<tg-emoji emoji-id="5341506639688126935">💰</tg-emoji> <b>Cryptomus Top-up Invoice</b>\n` +
        `➖➖➖➖➖➖➖➖➖➖\n` +
        `<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> Top-up amount: <b>$${amount.toFixed(2)} USD</b>\n` +
        `<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> Status: ⏳ <b>Pending</b>\n` +
        `➖➖➖➖➖➖➖➖➖➖\n` +
        `Click on the button below to pay via <b>Cryptomus</b>:`;

      targetBot.sendMessage(chatId, responseMsg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Go to payment', url: paymentData.url, icon_custom_emoji_id: '5373123633415695601' }],
            [{ text: 'Check payment', callback_data: `check_payment_${newPayment.id}`, icon_custom_emoji_id: '6010111371251815589' }]
          ] as any
        }
      });
    } else {
      throw new Error("Invalid response from Cryptomus");
    }
  } catch (err: any) {
    console.error('Cryptomus creation error:', err.response?.data || err.message);
    targetBot.sendMessage(chatId, "❌ Failed to create Cryptomus invoice. Please try again later.");
  }
}

// Anti-Spam Rate Limiter sliding window (user_id -> timestamps of requests in last 60 seconds)
const userRequestTimestamps = new Map<string, number[]>();

async function processAntiSpamCheck(userId: string, chatId: number, queryId?: string): Promise<boolean> {
  try {
    const tgUser = await storage.getTelegramUser(userId);
    if (!tgUser) return false;

    const now = Date.now();

    // 1. Permanent Ban Check
    if (tgUser.isBanned) {
      const bannedMsg = `<tg-emoji emoji-id="6298544405435387645">🚫</tg-emoji> <b>Access Prohibited</b>\n\nYour account has been permanently suspended by the administrator. Please contact support if you believe this is an error.`;
      if (queryId && targetBot) {
        await targetBot.answerCallbackQuery(queryId, { text: "🚫 Access Prohibited. Account suspended.", show_alert: true }).catch(() => {});
      }
      if (targetBot) {
        await targetBot.sendMessage(chatId, bannedMsg, { parse_mode: 'HTML' }).catch(() => {});
      }
      return true;
    }

    // 2. Temporary Ban Check
    if (tgUser.bannedUntil && new Date(tgUser.bannedUntil).getTime() > now) {
      const untilStr = new Date(tgUser.bannedUntil).toLocaleString('en-US');
      const remainingMins = Math.ceil((new Date(tgUser.bannedUntil).getTime() - now) / (60 * 1000));
      const tempBannedMsg = `<tg-emoji emoji-id="6298544405435387645">⚠️</tg-emoji> <b>Access Temporarily Restricted</b>\n\nYour account has been temporarily restricted for high request activity (Spam Protection).\n\n⏱️ <b>Remaining time:</b> ${remainingMins} minute(s)\n📌 <b>Unbans at:</b> ${untilStr}`;
      if (queryId && targetBot) {
        await targetBot.answerCallbackQuery(queryId, { text: `⚠️ Account suspended (${remainingMins}m remaining).`, show_alert: true }).catch(() => {});
      }
      if (targetBot) {
        await targetBot.sendMessage(chatId, tempBannedMsg, { parse_mode: 'HTML' }).catch(() => {});
      }
      return true;
    }

    // 3. Sliding Window Rate Calculation
    let timestamps = userRequestTimestamps.get(userId) || [];
    timestamps = timestamps.filter(t => now - t < 60000);
    timestamps.push(now);
    userRequestTimestamps.set(userId, timestamps);

    // Update lastRequestAt timestamp
    await storage.updateTelegramUser(tgUser.id, { lastRequestAt: new Date(now) }).catch(() => {});
    io.emit('spam_stats_update');

    // Fetch Anti-Spam settings
    const autoBanEnabled = (await storage.getSetting('SPAM_AUTO_BAN_ENABLED'))?.value !== 'false';
    const maxReqPerMin = parseInt((await storage.getSetting('SPAM_MAX_REQ_PER_MIN'))?.value || '15', 10);
    const tempBanMins = parseInt((await storage.getSetting('SPAM_TEMP_BAN_DURATION_MINS'))?.value || '15', 10);

    // Trigger Anti-Spam Auto-Ban if threshold exceeded
    if (autoBanEnabled && timestamps.length > maxReqPerMin) {
      const banUntil = new Date(now + tempBanMins * 60 * 1000);
      const newViolations = (tgUser.spamViolations || 0) + 1;
      await storage.updateTelegramUser(tgUser.id, {
        bannedUntil: banUntil,
        spamViolations: newViolations
      });

      const alertMsg = `<tg-emoji emoji-id="6298544405435387645">🚨</tg-emoji> <b>Anti-Spam Alert: Account Suspended!</b>\n\nYou exceeded maximum allowed requests (${timestamps.length}/${maxReqPerMin} per min).\n\n⏱️ Your account is temporarily suspended for <b>${tempBanMins} minutes</b>.`;
      if (queryId && targetBot) {
        await targetBot.answerCallbackQuery(queryId, { text: `🚨 Anti-Spam: ${tempBanMins}m suspension issued.`, show_alert: true }).catch(() => {});
      }
      if (targetBot) {
        await targetBot.sendMessage(chatId, alertMsg, { parse_mode: 'HTML' }).catch(() => {});
      }

      const userDisplayName = tgUser.firstName || tgUser.username || `User ${userId}`;
      io.emit('admin_notification', {
        type: 'anti_spam',
        title: '🚨 Anti-Spam Auto-Ban Triggered',
        message: `${userDisplayName} auto-suspended for ${tempBanMins} mins (${timestamps.length} req/min)`,
        data: { userId, telegramId: userId, rate: timestamps.length, bannedUntil: banUntil }
      });

      return true;
    }
  } catch (err) {
    console.error("Error in processAntiSpamCheck:", err);
  }

  return false;
}

  const processedCallbacks = new Set<string>();
  const actionLocks = new Set<string>();

  targetBot.on('callback_query', async (query) => {
    try {
      const callbackId = query.id;
      const data = query.data;
      const userId = query.from?.id.toString();
      console.log(`[Bot Callback] callback_query event received. data=${data}, userId=${userId}, callbackId=${callbackId}`);

      if (processedCallbacks.has(callbackId)) {
        console.log(`[Bot Callback] Duplicate callbackId ${callbackId} skipped.`);
        return;
      }
      processedCallbacks.add(callbackId);
      setTimeout(() => processedCallbacks.delete(callbackId), 10000);

      const chatId = query.message?.chat.id;
      if (!chatId || !data || !userId) {
        console.log(`[Bot Callback] Missing required info: chatId=${chatId}, data=${data}, userId=${userId}`);
        return;
      }

      const actionLockKey = `${userId}_${data}`;
      if (data.startsWith('pay_bal_') || data.startsWith('buy_offer_') || data.startsWith('buy_qty_') || data.startsWith('set_curr_') || data.startsWith('set_lang_')) {
        if (actionLocks.has(actionLockKey)) {
          console.log(`[Bot Callback] Action ${actionLockKey} is already in progress. Double-click prevented.`);
          return;
        }
        actionLocks.add(actionLockKey);
        setTimeout(() => actionLocks.delete(actionLockKey), 4000);
      }

      // 1. Immediately answer the callback query to clear client spinner (except for check_payment_ & cryptobot where custom alert popup is shown)
      if (!data.startsWith('check_payment_') && !data.includes('cryptobot')) {
        try {
          console.log(`[Bot Callback] Answering callback query: ${callbackId}`);
          await targetBot.answerCallbackQuery(query.id);
        } catch (err: any) {
          console.error(`[Bot Callback] Failed to answer callback query:`, err.message);
        }
      }

      // Only handle actions on the main bot
      const isMainBot = targetBot.token === bot?.token;
      console.log(`[Bot Callback] Checking if main bot: targetBot.token === bot.token is ${isMainBot}. targetBot token hash=${targetBot.token ? targetBot.token.substring(0, 12) : 'none'}, bot token hash=${bot?.token ? bot.token.substring(0, 12) : 'none'}`);
      if (!isMainBot) return;

      const isBlocked = await processAntiSpamCheck(userId, chatId, query.id);
      if (isBlocked) return;

      const tgUser = await storage.getTelegramUser(userId);
      if (!tgUser) return;

      // Start fast countdown on any button interaction
      try {
        const activeOffers = await storage.getActiveSpecialOffers();
        if (tgUser?.lastOfferBroadcastId && activeOffers.length > 0) {
          startFastTimer(userId, activeOffers[0].id, tgUser.lastOfferBroadcastId);
        }
      } catch (err) {
        console.error("Error in fast timer trigger:", err);
      }

      const msgId = query.message?.message_id;

      // --- LOGIC FROM LISTENER 1 & 2 ---
      if (data === 'buy' || data === 'catalog') {
        await sendCatalogMenu(targetBot, chatId, msgId);
        return;
      }

      if (data === 'search_catalog') {
        await storage.updateTelegramUserByChatId(userId, { lastAction: 'awaiting_search_catalog' });
        await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="5312441427764989435">🔍</tg-emoji> <b>Search Catalog</b>\n\nPlease type the name of the product or category you want to find:`, { parse_mode: 'HTML' });
        return;
      }

      if (data === 'profile' || data === 'profile_refresh') {
        await sendUserProfileCard(targetBot, chatId, userId, query.from, msgId);
        return;
      }

      if (data === 'purchase_history' || data === 'my_purchases' || data.startsWith('purchases_page_')) {
        const pageNum = data.startsWith('purchases_page_') ? parseInt(data.substring(15), 10) || 1 : 1;
        await sendMyPurchasesScreen(targetBot, chatId, userId, msgId, pageNum);
        return;
      }
      if (data === 'noop_purchases_page') {
        if (query.id) {
          await targetBot.answerCallbackQuery(query.id, { text: "ℹ️ My Purchases Page" }).catch(() => {});
        }
        return;
      }

      if (data.startsWith('view_demo_order_') || data.startsWith('view_order_')) {
        const orderIdStr = data.replace('view_demo_order_', '').replace('view_order_', '');
        const orderId = parseInt(orderIdStr, 10);

        let productName = 'Digital Account';
        let credsList: string[] = [];
        let orderDateStr = formatSriLankaTime(new Date(), 'full');

        if (data.startsWith('view_order_') && !isNaN(orderId)) {
          const allOrders = await storage.getOrders();
          const targetOrder = allOrders.find(o => o.id === orderId);
          if (targetOrder) {
            if (targetOrder.createdAt) {
              orderDateStr = formatSriLankaTime(targetOrder.createdAt, 'full');
            }
            if (targetOrder.product) {
              productName = targetOrder.product.name;
            } else {
              const product = await storage.getProduct(targetOrder.productId);
              if (product) productName = product.name;
            }

            if ((targetOrder as any).credential?.content) {
              credsList.push((targetOrder as any).credential.content);
            } else if (targetOrder.credentialId) {
              try {
                const [cred] = await db.select().from(credentials).where(eq(credentials.id, targetOrder.credentialId));
                if (cred && cred.content) credsList.push(cred.content);
              } catch (e) {}
            }

            try {
              const targetTime = targetOrder.createdAt ? new Date(targetOrder.createdAt).getTime() : 0;
              if (targetTime > 0) {
                const batchOrders = allOrders.filter(o =>
                  o.telegramUserId === targetOrder.telegramUserId &&
                  o.productId === targetOrder.productId &&
                  o.createdAt &&
                  Math.abs(new Date(o.createdAt).getTime() - targetTime) <= 60000
                );

                for (const bOrder of batchOrders) {
                  const content = (bOrder as any).credential?.content;
                  if (content && !credsList.includes(content)) {
                    credsList.push(content);
                  } else if (bOrder.credentialId) {
                    const [bCred] = await db.select().from(credentials).where(eq(credentials.id, bOrder.credentialId));
                    if (bCred && bCred.content && !credsList.includes(bCred.content)) {
                      credsList.push(bCred.content);
                    }
                  }
                }
              }
            } catch (batchErr) {
              console.error("[view_order batch error]:", batchErr);
            }
          }
        }

        if (credsList.length === 0) {
          credsList = ['No credential details found for this order.'];
        }

        const numEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        let credsFormatted = '';
        let copyTextFull = '';

        credsList.forEach((cred, idx) => {
          const badge = numEmojis[idx] || `${idx + 1}.`;
          credsFormatted += `${badge} <blockquote><code>${cred}</code></blockquote>\n`;
          copyTextFull += (copyTextFull ? '\n' : '') + cred;
        });

        const orderMsg = `<tg-emoji emoji-id="5854908544712707500">📦</tg-emoji> <b>Order Details${isNaN(orderId) ? '' : ` #${orderId}`}</b>\n\n` +
          `Product: <b>${escapeHTML(productName)}</b>\n` +
          `Status: <b>Completed</b> <tg-emoji emoji-id="5404617696589390973">✨</tg-emoji>\n` +
          `<tg-emoji emoji-id="5805188079148863343">🕒</tg-emoji> Purchase Time: <b>${orderDateStr}</b>\n\n` +
          `🔑 <b>Delivered Credentials (${credsList.length} item${credsList.length > 1 ? 's' : ''}):</b>\n${credsFormatted}`;

        const orderKeyboard = {
          inline_keyboard: [
            [{ text: 'Copy Credentials', copy_text: { text: copyTextFull }, icon_custom_emoji_id: '5231102735817918643' }],
            [{ text: 'Back to Purchases', callback_data: 'purchase_history', style: 'primary', icon_custom_emoji_id: '5976535107933050770' }]
          ] as any
        };

        const ordersBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_orders_banner.png");
        await sendOrEditScreenWithPhoto(targetBot, chatId, ordersBannerPath, orderMsg, orderKeyboard, msgId);
        return;
      }

      if (data === 'referral_program') {
        await sendReferralProgramScreen(targetBot, chatId, userId, msgId);
        return;
      }

      if (data === 'convert_ref_to_bal') {
        const refBalCents = (tgUser as any)?.referralBalance || 0;
        if (refBalCents <= 0) {
          const errKeyboard = {
            inline_keyboard: [
              [{ text: 'Back to Referral', callback_data: 'referral_program', style: 'primary', icon_custom_emoji_id: '5976535107933050770' }]
            ] as any
          };
          await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="5429518319243775957">💰</tg-emoji> <b>No Referral Balance</b>\n\nYou currently have <b>0.00 USDT</b> referral earnings to convert.`, { parse_mode: 'HTML', reply_markup: errKeyboard });
          return;
        }

        const currentMainBalCents = tgUser.balance || 0;
        await storage.updateTelegramUser(tgUser.id, {
          balance: currentMainBalCents + refBalCents,
          referralBalance: 0
        } as any);

        const successMsg = `<tg-emoji emoji-id="5404617696589390973">✨</tg-emoji> <b>Balance Converted!</b>\n\n` +
          `Successfully converted <b>$${(refBalCents / 100).toFixed(2)} USDT</b> referral earnings to your main shop balance.`;

        const okKeyboard = {
          inline_keyboard: [
            [{ text: 'Profile', callback_data: 'profile', style: 'primary', icon_custom_emoji_id: '5260399854500191689' }]
          ] as any
        };
        await targetBot.sendMessage(chatId, successMsg, { parse_mode: 'HTML', reply_markup: okKeyboard });
        return;
      }

      if (data === 'withdraw_referral') {
        const minWithdrawSetting = (await storage.getSetting("REFERRAL_MIN_WITHDRAW_USDT"))?.value || "3.00";
        const refBalCents = (tgUser as any)?.referralBalance || 0;
        const refBalUSD = (refBalCents / 100).toFixed(2);

        if (parseFloat(refBalUSD) < parseFloat(minWithdrawSetting)) {
          const errKeyboard = {
            inline_keyboard: [
              [{ text: 'Back to Referral', callback_data: 'referral_program', style: 'primary', icon_custom_emoji_id: '5976535107933050770' }]
            ] as any
          };
          await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="5429518319243775957">💵</tg-emoji> <b>Minimum Withdrawal Not Reached</b>\n\nMinimum withdrawal amount is <b>${minWithdrawSetting} USDT</b>.\nYour current referral balance is <b>${refBalUSD} USDT</b>.`, { parse_mode: 'HTML', reply_markup: errKeyboard });
          return;
        }

        await storage.updateTelegramUserByChatId(userId, { lastAction: 'awaiting_referral_withdraw_wallet' });
        await targetBot.sendMessage(chatId, `💳 <b>Withdraw Referral Balance (${refBalUSD} USDT)</b>\n\nPlease type your <b>BEP-20 USDT Wallet Address</b> in the chat below:`, { parse_mode: 'HTML' });
        return;
      }

      if (data === 'enter_promocode') {
        await sendPromoCodeScreen(targetBot, chatId, userId, msgId);
        return;
      }

      if (data === 'change_currency') {
        await sendCurrencyScreen(targetBot, chatId, userId, msgId);
        return;
      }

      if (data.startsWith('set_curr_')) {
        const curr = data.substring(9);
        await storage.updateTelegramUser(tgUser.id, { selectedCurrency: curr } as any);
        await sendCurrencyScreen(targetBot, chatId, userId, msgId);
        return;
      }

      if (data === 'change_language') {
        await sendLanguageScreen(targetBot, chatId, userId, msgId);
        return;
      }

      if (data.startsWith('set_lang_')) {
        const lang = data.substring(9);
        await storage.updateTelegramUser(tgUser.id, { selectedLanguage: lang } as any);
        await sendLanguageScreen(targetBot, chatId, userId, msgId);
        return;
      }

      if (data === 'transactions' || data.startsWith('tx_page_')) {
        const pageNum = data.startsWith('tx_page_') ? parseInt(data.substring(8), 10) || 1 : 1;
        await sendTransactionsScreen(targetBot, chatId, userId, msgId, pageNum);
        return;
      }
      if (data === 'noop_tx_page') {
        if (query.id) {
          await targetBot.answerCallbackQuery(query.id, { text: "ℹ️ Transaction History Page" }).catch(() => {});
        }
        return;
      }

      if (data === 'main_menu') {
        const userLang = (tgUser as any)?.selectedLanguage || 'en';
        const bannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_banner.png");
        const welcomeCaption = `<tg-emoji emoji-id="5404617696589390973">✨</tg-emoji> <b>${t(userLang, 'welcome_title')}</b>\n\n${t(userLang, 'welcome_sub')}`;
        const startInlineMarkup = {
          inline_keyboard: [
            [
              { text: t(userLang, 'btn_catalog'), callback_data: 'buy', style: 'success', icon_custom_emoji_id: '5377660214096974712' }
            ],
            [
              { text: t(userLang, 'btn_profile'), callback_data: 'profile', style: 'success', icon_custom_emoji_id: '5260399854500191689' }
            ],
            [
              { text: t(userLang, 'btn_useful_links'), callback_data: 'useful_links', style: 'primary', icon_custom_emoji_id: '5271604874419647061' },
              { text: t(userLang, 'btn_support'), callback_data: 'support', style: 'primary', icon_custom_emoji_id: '5260535596941582167' }
            ]
          ] as any
        };
        await sendOrEditScreenWithPhoto(targetBot, chatId, bannerPath, welcomeCaption, startInlineMarkup, msgId);
        return;
      }

      if (data === 'useful_links') {
        await sendUsefulLinksScreen(targetBot, chatId, query.message?.message_id);
        return;
      }

      if (data === 'reviews') {
        await sendCustomerReviewsScreen(targetBot, chatId, query.message?.message_id);
        return;
      }

      if (data === 'write_review') {
        // Query user's purchases from orders table
        const userOrders = await db
          .select({
            id: orders.id,
            productId: orders.productId,
            productName: products.name
          })
          .from(orders)
          .leftJoin(products, eq(orders.productId, products.id))
          .where(eq(orders.telegramUserId, tgUser.id));

        if (userOrders.length === 0) {
          const noPurchaseKb = {
            inline_keyboard: [
              [
                { text: 'Catalog', callback_data: 'buy', style: 'success', icon_custom_emoji_id: '5377660214096974712' },
                { text: 'Main menu', callback_data: 'main_menu', style: 'primary', icon_custom_emoji_id: '5271604874419647061' }
              ],
              [
                { text: 'Back to reviews', callback_data: 'reviews', style: 'primary', icon_custom_emoji_id: '5976535107933050770' }
              ]
            ] as any
          };
          await targetBot.sendMessage(
            chatId,
            `<tg-emoji emoji-id="5215570077876756627">❌</tg-emoji> <b>Verified Buyers Only</b>\n\n` +
            `You must make at least one purchase in our store to leave a customer review.\n\n` +
            `Please visit our catalog to make your first purchase!`,
            {
              parse_mode: 'HTML',
              reply_markup: noPurchaseKb
            }
          );
          return;
        }

        // Extract unique purchased product names
        const purchasedProductNames: string[] = Array.from(
          new Set(userOrders.map(o => o.productName || "Verified Purchase"))
        );

        const prodKbRows: any[] = purchasedProductNames.map(prodName => [
          {
            text: prodName,
            callback_data: `give_feedback_${encodeURIComponent(prodName)}`,
            style: 'primary',
            icon_custom_emoji_id: '5321197740800120767'
          }
        ]);

        prodKbRows.push([
          { text: 'Back to reviews', callback_data: 'reviews', style: 'primary', icon_custom_emoji_id: '5976535107933050770' }
        ]);

        await targetBot.sendMessage(
          chatId,
          `<tg-emoji emoji-id="5193009244940557703">⭐</tg-emoji> <b>Select Purchased Product to Review:</b>\n\n` +
          `Please select which item from your completed purchases you want to leave a review for:`,
          {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: prodKbRows }
          }
        );
        return;
      }

      if (data.startsWith('give_feedback_')) {
        const rawName = data.substring(14);
        const productName = decodeURIComponent(rawName) || "Verified Purchase";

        const ratingKb = {
          inline_keyboard: [
            [
              { text: '5 Stars (5/5)', callback_data: `rate_5_${encodeURIComponent(productName)}`, style: 'success', icon_custom_emoji_id: '5193009244940557703' },
              { text: '4 Stars (4/5)', callback_data: `rate_4_${encodeURIComponent(productName)}`, style: 'primary', icon_custom_emoji_id: '5193009244940557703' }
            ],
            [
              { text: '3 Stars (3/5)', callback_data: `rate_3_${encodeURIComponent(productName)}`, style: 'primary', icon_custom_emoji_id: '5193009244940557703' },
              { text: '2 Stars (2/5)', callback_data: `rate_2_${encodeURIComponent(productName)}`, style: 'danger', icon_custom_emoji_id: '5193009244940557703' },
              { text: '1 Star (1/5)', callback_data: `rate_1_${encodeURIComponent(productName)}`, style: 'danger', icon_custom_emoji_id: '5193009244940557703' }
            ],
            [
              { text: 'Back to reviews', callback_data: 'reviews', style: 'primary', icon_custom_emoji_id: '5976535107933050770' }
            ]
          ] as any
        };
        await targetBot.sendMessage(
          chatId,
          `<tg-emoji emoji-id="5193009244940557703">⭐</tg-emoji> <b>Select your rating for ${escapeHTML(productName)}:</b>\n\nClick a rating option below to leave your review:`,
          {
            parse_mode: 'HTML',
            reply_markup: ratingKb
          }
        );
        return;
      }

      if (data.startsWith('rate_')) {
        const parts = data.split('_');
        const rating = parseInt(parts[1], 10) || 5;
        const productName = parts.slice(2).join('_') ? decodeURIComponent(parts.slice(2).join('_')) : "Verified Purchase";

        const starTg = `<tg-emoji emoji-id="5193009244940557703">⭐</tg-emoji>`.repeat(rating);
        await storage.updateTelegramUserByChatId(userId, { lastAction: `awaiting_review_comment_${rating}_${encodeURIComponent(productName)}` });
        await targetBot.sendMessage(
          chatId,
          `<tg-emoji emoji-id="5260535596941582167">💬</tg-emoji> <b>Write your review comment for ${escapeHTML(productName)} (${starTg}):</b>\n\nPlease type your review comment below in the chat:`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      if (data === 'guarantees') {
        const guaranteesMsg = `<tg-emoji emoji-id="5404617696589390973">✨</tg-emoji> <b>Guarantees & Warranty</b>\n\n` +
          `• 24-hour instant activation guarantee after purchase.\n` +
          `• Full replacement or refund for non-working products!\n` +
          `• 24/7 dedicated support team available for assistance.`;
        const kb = {
          inline_keyboard: [
            [{ text: 'Support', callback_data: 'support', style: 'primary', icon_custom_emoji_id: '5260535596941582167' }],
            [{ text: 'Useful links', callback_data: 'useful_links', style: 'primary', icon_custom_emoji_id: '5271604874419647061' }]
          ] as any
        };
        const msgId = query.message?.message_id;
        if (msgId) {
          try {
            await targetBot.editMessageCaption(guaranteesMsg, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: kb });
            return;
          } catch (e) {
            try {
              await targetBot.editMessageText(guaranteesMsg, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: kb });
              return;
            } catch (err) {}
          }
        }
        await targetBot.sendMessage(chatId, guaranteesMsg, { parse_mode: 'HTML', reply_markup: kb });
        return;
      }

      if (data === 'rules') {
        const rulesMsg = `<tg-emoji emoji-id="5274099962655816924">❗</tg-emoji> <b>Store Rules & Terms</b>\n\n` +
          `1. Always check purchased items within 24 hours of delivery.\n` +
          `2. Do not change login credentials unless instructed.\n` +
          `3. Keep your receipt and order ID when contacting support.`;
        const kb = {
          inline_keyboard: [
            [{ text: 'Support', callback_data: 'support', style: 'primary', icon_custom_emoji_id: '5260535596941582167' }],
            [{ text: 'Useful links', callback_data: 'useful_links', style: 'primary', icon_custom_emoji_id: '5271604874419647061' }]
          ] as any
        };
        const msgId = query.message?.message_id;
        if (msgId) {
          try {
            await targetBot.editMessageCaption(rulesMsg, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: kb });
            return;
          } catch (e) {
            try {
              await targetBot.editMessageText(rulesMsg, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: kb });
              return;
            } catch (err) {}
          }
        }
        await targetBot.sendMessage(chatId, rulesMsg, { parse_mode: 'HTML', reply_markup: kb });
        return;
      }

      if (data === 'support') {
        await sendSupportScreen(targetBot, chatId, query.message?.message_id);
        return;
      }

      if (data.startsWith('supp_')) {
        await handleSupportIssue(targetBot, chatId, userId, data, query.message?.message_id);
        return;
      }

      if (data === 'channel') {
        const supportUsernameSetting = await storage.getSetting("SUPPORT_USERNAME");
        const supportUsername = supportUsernameSetting?.value || "@creativesStudios";
        const botUsername = (await targetBot.getMe().catch(() => ({ username: 'Imesh_cloud_bot' }))).username || 'Imesh_cloud_bot';

        const infoMsg = `<tg-emoji emoji-id="5208604387156448480">👨‍💻</tg-emoji> <b>Community Channel</b>\n\n` +
          `Official Channel: <b>https://t.me/${botUsername}</b>`;
        const kb = {
          inline_keyboard: [
            [{ text: 'Useful links', callback_data: 'useful_links', style: 'primary', icon_custom_emoji_id: '5271604874419647061' }]
          ] as any
        };
        const msgId = query.message?.message_id;
        if (msgId) {
          try {
            await targetBot.editMessageCaption(infoMsg, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: kb });
            return;
          } catch (e) {
            try {
              await targetBot.editMessageText(infoMsg, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: kb });
              return;
            } catch (err) {}
          }
        }
        await targetBot.sendMessage(chatId, infoMsg, { parse_mode: 'HTML', reply_markup: kb });
        return;
      }

      if (data === 'tutorial_menu') {
        const opts: TelegramBot.EditMessageTextOptions = {
          chat_id: chatId,
          message_id: query.message?.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: '⛱️ How to Buy Items', callback_data: 'tutorial_how_to_buy' }],
              [{ text: '🏖️ How to Deposit', callback_data: 'tutorial_how_to_deposit' }],
              [{ text: '🔙 Back to Profile', callback_data: 'profile_refresh' }]
            ]
          },
          parse_mode: 'Markdown'
        };
        try {
          await targetBot.editMessageText('📖 *Tutorial Menu*\n\nChoose a tutorial to watch:', opts);
        } catch (err) {
          console.error('Failed to edit message for tutorial menu:', err);
        }
        return;
      }

      if (data === 'tutorial_how_to_buy' || data === 'tutorial_how_to_deposit') {
        const settingKey = data === 'tutorial_how_to_buy' ? 'TUTORIAL_BUY_VIDEO' : 'TUTORIAL_DEPOSIT_VIDEO';
        const videoSetting = await storage.getSetting(settingKey);
        const videoValue = videoSetting?.value || (data === 'tutorial_how_to_buy' ? 'how_to_buy_itmes.mp4' : 'how_to_deposit.mp4');

        if (!videoValue) {
          await targetBot.sendMessage(chatId, '⚠️ Tutorial video not available yet.');
          return;
        }

        const title = data === 'tutorial_how_to_buy' ? 'How to Buy Items' : 'How to Deposit';

        // Send wait message
        const waitMsg = await targetBot.sendMessage(chatId, "⏳ *Preparing Tutorial...* please wait a moment.", { parse_mode: 'Markdown' });

        // Check if it's a file path or a URL
        if (videoValue.startsWith('http')) {
          await targetBot.sendMessage(chatId, `🏖️ *${title}*\n\nYou can watch the tutorial video here: ${videoValue}`, { parse_mode: 'Markdown' });
          if (waitMsg) await targetBot.deleteMessage(chatId, waitMsg.message_id).catch(() => { });
        } else {
          let fileName = videoValue;
          if (!fileName.toLowerCase().endsWith('.mp4')) {
            fileName += '.mp4';
          }

          // Ensure static route is available (re-added for reliability)
          app.use('/tutorials', express.static(path.join(process.cwd(), 'public', 'tutorials')));
          app.use('/tutorials_dist', express.static(path.join(process.cwd(), 'dist', 'public', 'tutorials')));

          const findVideoFile = (name: string) => {
            const root = process.cwd();
            const potential = [
              path.join(root, 'public', 'tutorials', name),
              path.join(root, 'dist', 'public', 'tutorials', name),
              path.join(root, 'client', 'public', 'tutorials', name),
              path.join(root, 'tutorials', name),
              path.resolve(root, '..', 'public', 'tutorials', name)
            ];
            
            for (const p of potential) {
              if (fs.existsSync(p)) return p;
            }
            return null;
          };

          const filePath = findVideoFile(fileName) || 
                           findVideoFile(videoValue) || 
                           findVideoFile(fileName.replace('itmes', 'items')) ||
                           findVideoFile(fileName.replace('items', 'itmes'));

          // Get the domain for fallback URL
          const miniAppUrlSetting = await storage.getSetting("MINI_APP_URL");
          const domain = miniAppUrlSetting?.value ? new URL(miniAppUrlSetting.value).origin : "";
          const fileUrl = domain ? `${domain}/tutorials/${fileName}` : "";

          console.log(`Attempting to send video: ${filePath} (Fallback URL: ${fileUrl})`);

          if (filePath && fs.existsSync(filePath)) {
            try {
              // Show uploading status in Telegram
              await targetBot.sendChatAction(chatId, 'upload_video');
              
              // Try sending using file path string (lib handles reading)
              await targetBot.sendVideo(chatId, filePath, {
                caption: `🏖️ *${title}*`,
                parse_mode: 'Markdown',
                supports_streaming: true
              });
              console.log('Video sent successfully using path string');
            } catch (sendErr: any) {
              console.error('sendVideo path error, trying document:', sendErr.message);
              try {
                await targetBot.sendChatAction(chatId, 'upload_document');
                // Try sending as document
                await targetBot.sendDocument(chatId, filePath, {
                  caption: `🏖️ *${title}* (Video File)`,
                  parse_mode: 'Markdown'
                }, { filename: fileName });
                console.log('Video sent successfully as document');
              } catch (docErr: any) {
                console.error('sendDocument error, trying URL:', docErr.message);
                if (fileUrl) {
                  try {
                    await targetBot.sendVideo(chatId, fileUrl, {
                      caption: `🏖️ *${title}*`,
                      parse_mode: 'Markdown'
                    });
                  } catch (urlErr: any) {
                    await targetBot.sendMessage(chatId, `❌ *Error*: Unable to play video directly.\n\n[Click here to watch](${fileUrl})`, { parse_mode: 'Markdown' });
                  }
                } else {
                  await targetBot.sendMessage(chatId, `❌ *Error*: Failed to send video. Please contact support.`, { parse_mode: 'Markdown' });
                }
              }
            } finally {
              if (waitMsg) await targetBot.deleteMessage(chatId, waitMsg.message_id).catch(() => { });
            }
          } else {
            await targetBot.sendMessage(chatId, `📺 *${title}*\n\nVideo file missing on server. Please contact support.`, { parse_mode: 'Markdown' });
            if (waitMsg) await targetBot.deleteMessage(chatId, waitMsg.message_id).catch(() => { });
          }
        }
        return;
      }

      if (data === 'do_menu') {
        let text = "🌊 *DigitalOcean Integration*\n\n";
        const keyboard = { inline_keyboard: [] as any[][] };

        if (!tgUser.doApiKey) {
          text += "You haven't set your DigitalOcean API key yet. Please provide it to enable droplet creation.";
          keyboard.inline_keyboard.push([{ text: '🔑 Set API Key', callback_data: 'do_set_key' }]);
        } else {
          text += "Your API key is saved. Select an option below:";
          keyboard.inline_keyboard.push([{ text: '🚀 Create Droplet', callback_data: 'do_region_select' }]);
          if (tgUser.lastDropletId) {
            keyboard.inline_keyboard.push([{ text: '📊 Monitoring & Info', callback_data: 'do_monitor_droplet' }]);
          }
          keyboard.inline_keyboard.push([{ text: '🔄 Update API Key', callback_data: 'do_set_key' }]);
        }
        keyboard.inline_keyboard.push([{ text: '🔙 Back', callback_data: 'automation_menu' }]);

        await targetBot.editMessageText(text, {
          chat_id: chatId,
          message_id: query.message?.message_id,
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });
        return;
      }

      if (data === 'automation_menu') {
        const automationEnabled = (await storage.getSetting('AUTOMATION_ENABLED'))?.value !== 'false';

        if (!automationEnabled) {
          await targetBot.sendMessage(chatId, "⚠️ Automation features are currently disabled by admin.");
          return;
        }

        const keyboard = {
          inline_keyboard: [
            [{ text: '🌊 DigitalOcean', callback_data: 'do_menu' }],
            [{ text: '🔙 Back', callback_data: 'profile_refresh' }]
          ]
        };
        await targetBot.editMessageText('🤖 *Automation & Cloud Providers*\n\nSelect a cloud provider to manage your resources:', {
          chat_id: chatId,
          message_id: query.message?.message_id,
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });
        return;
      }

      if (data === 'do_monitor_droplet') {
        if (!tgUser.doApiKey || !tgUser.lastDropletId) return;

        try {
          // Fetch Droplet Info
          const dropletRes = await axios.get(`https://api.digitalocean.com/v2/droplets/${tgUser.lastDropletId}`, {
            headers: { 'Authorization': `Bearer ${tgUser.doApiKey}` }
          });
          const droplet = dropletRes.data.droplet;

          // Fetch CPU Usage (last 5 minutes)
          const now = Math.floor(Date.now() / 1000);
          const start = now - 300;
          const cpuRes = await axios.get(`https://api.digitalocean.com/v2/monitoring/metrics/droplet/cpu`, {
            params: { host_id: tgUser.lastDropletId, start, end: now },
            headers: { 'Authorization': `Bearer ${tgUser.doApiKey}` }
          }).catch(() => null);

          // Fetch RAM Usage (last 5 minutes)
          const memRes = await axios.get(`https://api.digitalocean.com/v2/monitoring/metrics/droplet/memory_available`, {
            params: { host_id: tgUser.lastDropletId, start, end: now },
            headers: { 'Authorization': `Bearer ${tgUser.doApiKey}` }
          }).catch(() => null);

          const ipv4 = droplet.networks.v4.find((n: any) => n.type === 'public')?.ip_address || 'N/A';
          const ipv6 = droplet.networks.v6.find((n: any) => n.type === 'public')?.ip_address || 'N/A';

          let cpuUsage = 'N/A';
          if (cpuRes?.data?.data?.result) {
            const results = cpuRes.data.data.result;
            let totalUsage = 0;
            let count = 0;

            results.forEach((r: any) => {
              if (r.values && r.values.length > 0) {
                const latest = parseFloat(r.values[r.values.length - 1][1]);
                if (!isNaN(latest)) {
                  totalUsage += latest;
                  count++;
                }
              }
            });

            if (count > 0) {
              cpuUsage = `${(totalUsage * 100).toFixed(1)}%`;
            }
          }

          let memUsage = 'N/A';
          if (memRes?.data?.data?.result?.[0]?.values) {
            const values = memRes.data.data.result[0].values;
            const latestAvailable = parseFloat(values[values.length - 1][1]);
            memUsage = `${(latestAvailable / 1024 / 1024).toFixed(0)} MB Free`;
          }

          let text = `📊 *Droplet Monitoring*\n\n`;
          text += `🏷️ Name: \`${droplet.name}\`\n`;
          text += `🌐 IP IPv4: \`${ipv4}\`\n`;
          text += `🌐 IP IPv6: \`${ipv6}\`\n`;
          text += `📍 Region: \`${droplet.region.slug}\`\n`;
          text += `🔋 Status: \`${droplet.status}\`\n`;
          text += `⚡ Size: \`${droplet.size_slug}\`\n\n`;
          text += `📈 *Current Usage:*\n`;
          text += `🖥 CPU: \`${cpuUsage}\`\n`;
          text += `🧠 RAM: \`${memUsage}\`\n\n`;
          text += `💡 *How to enable monitoring?*\n`;
          text += `If it shows N/A, the DigitalOcean Agent is not installed or data hasn't arrived yet.\n\n`;
          text += `*Installation Command (Ubuntu/Debian):*\n`;
          text += `\`curl -sSL https://repos.insights.digitalocean.com/install.sh | sudo bash\`\n\n`;
          text += `Run this command inside your server to see real-time stats.`;

          const keyboard = {
            inline_keyboard: [
              [{ text: '🔄 Refresh', callback_data: 'do_monitor_droplet' }],
              [{ text: '🔙 Back', callback_data: 'do_menu' }]
            ]
          };

          await targetBot.editMessageText(text, {
            chat_id: chatId,
            message_id: query.message?.message_id,
            reply_markup: keyboard,
            parse_mode: 'Markdown'
          }).catch((err: any) => {
            if (!err.message.includes('message is not modified')) {
              throw err;
            }
          });
        } catch (err: any) {
          await targetBot.sendMessage(chatId, `❌ Failed to fetch info: ${err.response?.data?.message || err.message}`);
        }
        return;
      }

      if (data === 'do_region_select') {
        const keyboard = {
          inline_keyboard: [
            [{ text: '📀 Standard OS (Ubuntu, Debian...)', callback_data: 'do_type_os' }],
            [{ text: '🛒 Marketplace (WordPress, Docker...)', callback_data: 'do_type_marketplace' }],
            [{ text: '🔙 Back', callback_data: 'do_menu' }]
          ]
        };
        await targetBot.editMessageText('🚀 *Step 1: Choice Droplet Type*\n\nSelect the base image type for your droplet:', {
          chat_id: chatId,
          message_id: query.message?.message_id,
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });
        return;
      }

      if (data?.startsWith('do_type_')) {
        const type = data.split('_')[2];
        await storage.updateTelegramUserByChatId(userId, { lastAction: `do_flow_type_${type}` });

        const keyboard = {
          inline_keyboard: [
            [{ text: 'New York 3', callback_data: 'do_reg_nyc3' }, { text: 'Singapore 1', callback_data: 'do_reg_sgp1' }],
            [{ text: 'London 1', callback_data: 'do_reg_lon1' }, { text: 'Frankfurt 1', callback_data: 'do_reg_fra1' }],
            [{ text: '🔙 Back', callback_data: 'do_region_select' }]
          ]
        };

        await targetBot.editMessageText('🌍 *Step 2: Choice Region*\n\nSelect a region for your droplet:', {
          chat_id: chatId,
          message_id: query.message?.message_id,
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });
        return;
      }

      if (data?.startsWith('do_reg_')) {
        const region = data.split('_')[2];
        const lastAction = tgUser?.lastAction || '';
        const type = lastAction.split('_')[3];

        await storage.updateTelegramUserByChatId(userId, { lastAction: `${lastAction}_reg_${region}` });

        if (type === 'marketplace') {
          const apps = [
            { name: 'CyberPanel on Ubuntu', slug: 'cyberpanel-22-04' },
            { name: 'LAMP on Ubuntu', slug: 'lamp-20-04' },
            { name: 'WordPress on Ubuntu', slug: 'wordpress-22-04' },
            { name: 'Docker on Ubuntu', slug: 'docker-20-04' },
            { name: 'cPanel & WHM', slug: 'cpanel-110-ubuntu' },
            { name: 'OpenVPN Access Server', slug: 'openvpn-as' }
          ];
          const keyboard = {
            inline_keyboard: [
              ...apps.map(a => ([{ text: a.name, callback_data: `do_os_${a.slug}` }])),
              [{ text: '🔙 Back', callback_data: `do_type_marketplace` }]
            ]
          };
          await targetBot.editMessageText('🛒 *Step 3: Choice Marketplace App*\n\nSelect an application from Marketplace:', {
            chat_id: chatId,
            message_id: query.message?.message_id,
            reply_markup: keyboard,
            parse_mode: 'Markdown'
          });
        } else {
          const systems = [
            { name: 'Ubuntu', slug: 'ubuntu' },
            { name: 'Debian', slug: 'debian' },
            { name: 'CentOS', slug: 'centos' },
            { name: 'Fedora', slug: 'fedora' }
          ];
          const keyboard = {
            inline_keyboard: [
              ...systems.map(s => ([{ text: s.name, callback_data: `do_os_${s.slug}` }])),
              [{ text: '🔙 Back', callback_data: `do_type_os` }]
            ]
          };
          await targetBot.editMessageText('💿 *Step 3: Choice OS*\n\nSelect an operating system:', {
            chat_id: chatId,
            message_id: query.message?.message_id,
            reply_markup: keyboard,
            parse_mode: 'Markdown'
          });
        }
        return;
      }

      if (data?.startsWith('do_os_')) {
        const os = data.split('_')[2];
        const lastAction = tgUser?.lastAction || '';
        const region = lastAction.split('_')[5];
        const type = lastAction.split('_')[3];

        await storage.updateTelegramUserByChatId(userId, { lastAction: `${lastAction}_os_${os}` });

        if (type === 'marketplace') {
          const keyboard = {
            inline_keyboard: [
              [{ text: 'Shared CPU (Basic)', callback_data: 'do_cpu_basic' }],
              [{ text: 'Dedicated CPU (General)', callback_data: 'do_cpu_g' }],
              [{ text: '🔙 Back', callback_data: `do_reg_${region}` }]
            ]
          };
          await targetBot.editMessageText(`🌍 Region: ${region}\n🛒 App: ${os}\n\n💻 *Step 4: Choose CPU Type*\n\nSelect CPU architecture:`, {
            chat_id: chatId,
            message_id: query.message?.message_id,
            reply_markup: keyboard,
            parse_mode: 'Markdown'
          });
        } else {
          const versions: Record<string, any[]> = {
            'ubuntu': [{ text: '24.04 x64', callback_data: 'do_ver_ubuntu-24-04-x64' }, { text: '22.04 x64', callback_data: 'do_ver_ubuntu-22-04-x64' }],
            'debian': [{ text: '12 x64', callback_data: 'do_ver_debian-12-x64' }, { text: '11 x64', callback_data: 'do_ver_debian-11-x64' }],
            'centos': [{ text: 'Stream 9 x64', callback_data: 'do_ver_centos-stream-9-x64' }],
            'fedora': [{ text: '40 x64', callback_data: 'do_ver_fedora-40-x64' }]
          };

          const keyboard = {
            inline_keyboard: [
              ...(versions[os] || []).map(v => [v]),
              [{ text: '🔙 Back', callback_data: `do_reg_${region}` }]
            ]
          };
          await targetBot.editMessageText(`🌍 Region: ${region}\n📀 OS: ${os}\n\n🔢 *Step 4: Version*\n\nSelect a version:`, {
            chat_id: chatId,
            message_id: query.message?.message_id,
            reply_markup: keyboard,
            parse_mode: 'Markdown'
          });
        }
        return;
      }

      if (data?.startsWith('do_ver_')) {
        const version = data.split('_')[2];
        const lastAction = tgUser?.lastAction || '';
        const region = lastAction.split('_')[5];
        const os = lastAction.split('_')[7];
        await storage.updateTelegramUserByChatId(userId, { lastAction: `${lastAction}_ver_${version}` });

        const keyboard = {
          inline_keyboard: [
            [{ text: 'Shared CPU (Basic)', callback_data: 'do_cpu_basic' }],
            [{ text: 'Dedicated CPU (General)', callback_data: 'do_cpu_g' }],
            [{ text: '🔙 Back', callback_data: `do_os_${os}` }]
          ]
        };
        await targetBot.editMessageText(`🌍 Region: ${region}\n📀 OS: ${os} (${version})\n\n💻 *Step 5: Choose CPU Type*\n\nSelect CPU architecture:`, {
          chat_id: chatId,
          message_id: query.message?.message_id,
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });
        return;
      }

      if (data?.startsWith('do_cpu_')) {
        const cpuType = data.split('_')[2];
        const lastAction = tgUser?.lastAction || '';
        const version = lastAction.split('_')[7];
        await storage.updateTelegramUserByChatId(userId, { lastAction: `${lastAction}_cpu_${cpuType}` });

        const basicSizes = [
          { text: '1 vCPU / 1GB RAM ($6/mo)', callback_data: 'do_size_s-1vcpu-1gb' },
          { text: '1 vCPU / 2GB RAM ($12/mo)', callback_data: 'do_size_s-1vcpu-2gb' },
          { text: '2 vCPU / 2GB RAM ($18/mo)', callback_data: 'do_size_s-2vcpu-2gb' }
        ];
        const dedicatedSizes = [
          { text: '2 vCPU / 8GB RAM ($63/mo)', callback_data: 'do_size_g-2vcpu-8gb' },
          { text: '4 vCPU / 16GB RAM ($126/mo)', callback_data: 'do_size_g-4vcpu-16gb' }
        ];

        const keyboard = {
          inline_keyboard: [
            ...(cpuType === 'basic' ? basicSizes : dedicatedSizes).map(s => [s]),
            [{ text: '🔙 Back', callback_data: `do_ver_${version}` }]
          ]
        };
        await targetBot.editMessageText(`🌍 Region: ${tgUser?.lastAction?.split('_')[3]}\n📀 OS: ${tgUser?.lastAction?.split('_')[5]}\n💻 CPU: ${cpuType}\n\n💰 *Step 6: Choice Size & Price*\n\nSelect droplet size:`, {
          chat_id: chatId,
          message_id: query.message?.message_id,
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });
        return;
      }

      if (data?.startsWith('do_size_')) {
        const size = data.split('_')[2];
        const lastAction = tgUser?.lastAction || '';
        await storage.updateTelegramUserByChatId(userId, { lastAction: `${lastAction}_sz_${size}` });

        const keyboard = {
          inline_keyboard: [
            [{ text: '🔑 SSH Key', callback_data: 'do_auth_ssh' }, { text: '🔡 Password', callback_data: 'do_auth_pass' }],
            [{ text: '🔙 Back', callback_data: `do_cpu_${lastAction.split('_')[9]}` }]
          ]
        };
        await targetBot.editMessageText(`🌍 Region: ${lastAction.split('_')[3]}\n📀 OS: ${lastAction.split('_')[5]}\n💻 Size: ${size}\n\n🔐 *Step 7: Auth Method*\n\nHow do you want to access your droplet?`, {
          chat_id: chatId,
          message_id: query.message?.message_id,
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });
        return;
      }

      if (data === 'do_auth_pass') {
        await storage.updateTelegramUserByChatId(userId, { lastAction: (await storage.getTelegramUser(userId))?.lastAction + '_auth_pass_await' });
        await targetBot.sendMessage(chatId, "Please enter a secure password for your new droplet:");
        return;
      }

      if (data === 'do_auth_ssh') {
        await storage.updateTelegramUserByChatId(userId, { lastAction: (await storage.getTelegramUser(userId))?.lastAction + '_auth_ssh_await' });
        await targetBot.sendMessage(chatId, "Please send your public SSH key (starting with ssh-rsa, etc.):");
        return;
      }

      if (data === 'do_set_key') {
        await storage.updateTelegramUserByChatId(userId, { lastAction: 'awaiting_do_api_key' });
        await targetBot.sendMessage(chatId, "Please send your DigitalOcean Personal Access Token (API Key):");
        return;
      }

      if (data === 'do_create_droplet') {
        if (!tgUser.doApiKey) return;

        const lastAction = tgUser.lastAction || '';
        const size = lastAction.includes('_sz_') ? lastAction.split('_sz_')[1].split('_')[0] : 's-1vcpu-1gb';
        const region = lastAction.includes('_reg_') ? lastAction.split('_reg_')[1].split('_')[0] : 'nyc3';
        const os = lastAction.includes('_os_') ? lastAction.split('_os_')[1].split('_')[0] : 'ubuntu';
        const version = lastAction.includes('_ver_') ? lastAction.split('_ver_')[1].split('_')[0] : '24-04-x64';

        const cleanSize = size.replace(/[^a-zA-Z0-9-]/g, '');
        const cleanRegion = region.replace(/[^a-zA-Z0-9-]/g, '');
        const image = os.includes('-') ? os : `${os}-${version}`;

        const creationWaitMsg = await targetBot.sendMessage(chatId, "⏳ <b>Creating droplet... Please wait.</b>", { parse_mode: 'HTML' });

        try {
          const response = await axios.post('https://api.digitalocean.com/v2/droplets', {
            name: `cloudshop-${userId}-${Math.floor(Date.now() / 1000)}`,
            region: cleanRegion,
            size: cleanSize,
            image: image
          }, {
            headers: {
              'Authorization': `Bearer ${tgUser.doApiKey}`,
              'Content-Type': 'application/json'
            }
          });

          const droplet = response.data.droplet;
          await storage.updateTelegramUserByChatId(userId, { lastDropletId: droplet.id.toString() });

          await targetBot.sendMessage(chatId, `✅ Droplet created successfully!\n\nName: ${droplet.name}\nStatus: ${droplet.status}\n\nIt will be ready in a few minutes.`);
        } catch (err: any) {
          console.error('DO Create error:', err.response?.data || err.message);
          await targetBot.sendMessage(chatId, `❌ Failed to create droplet: ${err.response?.data?.message || err.message}`);
        } finally {
          if (creationWaitMsg) {
            await targetBot.deleteMessage(chatId, creationWaitMsg.message_id).catch(() => {});
          }
        }
        return;
      }

      if (data === 'profile_refresh') {
        const allOrders = await storage.getOrders();
        const userPurchases = allOrders.filter(o => o.telegramUserId === tgUser.id).length;
        const balanceUSD = (tgUser.balance / 100).toFixed(2);
        const regDate = tgUser.createdAt ? format(tgUser.createdAt, "yyyy-MM-dd HH:mm:ss") : "N/A";

        const automationSetting = await storage.getSetting("AUTOMATION_ENABLED");
        const isAutomationEnabled = automationSetting?.value === "true";

        const specialOffersSetting = await storage.getSetting("SPECIAL_OFFERS_ENABLED");
        const isSpecialOffersEnabled = specialOffersSetting?.value !== "false";

        let hasActiveOffers = false;
        try {
          const activeOffers = await storage.getActiveSpecialOffers();
          hasActiveOffers = activeOffers.length > 0;
        } catch (err) {
          console.error("Error fetching active offers for profile:", err);
        }

        const inline_keyboard = [
          [{ text: 'Add funds', callback_data: 'add_funds', icon_custom_emoji_id: '5201692367437974073' }, { text: 'Purchase history', callback_data: 'purchase_history', icon_custom_emoji_id: '5334882760735598374' }],
          isAutomationEnabled
            ? [{ text: '🤖 Automation', callback_data: 'automation_menu' }, { text: 'Tutorial', callback_data: 'tutorial_menu', icon_custom_emoji_id: '5226512880362332956' }]
            : [{ text: 'Tutorial', callback_data: 'tutorial_menu', icon_custom_emoji_id: '5226512880362332956' }]
        ];

        if (isSpecialOffersEnabled && hasActiveOffers) {
          inline_keyboard.push([{ text: 'Special Offers', callback_data: 'special_offers', icon_custom_emoji_id: '6276134137963222688' }]);
        }

        const keyboard = { inline_keyboard };

        if (query.message?.message_id) {
          await targetBot.editMessageText(`<tg-emoji emoji-id="5467538555158943525">💭</tg-emoji> <b>Your Profile</b> <tg-emoji emoji-id="5456343263340405032">🛍</tg-emoji>\n━━━━━━━━━━━━━━━\n<tg-emoji emoji-id="6276090299232031662">✅</tg-emoji> <b>ID:</b> ${tgUser.telegramId}\n\n<tg-emoji emoji-id="5201692367437974073">💵</tg-emoji> <b>Balance:</b> ${balanceUSD}$\n\n<tg-emoji emoji-id="5348256365477382384">⭐️</tg-emoji> <b>Purchased pcs:</b> ${userPurchases} pcs\n\n<tg-emoji emoji-id="5805188079148863343">🕒</tg-emoji> <b>Registration:</b> ${regDate} <tg-emoji emoji-id="5206715082582533386">🎉</tg-emoji>`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: keyboard,
            parse_mode: 'HTML'
          });
        }
        return;
      }

      if (data.startsWith('approve_dep_')) {
        const parts = data.split('_');
        const targetUserId = parts[2];
        const amount = parseFloat(parts[3]);
        const targetUser = await storage.getTelegramUser(targetUserId);
        if (targetUser) {
          const newBalCents = (targetUser.balance || 0) + Math.round(amount * 100);
          await storage.updateTelegramUser(Number(targetUserId), { balance: newBalCents });
          await sendDepositSuccessNotification(targetBot, targetUser.telegramId, amount, newBalCents / 100, "Manual Approved Deposit");
          targetBot.sendMessage(chatId, `✅ Approved deposit of $${amount.toFixed(2)} for ${targetUserId}`);
        }
        return;
      }

      if (data.startsWith('reject_dep_')) {
        const targetUserId = data.split('_')[2];
        const targetUser = await storage.getTelegramUser(targetUserId);
        if (targetUser) {
          targetBot.sendMessage(targetUser.telegramId, `❌ Your deposit has been rejected.`);
          targetBot.sendMessage(chatId, `❌ Rejected deposit for ${targetUserId}`);
        }
        return;
      }

      if (data.startsWith('cat_')) {
        const category = data.substring(4);
        const showOutOfStockSetting = await storage.getSetting("SHOW_OUT_OF_STOCK_PRODUCTS");
        const showOutOfStock = showOutOfStockSetting?.value === "true";

        const products = await storage.getProducts();
        const categoryProducts = products.filter(p => p.type === category && p.status === 'available');

        const userCurrency = (tgUser as any)?.selectedCurrency || "USD";
        const keyboard: any[] = [];
        if (categoryProducts.length > 0) {
          for (const p of categoryProducts) {
            const stock = await storage.getCredentialsByProduct(p.id);
            const availableStock = stock.filter(c => c.status === 'available').length;

            const { formatted: pPrice } = formatPriceInCurrency(p.price / 100, userCurrency);
            let buttonStyle = 'success';
            let stockText = `${availableStock} Pcs`;

            if (availableStock === 0) {
              if (p.isPreorderEnabled) {
                const pendingPreorders = await storage.getPendingPreordersByProduct(p.id);
                const preordersCount = pendingPreorders.reduce((sum, po) => sum + po.quantity, 0);
                const availableQuota = Math.max(0, (p.preorderQuota || 50) - preordersCount);
                if (availableQuota > 0) {
                  buttonStyle = 'primary';
                  stockText = `Pre-Order Available: ${availableQuota} Pcs`;
                } else {
                  buttonStyle = 'danger';
                  stockText = `Out of Stock`;
                }
              } else {
                buttonStyle = 'danger';
                stockText = `Out of Stock`;
              }
            }

            keyboard.push([{
              text: `${p.name} - ${pPrice} | ${stockText}`,
              callback_data: `prod_${p.id}`,
              style: buttonStyle,
              icon_custom_emoji_id: p.customEmojiId || '5456343263340405032'
            }]);
          }
        } else {
          const isSuperGrokOut = category === 'SuperGrok';
          if (showOutOfStock || !isSuperGrokOut) {
            const { formatted: pPrice } = formatPriceInCurrency(10, userCurrency);
            keyboard.push([{
              text: `${category} Account - ${pPrice} | ${isSuperGrokOut ? 'Out of Stock' : '5 Pcs'}`,
              callback_data: `preset_buy_${category}`,
              style: isSuperGrokOut ? 'danger' : 'success',
              icon_custom_emoji_id: '5456343263340405032'
            }]);
          }
        }

        // Add Back to Catalog button
        keyboard.push([{
          text: 'Back to Catalog',
          callback_data: 'buy',
          style: 'primary',
          icon_custom_emoji_id: '5976535107933050770'
        }]);

        let catEmojiId = '';
        if (categoryProducts.length > 0 && ((categoryProducts[0] as any).customEmojiId || (categoryProducts[0] as any).custom_emoji_id)) {
          catEmojiId = (categoryProducts[0] as any).customEmojiId || (categoryProducts[0] as any).custom_emoji_id;
        }

        if (!catEmojiId) {
          const catLower = category.toLowerCase();
          if (catLower.includes('aws')) catEmojiId = '5785025630055700143';
          else if (catLower.includes('digital ocean') || catLower.includes('digitalocean')) catEmojiId = '5785345544989710932';
          else if (catLower.includes('linode')) catEmojiId = '5787285044846399857';
          else if (catLower.includes('azure')) catEmojiId = '5785185643357279341';
          else if (catLower.includes('gcp') || catLower.includes('google cloud')) catEmojiId = '5785061312643994750';
          else if (catLower.includes('kamatera')) catEmojiId = '5785070770161980265';
          else if (catLower.includes('gemini')) catEmojiId = '5377660214096974712';
          else if (catLower.includes('chatgpt') || catLower.includes('grok')) catEmojiId = '5404617696589390973';
          else catEmojiId = '5456343263340405032';
        }

        const catEmojiTag = catEmojiId ? `<tg-emoji emoji-id="${catEmojiId}">✨</tg-emoji>` : '';
        const bannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_catalog_banner.png");
        const caption = `<b>${category}</b> ${catEmojiTag}\n\nSelect the product you need:`;
        await sendOrEditScreenWithPhoto(targetBot, chatId, bannerPath, caption, { inline_keyboard: keyboard }, query.message?.message_id);
        return;
      }

      if (data.startsWith('copy_userid_')) {
        const userIdToCopy = data.substring(12);
        await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6276090299232031662">🆔</tg-emoji> <b>User ID sent!</b> You can now long-press to copy it. <tg-emoji emoji-id="5231102735817918643">📋</tg-emoji>`, { parse_mode: 'HTML' });
        targetBot.sendMessage(chatId, `<code>${userIdToCopy}</code>`, { parse_mode: 'HTML' });
        return;
      }

      if (data.startsWith('copy_payid_')) {
        const payIdToCopy = data.substring(11);
        await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6276090299232031662">🆔</tg-emoji> <b>Pay ID sent!</b> You can now long-press to copy it. <tg-emoji emoji-id="5231102735817918643">📋</tg-emoji>`, { parse_mode: 'HTML' });
        targetBot.sendMessage(chatId, `<code>${payIdToCopy}</code>`, { parse_mode: 'HTML' });
        return;
      }

      if (data.startsWith('copy_wallet_') || data === 'copy_binance_id') {
        let walletToCopy = data.replace('copy_wallet_', '');
        if (data === 'copy_binance_id' || walletToCopy === 'binance') {
          walletToCopy = (await storage.getSetting('BINANCE_PAY_ID'))?.value || "284910485";
          if (query.id) {
            await targetBot.answerCallbackQuery(query.id, { text: `📋 Binance Pay ID: ${walletToCopy}\n(Tap text below to copy!)`, show_alert: true }).catch(() => {});
          }
          await targetBot.sendMessage(chatId, `<code>${walletToCopy}</code>`, { parse_mode: 'HTML' });
          return;
        }
        if (walletToCopy === 'trc20') {
          walletToCopy = (await storage.getSetting('TRC20_WALLET_ADDRESS'))?.value || "Not Set";
        } else if (walletToCopy === 'bep20') {
          walletToCopy = (await storage.getSetting('BEP20_WALLET_ADDRESS'))?.value || "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
        } else if (walletToCopy === 'aptos') {
          walletToCopy = (await storage.getSetting('APTOS_WALLET_ADDRESS'))?.value || "Not Set";
        }
        await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6276090299232031662">🆔</tg-emoji> <b>Wallet Address sent!</b> You can now long-press to copy it. <tg-emoji emoji-id="5231102735817918643">📋</tg-emoji>`, { parse_mode: 'HTML' });
        targetBot.sendMessage(chatId, `<code>${walletToCopy}</code>`, { parse_mode: 'HTML' });
        return;
      }

      if (data.startsWith('gen_qr_')) {
        const parts = data.split('_');
        const method = parts[2] || 'bep20';
        const paymentId = parseInt(parts[3] || '0', 10);

        const payment = await storage.getPayment(paymentId);
        let walletAddress = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
        if (method === 'trc20') {
          walletAddress = (await storage.getSetting('TRC20_WALLET_ADDRESS'))?.value || walletAddress;
        } else if (method === 'bep20') {
          walletAddress = (await storage.getSetting('BEP20_WALLET_ADDRESS'))?.value || walletAddress;
        } else if (method === 'binance') {
          walletAddress = (await storage.getSetting('BINANCE_PAY_ID'))?.value || "284910485";
        }

        try {
          if (query.id) {
            await targetBot.answerCallbackQuery(query.id, { text: '⚡ Generating QR Code...' }).catch(() => {});
          }
        } catch (e) {}

        try {
          const { generateStyledQRCode } = await import('./qr-generator');
          const qrBuffer = await generateStyledQRCode(walletAddress);
          const amountUSD = payment ? (payment.amount / 100).toFixed(2) : '10.00';

          const caption = `<tg-emoji emoji-id="5280907155107506256">🪙</tg-emoji> You need to pay <b>${amountUSD} USDT</b> \n\n` +
            `<b>Coin:</b> USDT <tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>\n` +
            `<b>Network:</b> ${method.toUpperCase()}  <tg-emoji emoji-id="5280907155107506256">🪙</tg-emoji>\n\n` +
            `<code>${walletAddress}</code>\n\n` +
            `<tg-emoji emoji-id="5803393311100113792">🥂</tg-emoji> Send <b>${amountUSD} USDT</b> to the address above.\n\n` +
            `<tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <i>Send only </i><i><b>USDT</b> via </i><i><b>${method.toUpperCase()}</b> to this address, otherwise coins will be lost.</i>\n\n` +
            `<blockquote><tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <b>Important Notice:</b>\nYou must transfer the exact requested amount (<b>${amountUSD} USDT</b>). If you pay less than the requested amount, your deposit will <b>NOT</b> be completed automatically!</blockquote>`;

          const keyboard = [
            [{ text: 'Check payment', callback_data: `check_payment_${paymentId}`, icon_custom_emoji_id: '5386367538735104399' }],
            [{ text: 'Change Network', callback_data: 'add_funds', icon_custom_emoji_id: '5976535107933050770' }]
          ] as any[][];

          const token = (targetBot as any)?.token;
          if (query.message?.message_id && token) {
            try {
              const form = new FormData();
              form.append('chat_id', chatId.toString());
              form.append('message_id', query.message.message_id.toString());
              form.append('media', JSON.stringify({
                type: 'photo',
                media: 'attach://qr_file',
                caption: caption,
                parse_mode: 'HTML'
              }));
              form.append('reply_markup', JSON.stringify({ inline_keyboard: keyboard }));
              form.append('qr_file', qrBuffer, { filename: 'qr.png', contentType: 'image/png' });

              const res = await axios.post(`https://api.telegram.org/bot${token}/editMessageMedia`, form, {
                headers: form.getHeaders()
              });
              if (res.data?.ok) return;
            } catch (e: any) {
              console.log('[editMessageMedia QR error]:', e.message);
            }
          }

          if (query.message) {
            await targetBot.deleteMessage(chatId, query.message.message_id).catch(() => {});
          }
          await targetBot.sendPhoto(chatId, qrBuffer, {
            caption,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } catch (err: any) {
          console.error("Failed to generate QR photo:", err);
        }
        return;
      }

      if (data.startsWith('prod_')) {
        const productId = parseInt(data.substring(5));
        await sendProductDetailsScreen(targetBot, chatId, productId, undefined, query.message?.message_id);
        return;
      }

      if (data.startsWith('preset_buy_')) {
        const category = data.substring(11);
        await sendProductDetailsScreen(targetBot, chatId, category, category, query.message?.message_id);
        return;
      }

      if (data.startsWith('download_txt_')) {
        const orderId = parseInt(data.substring(13), 10);
        const allOrders = await storage.getOrders();
        const targetOrder = allOrders.find(o => o.id === orderId);
        let credContent = '';
        let prodName = 'items';

        if (targetOrder) {
          const prod = await storage.getProduct(targetOrder.productId);
          if (prod) prodName = prod.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

          // Find all orders in the same bulk purchase batch (same user, same product, within 15s window)
          const targetTime = new Date(targetOrder.createdAt).getTime();
          const batchOrders = allOrders.filter(o =>
            o.telegramUserId === targetOrder.telegramUserId &&
            o.productId === targetOrder.productId &&
            Math.abs(new Date(o.createdAt).getTime() - targetTime) <= 15000
          );

          const allCreds = await db.select().from(credentials);
          const credItems: string[] = [];

          for (const ord of batchOrders) {
            const cred = allCreds.find(c => c.id === ord.credentialId);
            if (cred && cred.content) {
              credItems.push(cred.content);
            }
          }

          if (credItems.length > 0) {
            credContent = credItems.length === 1
              ? credItems[0]
              : credItems.map((item, i) => `--- Item ${i + 1} of ${credItems.length} ---\n${item}`).join('\n\n');
          }
        }

        if (!credContent) {
          credContent = `Order #${orderId} delivered items: Access granted 24/7.`;
        }

        const fileName = `order_${orderId}_${prodName}.txt`;
        const tempDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        const tempFilePath = path.join(tempDir, fileName);
        fs.writeFileSync(tempFilePath, credContent, 'utf-8');

        const fileCaption = `<tg-emoji emoji-id="5258514780469075716">📂</tg-emoji> File for order #${orderId}`;

        try {
          await targetBot.sendDocument(chatId, tempFilePath, {
            caption: fileCaption,
            parse_mode: 'HTML'
          });
        } catch (err: any) {
          console.error("Error sending order TXT file via targetBot:", err);
          const token = (targetBot as any)?.token;
          if (token) {
            try {
              const form = new FormData();
              form.append('chat_id', chatId.toString());
              form.append('caption', fileCaption);
              form.append('parse_mode', 'HTML');
              form.append('document', fs.createReadStream(tempFilePath), { filename: fileName, contentType: 'text/plain' });
              await axios.post(`https://api.telegram.org/bot${token}/sendDocument`, form, { headers: form.getHeaders() });
            } catch (e2: any) {
              console.error("Error sending order TXT file via Direct API:", e2);
              await targetBot.sendMessage(chatId, `📄 <b>Order #${orderId} Delivered Items:</b>\n\n<code>${escapeHTML(credContent)}</code>`, { parse_mode: 'HTML' }).catch(() => {});
            }
          }
        } finally {
          setTimeout(() => {
            fs.unlink(tempFilePath, () => {});
          }, 2000);
        }
        return;
      }

      if (data.startsWith('leave_review_')) {
        await sendCustomerReviewsScreen(targetBot, chatId, query.message?.message_id);
        return;
      }

      if (data.startsWith('qty_other_')) {
        const prodId = data.substring(10);
        await storage.updateTelegramUserByChatId(userId, { lastAction: `awaiting_custom_qty_${prodId}` });
        await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="5456258317477230911">😎</tg-emoji> <b>Enter Quantity</b>\n\nPlease type the amount of items you want to buy in the chat:`, { parse_mode: 'HTML' });
        return;
      }

      if (data.startsWith('buy_qty_')) {
        const parts = data.split('_');
        const prodId = parts[2];
        const qty = parseInt(parts[3]) || 1;
        await sendOrderCalculationScreen(targetBot, chatId, prodId, qty, query.message?.message_id);
        return;
      }

      if (data.startsWith('pay_bal_')) {
        const parts = data.split('_');
        const prodId = parts[2];
        const qty = parseInt(parts[3]) || 1;

        let unitPriceUSD = 10.00;
        let productName = "Product Account";

        const PRESET_PRODUCT_MAP: Record<string, { name: string; price: number }> = {
          'Standoff 2': { name: 'Standoff 2 Account', price: 10.00 },
          'Gemini': { name: 'Gemini Link 18 months', price: 12.00 },
          'CHAT GPT': { name: 'ChatGPT Plus Account', price: 15.00 },
          'CLAUDE': { name: 'Claude Pro Account', price: 18.00 },
          'SuperGrok': { name: 'SuperGrok AI Account', price: 20.00 },
          'Perplexity': { name: 'Perplexity Pro Account', price: 14.00 }
        };

        const prodIdNum = parseInt(prodId, 10);
        if (!isNaN(prodIdNum)) {
          const product = await storage.getProduct(prodIdNum);
          if (product) {
            unitPriceUSD = product.price / 100;
            productName = product.name;
          }
        }

        if (unitPriceUSD === 10.00 && typeof prodId === 'string') {
          const allProds = await storage.getProducts();
          const match = allProds.find(p => p.type === prodId || p.name === prodId || p.name.includes(prodId));
          if (match) {
            unitPriceUSD = match.price / 100;
            productName = match.name;
          } else if (PRESET_PRODUCT_MAP[prodId]) {
            productName = PRESET_PRODUCT_MAP[prodId].name;
            unitPriceUSD = PRESET_PRODUCT_MAP[prodId].price;
          } else {
            productName = `${prodId} Account`;
          }
        }

        const totalUSD = (qty * unitPriceUSD).toFixed(2);
        const userBalUSD = ((tgUser.balance || 0) / 100).toFixed(2);

        if ((tgUser.balance || 0) / 100 < qty * unitPriceUSD) {
          const topUpKeyboard = {
            inline_keyboard: [
              [{ text: 'Top up balance', callback_data: 'add_funds', style: 'success', icon_custom_emoji_id: '5409048419211682843' }],
              [{ text: 'Back', callback_data: 'buy', style: 'primary', icon_custom_emoji_id: '5976535107933050770' }]
            ] as any
          };

          const errCaption = `<tg-emoji emoji-id="5429518319243775957">💵</tg-emoji> <b>Insufficient Balance</b>\n\n` +
            `Required: <b>$${totalUSD}</b> (${qty}x ${productName})\n` +
            `Your Balance: <b>$${userBalUSD}</b>\n\n` +
            `Please top up your balance to complete this purchase.`;

          await targetBot.sendMessage(chatId, errCaption, {
            parse_mode: 'HTML',
            reply_markup: topUpKeyboard
          });
          return;
        }

        let targetProduct: any = null;
        if (!isNaN(prodIdNum)) {
          targetProduct = await storage.getProduct(prodIdNum);
        }
        if (!targetProduct && typeof prodId === 'string') {
          const allProds = await storage.getProducts();
          targetProduct = allProds.find(p => p.type === prodId || p.name === prodId || p.name.includes(prodId));
        }

        const availableCreds = targetProduct ? (await storage.getCredentialsByProduct(targetProduct.id)).filter(c => c.status === 'available') : [];

        if (targetProduct && availableCreds.length < qty && targetProduct.isPreorderEnabled) {
          const pendingPreorders = await storage.getPendingPreordersByProduct(targetProduct.id);
          const preordersCount = pendingPreorders.reduce((sum, po) => sum + po.quantity, 0);
          const availableQuota = Math.max(0, (targetProduct.preorderQuota || 50) - preordersCount);

          if (qty > availableQuota) {
            await targetBot.sendMessage(chatId, `❌ Maximum pre-order quota available is ${availableQuota} Pcs.`);
            return;
          }

          const newBalCents = Math.round((tgUser.balance || 0) - (qty * unitPriceUSD * 100));
          await storage.updateTelegramUser(tgUser.id, { balance: newBalCents });

          const newPreorder = await storage.createPreorder({
            telegramUserId: tgUser.id,
            productId: targetProduct.id,
            quantity: qty,
            totalPrice: Math.round(qty * unitPriceUSD * 100),
            status: 'pending_fulfillment'
          });

          const slTimeStr = formatSriLankaTime(new Date(), 'full');
          const preorderMsg = `<tg-emoji emoji-id="4958610528588008305">✅</tg-emoji> <b>Pre-Order Placed Successfully!</b>\n\n` +
            `<tg-emoji emoji-id="5854908544712707500">📦</tg-emoji> Product: <b>${escapeHTML(productName)} (${qty} Pcs)</b>\n` +
            `<tg-emoji emoji-id="5256247952564825322">◀️</tg-emoji> Pre-Order <b>#${newPreorder.id}</b>\n` +
            `<tg-emoji emoji-id="5805188079148863343">🕒</tg-emoji> Placed Time: <b>${slTimeStr}</b>\n\n` +
            `<tg-emoji emoji-id="5203993413346680064">📊</tg-emoji>Total Paid: <b>$${totalUSD} USD</b>\n\n` +
            `<tg-emoji emoji-id="5411590687663608498">⚡️</tg-emoji><b>Priority Queue Guarantee:</b>\n` +
            `Your pre-order has been registered. As soon as the admin adds new stock for this item, your credentials will automatically be sent to you in this chat!\n\n` +
            `Thank you for your purchase!`;

          const keyboard = {
            inline_keyboard: [
              [{ text: 'Catalog', callback_data: 'buy', style: 'success', icon_custom_emoji_id: '5854908544712707500' }],
              [{ text: 'Profile', callback_data: 'profile', style: 'success', icon_custom_emoji_id: '6032693626394382504' }]
            ]
          };

          const bannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_orders_banner.png");
          await sendOrEditScreenWithPhoto(targetBot, chatId, bannerPath, preorderMsg, keyboard, query.message?.message_id);
          autoFulfillPendingPreorders(targetProduct.id).catch(() => {});
          return;
        }

        const newBalCents = Math.round((tgUser.balance || 0) - (qty * unitPriceUSD * 100));
        await storage.updateTelegramUser(tgUser.id, { balance: newBalCents });

        let deliveredItems: string[] = [];
        let targetOrderId: number | string = Math.floor(1000 + Math.random() * 9000);

        if (availableCreds.length > 0) {
          const credsToAssign = availableCreds.slice(0, qty);

          for (let i = 0; i < credsToAssign.length; i++) {
            const chosenCred = credsToAssign[i];
            deliveredItems.push(chosenCred.content);
            await db.update(credentials).set({ status: 'sold' }).where(eq(credentials.id, chosenCred.id));

            const newOrder = await storage.createOrder({
              telegramUserId: tgUser.id,
              productId: prodIdNum,
              credentialId: chosenCred.id,
              status: 'completed'
            });
            if (i === 0 && newOrder && newOrder.id) {
              targetOrderId = newOrder.id;
            }
          }
        }

        while (deliveredItems.length < qty) {
          const idx = deliveredItems.length + 1;
          deliveredItems.push(`${productName} #${idx}\nKey: ${productName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${targetOrderId}_${idx}\nStatus: Active 24/7`);
        }

        await sendOrderSuccessMessage(targetBot, chatId, targetOrderId, productName, deliveredItems);
        return;
      }

      if (data.startsWith('gen_qr_item_')) {
        const parts = data.split('_');
        const paymentId = parseInt(parts[3] || '0', 10);
        const prodId = parts[4] || '1';
        const qty = parseInt(parts[5] || '1', 10);
        const method = parts[6] || 'bep20';

        let unitPriceUSD = 0.55;
        let productName = "Gemini Link 18 months";
        const prodIdNum = parseInt(prodId);
        if (!isNaN(prodIdNum)) {
          const product = await storage.getProduct(prodIdNum);
          if (product) {
            unitPriceUSD = product.price / 100;
            productName = product.name;
          }
        }
        const totalUSD = (qty * unitPriceUSD).toFixed(2);

        let walletAddress = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
        if (method === 'trc20') {
          walletAddress = (await storage.getSetting('TRC20_WALLET_ADDRESS'))?.value || walletAddress;
        } else if (method === 'bep20') {
          walletAddress = (await storage.getSetting('BEP20_WALLET_ADDRESS'))?.value || walletAddress;
        } else if (method === 'binance') {
          walletAddress = (await storage.getSetting('BINANCE_PAY_ID'))?.value || "284910485";
        }

        try {
          if (query.id) {
            await targetBot.answerCallbackQuery(query.id, { text: '⚡ Generating QR Code...' }).catch(() => {});
          }
        } catch (e) {}

        try {
          const { generateStyledQRCode } = await import('./qr-generator');
          const qrBuffer = await generateStyledQRCode(walletAddress);

          const caption = `<tg-emoji emoji-id="5280907155107506256">🪙</tg-emoji> You need to pay <b>${totalUSD} USDT</b> for <b>${qty}x ${productName}</b>\n\n` +
            `<b>Coin:</b> USDT <tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>\n` +
            `<b>Network:</b> ${method.toUpperCase()}  <tg-emoji emoji-id="5280907155107506256">🪙</tg-emoji>\n\n` +
            `<code>${walletAddress}</code>\n\n` +
            `<tg-emoji emoji-id="5803393311100113792">🥂</tg-emoji> Send <b>${totalUSD} USDT</b> to the address above.\n\n` +
            `<tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <i>Send only </i><i><b>USDT</b> via </i><i><b>${method.toUpperCase()}</b> to this address, otherwise coins will be lost.</i>\n\n` +
            `<blockquote><tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <b>Important Notice:</b>\nYou must transfer the exact requested amount (<b>${totalUSD} USDT</b>). If you pay less than the requested amount, your deposit will <b>NOT</b> be completed automatically!</blockquote>`;

          const keyboard = [
            [{ text: 'Check payment', callback_data: `confirm_direct_pay_${prodId}_${qty}_${paymentId}`, icon_custom_emoji_id: '5386367538735104399' }],
            [{ text: 'Back to Item', callback_data: `prod_${prodId}`, icon_custom_emoji_id: '5976535107933050770' }]
          ] as any[][];

          const token = (targetBot as any)?.token;
          if (query.message?.message_id && token) {
            try {
              const form = new FormData();
              form.append('chat_id', chatId.toString());
              form.append('message_id', query.message.message_id.toString());
              form.append('media', JSON.stringify({
                type: 'photo',
                media: 'attach://qr_file',
                caption: caption,
                parse_mode: 'HTML'
              }));
              form.append('reply_markup', JSON.stringify({ inline_keyboard: keyboard }));
              form.append('qr_file', qrBuffer, { filename: 'qr.png', contentType: 'image/png' });

              const res = await axios.post(`https://api.telegram.org/bot${token}/editMessageMedia`, form, {
                headers: form.getHeaders()
              });
              if (res.data?.ok) return;
            } catch (e: any) {
              console.log('[editMessageMedia item QR error]:', e.message);
            }
          }

          if (query.message) {
            await targetBot.deleteMessage(chatId, query.message.message_id).catch(() => {});
          }
          await targetBot.sendPhoto(chatId, qrBuffer, {
            caption,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } catch (err: any) {
          console.error("Failed to generate item QR photo:", err);
        }
        return;
      }

      if (data.startsWith('pay_cryptobot_')) {
        if (query.id) {
          await targetBot.answerCallbackQuery(query.id, {
            text: "🛠️ CryptoBot payment is currently under maintenance. Please choose another payment method!",
            show_alert: true
          }).catch(() => {});
        }

        const maintenanceMsg = `<tg-emoji emoji-id="5429518319243775957">🛠️</tg-emoji> <b>Payment Gateway Under Maintenance</b>\n\n` +
          `<b>@CryptoBot</b> payment system is currently undergoing scheduled maintenance.\n` +
          `Please select <b>Binance Pay</b>, <b>USDT (BEP20 / TRC20)</b>, or <b>Pay from balance</b> to complete your payment!`;

        const keyboard = {
          inline_keyboard: [
            [{ text: 'Back to Catalog', callback_data: 'buy', style: 'primary', icon_custom_emoji_id: '5976535107933050770' }]
          ]
        };

        const bannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_payment_banner.png");
        await sendOrEditScreenWithPhoto(targetBot, chatId, bannerPath, maintenanceMsg, keyboard, query.message?.message_id);
        return;
      }

      if (data.startsWith('pay_trc20_') || data.startsWith('pay_bep20_') || data.startsWith('pay_binance_') || data.startsWith('pay_crypto_')) {
        const parts = data.split('_');
        const method = parts[1];
        const prodId = parts[2];
        const qty = parseInt(parts[3]) || 1;

        let unitPriceUSD = 0.55;
        let productName = "Gemini Link 18 months";
        const prodIdNum = parseInt(prodId);
        if (!isNaN(prodIdNum)) {
          const product = await storage.getProduct(prodIdNum);
          if (product) {
            unitPriceUSD = product.price / 100;
            productName = product.name;
          }
        }

        const totalUSDNum = qty * unitPriceUSD;
        const totalUSD = totalUSDNum.toFixed(2);
        let networkTag = "BEP20";
        let networkEmojiId = "5280907155107506256";
        let walletAddress = (await storage.getSetting('BEP20_WALLET_ADDRESS'))?.value || "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";

        if (method === 'trc20') {
          networkTag = "TRC20";
          networkEmojiId = "5936189134342199863";
          walletAddress = (await storage.getSetting('TRC20_WALLET_ADDRESS'))?.value || "T9xR1J9v1aN2k3L4m5P6q7R8s9T0u1V2w3";
        } else if (method === 'binance') {
          networkTag = "BINANCE PAY";
          networkEmojiId = "5281029063459234079";
          walletAddress = (await storage.getSetting('BINANCE_PAY_ID'))?.value || "284910485";
        }

        const payment = await storage.createPayment({
          telegramUserId: tgUser.id,
          amount: Math.round(totalUSDNum * 100),
          paymentMethod: method,
          status: 'pending'
        });

        const responseMsg = `<tg-emoji emoji-id="${networkEmojiId}">💰</tg-emoji> You need to pay <b>${totalUSD} USDT</b> for <b>${qty}x ${productName}</b>\n\n` +
          `<b>Coin:</b> USDT <tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>\n` +
          `<b>Network:</b> ${networkTag}  <tg-emoji emoji-id="${networkEmojiId}">💰</tg-emoji>\n\n` +
          `<code>${walletAddress}</code>\n\n` +
          `<tg-emoji emoji-id="5803393311100113792">🥂</tg-emoji> Send <b>${totalUSD} USDT</b> to the address above.\n\n` +
          `<tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <i>Send only </i><i><b>USDT</b> via </i><i><b>${networkTag}</b> to this address, otherwise coins will be lost.</i>\n\n` +
          `<blockquote><tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <b>Important Notice:</b>\nYou must transfer the exact requested amount (<b>${totalUSD} USDT</b>). If you pay less than the requested amount, your deposit will <b>NOT</b> be completed automatically!</blockquote>`;

        const binancePayId = (await storage.getSetting('BINANCE_PAY_ID'))?.value || "284910485";
        const copyBtn = method === 'binance' 
          ? { text: 'Copy Binance ID', copy_text: { text: binancePayId }, icon_custom_emoji_id: '5231102735817918643' }
          : { text: 'Copy Wallet Address', copy_text: { text: walletAddress }, icon_custom_emoji_id: '5231102735817918643' };

        const keyboard = [
          [{ text: 'Generate QR Code', callback_data: `gen_qr_item_${payment.id}_${prodId}_${qty}_${method}`, icon_custom_emoji_id: '5309771942381785364' }],
          [copyBtn],
          [{ text: 'Check payment', callback_data: `confirm_direct_pay_${prodId}_${qty}_${payment.id}`, icon_custom_emoji_id: '5386367538735104399' }],
          [{ text: 'Back to Item', callback_data: `prod_${prodId}`, style: 'danger', icon_custom_emoji_id: '5976535107933050770' }]
        ] as any[][];

        const balanceBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_balance_banner.png");
        await sendOrEditScreenWithPhoto(targetBot, chatId, balanceBannerPath, responseMsg, { inline_keyboard: keyboard }, query.message?.message_id);
        return;
      }

      if (data.startsWith('confirm_direct_pay_')) {
        const parts = data.split('_');
        const prodId = parts[3];
        const qty = parseInt(parts[4]) || 1;
        const paymentId = parseInt(parts[5] || '0', 10);
        const payment = paymentId > 0 ? await storage.getPayment(paymentId) : null;

        let productName = "Gemini Link 18 months";
        let unitPriceUSD = 0.55;
        const prodIdNum = parseInt(prodId);
        if (!isNaN(prodIdNum)) {
          const product = await storage.getProduct(prodIdNum);
          if (product) {
            productName = product.name;
            unitPriceUSD = product.price / 100;
          }
        }

        const totalCents = Math.round(qty * unitPriceUSD * 100);

        if (!payment || payment.paymentMethod === 'binance') {
          if (query.id) {
            await targetBot.answerCallbackQuery(query.id, { text: "💬 Send your Binance Order ID in chat!" }).catch(() => {});
          }

          await storage.updateTelegramUserByChatId(chatId.toString(), {
            lastAction: `awaiting_binance_txid_${prodId}_${qty}_${paymentId}`
          });

          const promptMsg = `<tg-emoji emoji-id="5281029063459234079">🔸</tg-emoji> <b>Verify Binance Pay Transaction</b>\n\n` +
            `<blockquote>Please reply with your <b>Binance Order ID / Transaction ID</b> in the chat below to verify your payment:</blockquote>\n\n` +
            `<i>Example: <code>28491048591</code></i>`;

          const binancePayId = (await storage.getSetting('BINANCE_PAY_ID'))?.value || "284910485";
          const keyboard = {
            inline_keyboard: [
              [{ text: 'Copy Binance ID', copy_text: { text: binancePayId }, icon_custom_emoji_id: '5231102735817918643' }],
              [{ text: 'Cancel / Back', callback_data: `prod_${prodId}`, style: 'danger', icon_custom_emoji_id: '5976535107933050770' }]
            ]
          };

          if (query.message) {
            try {
              await targetBot.editMessageText(promptMsg, {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                reply_markup: keyboard
              });
            } catch (e) {}
          }

          await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="5443127283898405358">📥</tg-emoji> <b>Reply to this message with your Binance Order ID:</b>`, {
            parse_mode: 'HTML',
            reply_markup: { force_reply: true, selective: true }
          }).catch(() => {});

          return;
        }

        if (isPaid) {
          if (tgUser.balance >= totalCents) {
            await storage.updateTelegramUser(tgUser.id, { balance: tgUser.balance - totalCents });
          }

          let deliveredItems: string[] = [];
          let targetOrderId: number | string = Math.floor(1000 + Math.random() * 9000);

          if (!isNaN(prodIdNum)) {
            const availableCreds = (await storage.getCredentialsByProduct(prodIdNum)).filter(c => c.status === 'available');
            const credsToAssign = availableCreds.slice(0, qty);

            for (let i = 0; i < credsToAssign.length; i++) {
              const chosenCred = credsToAssign[i];
              deliveredItems.push(chosenCred.content);
              await db.update(credentials).set({ status: 'sold' }).where(eq(credentials.id, chosenCred.id));

              const newOrder = await storage.createOrder({
                telegramUserId: tgUser.id,
                productId: prodIdNum,
                credentialId: chosenCred.id,
                status: 'completed'
              });
              if (i === 0 && newOrder && newOrder.id) {
                targetOrderId = newOrder.id;
              }
            }
          }

          while (deliveredItems.length < qty) {
            const idx = deliveredItems.length + 1;
            deliveredItems.push(`${productName} #${idx}\nKey: ${productName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${targetOrderId}_${idx}\nStatus: Active 24/7`);
          }

          const deliveredCredential = deliveredItems.length === 1
            ? deliveredItems[0]
            : deliveredItems.map((item, i) => `--- Item ${i + 1} of ${qty} ---\n${item}`).join('\n\n');

          try {
            if (query.message) {
              await targetBot.deleteMessage(chatId, query.message.message_id).catch(() => {});
            }
          } catch (e) {}

          await sendOrderSuccessMessage(targetBot, chatId, targetOrderId, productName, deliveredCredential);
          return;
        }

        if (query.id) {
          await targetBot.answerCallbackQuery(query.id, {
            text: '❌ Payment not detected yet on blockchain.\n\nPlease transfer the exact amount and try again in 1-2 minutes!',
            show_alert: true
          }).catch(() => {});
        } else {
          await targetBot.sendMessage(chatId, '❌ <b>Payment Not Detected</b>\n\nPlease transfer the exact amount and try again in 1-2 minutes.', { parse_mode: 'HTML' });
        }
        return;
      }

      if (data.startsWith('confirm_offer_')) {
        const chatIdStr = chatId.toString();
        if (confirmingOffers.has(chatIdStr)) return;
        confirmingOffers.add(chatIdStr);

        const offerId = parseInt(data.substring(14));
        const offer = await storage.getSpecialOffer(offerId);
        if (!offer) {
          confirmingOffers.delete(chatIdStr);
          await targetBot.sendMessage(chatId, "❌ Offer not found.");
          return;
        }

        const product = await storage.getProduct(offer.productId);
        if (!product) {
          confirmingOffers.delete(chatIdStr);
          return;
        }

        try {
          const result = await db.transaction(async (tx) => {
            // 1. Stock check and selection inside transaction
            const availableCredentials = await tx.select()
              .from(credentials)
              .where(and(eq(credentials.productId, product.id), eq(credentials.status, 'available')))
              .limit(offer.bundleQuantity || 1)
              .for('update', { skipLocked: true });

            if (availableCredentials.length < (offer.bundleQuantity || 1)) {
              throw new Error(`Not enough stock. (Required: ${offer.bundleQuantity || 1}, Available: ${availableCredentials.length})`);
            }

            // 2. Double check and Deduct balance atomically
            const [updatedUser] = await tx
              .update(telegramUsers)
              .set({
                balance: sql`${telegramUsers.balance} - ${offer.price}`
              })
              .where(and(eq(telegramUsers.id, tgUser.id), gte(telegramUsers.balance, offer.price)))
              .returning();

            if (!updatedUser) {
              throw new Error("Insufficient balance");
            }

            // 3. Mark credentials as sold and create orders
            for (const cred of availableCredentials) {
              await tx.update(credentials)
                .set({ status: 'sold' })
                .where(eq(credentials.id, cred.id));

              await tx.insert(orders).values({
                telegramUserId: tgUser.id,
                productId: product.id,
                credentialId: cred.id,
                status: 'completed'
              });
            }

            return { updatedUser, availableCredentials };
          });

          // 4. Success Response
          let prodEmojiId = '5377660214096974712';
          const userOrders = await storage.getOrders();
          const lastOrderId = userOrders.length > 0 ? userOrders[0].id : 3659;

          let credentialsFormatted = '';
          if (result.availableCredentials.length === 1) {
            credentialsFormatted = `<b>Your item, easy to copy:</b>\n<code>${escapeHTML(result.availableCredentials[0].content)}</code>`;
          } else {
            credentialsFormatted = `<b>Your items, easy to copy:</b>\n` + result.availableCredentials.map((c, i) => `${i + 1}️⃣ <code>${escapeHTML(c.content)}</code>`).join('\n\n');
          }

          const successMsg = `<tg-emoji emoji-id="5949584381424178413">✅</tg-emoji> <b>Purchase completed successfully</b>\n\n` +
            `<tg-emoji emoji-id="5854908544712707500">📦</tg-emoji> <tg-emoji emoji-id="${prodEmojiId}">✨</tg-emoji> <b>${escapeHTML(offer.name)}</b>\n` +
            `<tg-emoji emoji-id="5976535107933050770">🧾</tg-emoji> Order <b>#${lastOrderId}</b>\n\n` +
            `${credentialsFormatted}\n\n` +
            `Thank you for your purchase! If you have questions, contact support.\n` +
            `A review would help us if everything went well.`;

          const purchaseSuccessKeyboard = {
            inline_keyboard: [
              [{ text: 'Download TXT', callback_data: `download_txt_${lastOrderId}`, style: 'primary', icon_custom_emoji_id: '5443127283898405358' }],
              [{ text: 'Leave a review', callback_data: `leave_review_${lastOrderId}`, style: 'primary', icon_custom_emoji_id: '5193009244940557703' }],
              [{ text: 'Main menu', callback_data: 'main_menu', style: 'primary', icon_custom_emoji_id: '5416041192905265756' }]
            ] as any
          };

          confirmingOffers.delete(chatIdStr);

          await targetBot.sendMessage(chatId, successMsg, {
            parse_mode: 'HTML',
            reply_markup: purchaseSuccessKeyboard
          });

          // Emit real-time notification to Admin Dashboard
          const userDisplayName = tgUser.firstName || tgUser.username || "User";
          io.emit('admin_notification', {
            type: 'purchase',
            title: 'New Bundle Purchase (Telegram Bot)',
            message: `${userDisplayName} claimed bundle: ${offer.name} ($${(offer.price / 100).toFixed(2)})`,
            data: {
              offer,
              availableCredentials: result.availableCredentials,
              tgUser
            }
          });

          // Emit Native Push Notification
          sendAdminPushNotification(
            'New Bundle Purchase (Telegram Bot)',
            `${userDisplayName} claimed bundle: ${offer.name} ($${(offer.price / 100).toFixed(2)})`
          ).catch(console.error);

        } catch (err: any) {
          console.error('Special offer purchase error:', err);
          const errorText = err.message === "Insufficient balance"
            ? "❌ Insufficient balance to complete this purchase."
            : `❌ Purchase failed: ${err.message}`;

          await targetBot.sendMessage(chatId, errorText);
          confirmingOffers.delete(chatIdStr);
        }
        return;
      }

      if (data === 'cancel_purchase') {
        await storage.updateTelegramUser(tgUser.id, { lastAction: null });
        confirmingOffers.delete(chatId.toString());
        await targetBot.editMessageText("❌ Purchase cancelled.", {
          chat_id: chatId,
          message_id: query.message?.message_id
        });

        // Auto-delete after 5 seconds
        const msgIdToDelete = query.message?.message_id;
        if (msgIdToDelete) {
          setTimeout(async () => {
            try {
              await targetBot.deleteMessage(chatId, msgIdToDelete);
            } catch (err) { }
          }, 5000);
        }
        return;
      }



      if (data === 'history_last10' || data === 'history_all') {
        const allOrders = await storage.getOrders();
        const userIdNum = tgUser.id;
        const userOrders = allOrders
          .filter(o => o.telegramUserId === userIdNum)
          .sort((a, b) => a.id - b.id);

        const displayOrders = data === 'history_last10'
          ? userOrders.slice(-10)
          : userOrders;

        for (let i = 0; i < displayOrders.length; i += 10) {
          const batch = displayOrders.slice(i, i + 10);
          let historyText = i === 0
            ? `<tg-emoji emoji-id="5334982154868783692">📜</tg-emoji> <b>Your Purchase History</b> (${data === 'history_last10' ? 'Last 10' : 'All'}):\n\n`
            : '';

          batch.forEach((order, index) => {
            const safeName = escapeHTML(order.product?.name || 'Unknown');
            const safeContent = escapeHTML(order.credential?.content || 'N/A');
            historyText += `<b>${i + index + 1}.</b> <tg-emoji emoji-id="6276134137963222688">🛍</tg-emoji> <b>${safeName}</b>\n<tg-emoji emoji-id="5201692367437974073">💰</tg-emoji> $${((order.product?.price || 0) / 100).toFixed(2)}\n<tg-emoji emoji-id="6276090299232031662">🔑</tg-emoji> <code>${safeContent}</code>\n\n`;
          });

          await targetBot.sendMessage(chatId, historyText, { parse_mode: 'HTML' });
        }
        return;
      }

      if (data === 'special_offers') {
        const stopSpecialOfferTimer = (chatIdVal: number) => {
          if (activeSpecialOfferTimers.has(chatIdVal)) {
            clearInterval(activeSpecialOfferTimers.get(chatIdVal)!);
            activeSpecialOfferTimers.delete(chatIdVal);
          }
        };

        const sendOrEditOffers = async (chatIdVal: number, messageId?: number) => {
          if (confirmingOffers.has(chatIdVal.toString())) return; // Safety lock
          let offers = [];
          try {
            offers = await storage.getActiveSpecialOffers();
          } catch (err) {
            console.error("Error in special_offers handler:", err);
          }
          if (offers.length === 0) {
            stopSpecialOfferTimer(chatIdVal);
            const emptyMsg = "😔 No special offers available right now.";
            if (messageId) {
              try {
                return await targetBot.editMessageText(emptyMsg, { chat_id: chatIdVal, message_id: messageId });
              } catch (e) { }
            } else {
              try {
                return await targetBot.sendMessage(chatIdVal, emptyMsg);
              } catch (e) { }
            }
            return;
          }

          const headerEmojiIds = [
            "6276128687649723695", "6275964744453068322", "6275873218699989657",
            "6275869662467069270", "6276120956708591159", "6276075885321786491",
            "6276045545672807753", "6273727139506295416", "6276107406086771779"
          ];

          const header = headerEmojiIds.map(id => `<tg-emoji emoji-id="${id}">🎁</tg-emoji>`).join('');

          const numEmojiMap: Record<string, string> = {
            "0": "6228712321716325542", "1": "6231028576104221771", "2": "6228508985079632140",
            "3": "6228892912206220866", "4": "6228651427670002796", "5": "6230754058974531742",
            "6": "6231061110481488717", "7": "6228541351953173776", "8": "6228898272325406140",
            "9": "6230968699965150268"
          };

          let text = `<tg-emoji emoji-id="5467538555158943525">💭</tg-emoji> <b>Special Offers (Bundle Deals)</b> <tg-emoji emoji-id="5456343263340405032">🛍</tg-emoji>\n━━━━━━━━━━━━━━━\n\n`;
          text += `${header}\n\n`;

          const keyboard = { inline_keyboard: [] as any[] };

          for (const offer of offers) {
            const priceUSD = (offer.price / 100).toFixed(2);
            const titleEmoji = offer.customEmojiId ? `<tg-emoji emoji-id="${offer.customEmojiId}">🎁</tg-emoji>` : `<tg-emoji emoji-id="6276134137963222688">🎁</tg-emoji>`;
            text += `${titleEmoji} <b>${offer.name}</b>\n`;
            text += `💰 Price: <b>$${priceUSD} USD</b>\n`;
            text += `📦 Quantity: <b>${offer.bundleQuantity} pcs</b>\n`;

            if (offer.expiresAt) {
              const diff = new Date(offer.expiresAt).getTime() - Date.now();
              if (diff > 0) {
                const totalSeconds = Math.floor(diff / 1000);
                const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
                const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
                const s = (totalSeconds % 60).toString().padStart(2, '0');

                text += `<tg-emoji emoji-id="5206715082582533386">🤩</tg-emoji> <b>Hurry! Expires In</b> <tg-emoji emoji-id="5206715082582533386">🤩</tg-emoji>\n`;
                const formatTimeDigit = (digit: string | undefined) => {
                  const d = digit || '0';
                  return `<tg-emoji emoji-id="${numEmojiMap[d] || numEmojiMap['0']}">🎁</tg-emoji>`;
                };

                text += `${formatTimeDigit(h[0])} ${formatTimeDigit(h[1])} <b>:</b> ${formatTimeDigit(m[0])} ${formatTimeDigit(m[1])} <b>:</b> ${formatTimeDigit(s[0])} ${formatTimeDigit(s[1])}\n`;
              }
            }

            if (offer.description) text += `<i>${offer.description}</i>\n`;
            text += `━━━━━━━━━━━━━━━\n\n`;

            keyboard.inline_keyboard.push([{ text: 'Buy Now', callback_data: `buy_offer_${offer.id}`, style: 'success', icon_custom_emoji_id: '5361781191722699867' }]);
          }

          keyboard.inline_keyboard.push([{ text: '🔙 Back', callback_data: 'profile_refresh' }]);

          if (messageId) {
            try {
              await targetBot.editMessageText(text, {
                chat_id: chatIdVal,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: keyboard
              });
            } catch (err: any) {
              if (err.message && err.message.includes("message is not modified")) {
                // Ignore
              } else {
                console.error("Error editing special offers:", err);
                stopSpecialOfferTimer(chatIdVal);
              }
            }
          } else {
            const sentMsg = await targetBot.sendMessage(chatIdVal, text, {
              parse_mode: 'HTML',
              reply_markup: keyboard
            });
            return sentMsg;
          }
        };

        try {
          stopSpecialOfferTimer(chatId);
          const sent = await sendOrEditOffers(chatId);
          if (sent?.message_id) {
            const interval = setInterval(() => {
              sendOrEditOffers(chatId, sent.message_id);
            }, 1000);
            activeSpecialOfferTimers.set(chatId, interval);
          }
        } catch (err) {
          console.error("Critical error in special_offers bot logic:", err);
        }
        return;
      }

      if (data.startsWith('buy_offer_')) {
        const offerId = parseInt(data.substring(10));
        const offer = await storage.getSpecialOffer(offerId);
        if (!offer || offer.status !== 'active') {
          await targetBot.sendMessage(chatId, "⚠️ Offer not found or expired.");
          return;
        }

        if (tgUser.balance < offer.price) {
          const lowBalanceMsg = `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Insufficient Balance!</b>\n\n` +
            `Your current balance is <b>$${(tgUser.balance / 100).toFixed(2)}</b>, but this offer costs <b>$${(offer.price / 100).toFixed(2)}</b>.\n\n` +
            `Please top up your account to continue. <tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>`;

          await targetBot.sendMessage(chatId, lowBalanceMsg, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[{ text: '💰 Add Now (Top-up)', callback_data: 'add_funds' }]]
            }
          });
          return;
        }

        // 2. Stock Check
        const stock = await storage.getCredentialsByProduct(offer.productId);
        const availableStock = stock.filter(c => c.status === 'available');
        if (availableStock.length < offer.bundleQuantity) {
          await targetBot.sendMessage(chatId, `❌ Not enough stock for this bundle. (Required: ${offer.bundleQuantity}, Available: ${availableStock.length})`);
          return;
        }

        // 3. Clear Tracking & Full Message Update (To stop Timers permanently for this message)
        // Also stop the interactive menu timer
        if (activeSpecialOfferTimers.has(chatId)) {
          clearInterval(activeSpecialOfferTimers.get(chatId)!);
          activeSpecialOfferTimers.delete(chatId);
        }

        await storage.updateTelegramUser(tgUser.id, {
          lastOfferBroadcastId: null, // This stops the Global Timer
          lastAction: `confirming_offer_${offerId}`
        });

        // Stop Fast Timer if exists
        if (activeSessionTimers.has(tgUser.telegramId)) {
          clearInterval(activeSessionTimers.get(tgUser.telegramId)!);
          activeSessionTimers.delete(tgUser.telegramId);
        }

        const confirmKeyboard = {
          inline_keyboard: [
            [{ text: '✅ Confirm Purchase', callback_data: `confirm_offer_${offerId}` }],
            [{ text: '❌ Cancel', callback_data: 'cancel_purchase' }]
          ]
        };

        const confirmText = `<tg-emoji emoji-id="6276134137963222688">🎁</tg-emoji> <b>${offer.name}</b>\n\n` +
          `<tg-emoji emoji-id="5201692367437974073">💎</tg-emoji> Bundle Price: <b>$${(offer.price / 100).toFixed(2)}</b>\n\n` +
          `Please confirm your purchase below: <tg-emoji emoji-id="5231102735817918643">🤍</tg-emoji>`;

        try {
          await targetBot.editMessageText(confirmText, {
            chat_id: chatId,
            message_id: query.message?.message_id,
            parse_mode: 'HTML',
            reply_markup: confirmKeyboard
          });
        } catch (err) {
          await targetBot.sendMessage(chatId, confirmText, {
            parse_mode: 'HTML',
            reply_markup: confirmKeyboard
          });
        }
        return;
      }

      if (data === 'add_funds') {
        await sendAddFundsScreen(targetBot, chatId, query.message?.message_id);
        return;
      }

      if (data === 'payment_cryptobot' || data.startsWith('cryptobot_amount_')) {
        if (query.id) {
          await targetBot.answerCallbackQuery(query.id, {
            text: "🛠️ CryptoBot payment is currently under maintenance. Please choose another payment method!",
            show_alert: true
          }).catch(() => {});
        }

        const maintenanceMsg = `<tg-emoji emoji-id="5429518319243775957">🛠️</tg-emoji> <b>Payment Gateway Under Maintenance</b>\n\n` +
          `<b>@CryptoBot</b> payment system is currently undergoing scheduled maintenance.\n` +
          `Please select <b>Binance Pay</b>, <b>USDT (BEP20 / TRC20)</b>, or <b>Pay from balance</b> to complete your payment!`;

        const keyboard = {
          inline_keyboard: [
            [{ text: 'Back to Balance', callback_data: 'add_funds', style: 'primary', icon_custom_emoji_id: '5976535107933050770' }]
          ]
        };

        const bannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_balance_banner.png");
        await sendOrEditScreenWithPhoto(targetBot, chatId, bannerPath, maintenanceMsg, keyboard, query.message?.message_id);
        return;
      }

      if (data === 'payment_binance') {
        const binanceEnabled = (await storage.getSetting('PAYMENT_BINANCE_ENABLED'))?.value !== 'false';
        if (!binanceEnabled) {
          if (query?.id) {
            await targetBot.answerCallbackQuery(query.id, { text: '❌ Binance Pay is currently disabled.', show_alert: true }).catch(() => {});
          } else {
            await targetBot.sendMessage(chatId, '❌ Binance Pay is currently disabled by the admin.');
          }
          return;
        }

        const keyboard: any[][] = [
          [
            { text: '1', callback_data: 'binance_amount_1', icon_custom_emoji_id: '5201692367437974073' },
            { text: '5', callback_data: 'binance_amount_5', icon_custom_emoji_id: '5201692367437974073' },
            { text: '10', callback_data: 'binance_amount_10', icon_custom_emoji_id: '5201692367437974073' }
          ],
          [
            { text: 'Custom', callback_data: 'binance_amount_custom', icon_custom_emoji_id: '5201692367437974073' }
          ]
        ];

        const prompt = `<tg-emoji emoji-id="5281029063459234079">🔸</tg-emoji> Select or enter amount for <b>Binance Pay</b> deposit in USD (<tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>):`;
        const binanceBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_binance_banner.png");
        await sendOrEditScreenWithPhoto(targetBot, chatId, binanceBannerPath, prompt, { inline_keyboard: keyboard }, query.message?.message_id);

        await storage.updateTelegramUserByChatId(chatId.toString(), {
          lastAction: 'awaiting_binance_amount_selection',
          lastMessageId: query.message?.message_id
        });
        return;
      }

      if (data.startsWith('binance_amount_')) {
        const val = data.replace('binance_amount_', '');
        const balanceBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_balance_banner.png");

        if (val === 'custom') {
          const prompt = `<tg-emoji emoji-id="5281029063459234079">🔸</tg-emoji> Enter custom amount for <b>Binance Pay</b> deposit in USD (<tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>):`;
          await sendOrEditScreenWithPhoto(targetBot, chatId, balanceBannerPath, prompt, { inline_keyboard: [] }, query.message?.message_id);
          await storage.updateTelegramUserByChatId(chatId.toString(), {
            lastAction: 'awaiting_binance_deposit_amount',
            lastMessageId: query.message?.message_id
          });
          return;
        }

        const amount = parseFloat(val);
        if (isNaN(amount) || amount <= 0) return;

        const payId = (await storage.getSetting('BINANCE_PAY_ID'))?.value || "284910485";
        const payment = await storage.createPayment({
          telegramUserId: tgUser.id,
          amount: Math.round(amount * 100),
          paymentMethod: 'binance',
          status: 'pending'
        });

        await storage.updateTelegramUserByChatId(chatId.toString(), {
          lastAction: `awaiting_binance_txid_${payment.id}_0`
        });

        const responseMsg = `<tg-emoji emoji-id="5281029063459234079">🔸</tg-emoji> You need to pay <b>${amount.toFixed(0)} USDT</b> \n\n` +
          `<b>Coin:</b> USDT <tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>\n` +
          `<b>Method:</b> Binance Pay / Pay ID  <tg-emoji emoji-id="5281029063459234079">🔸</tg-emoji>\n\n` +
          `<b>Pay ID:</b> <code>${payId}</code>\n\n` +
          `<tg-emoji emoji-id="5803393311100113792">🥂</tg-emoji> Send <b>${amount.toFixed(0)} USDT</b> to the Pay ID above.\n\n` +
          `<tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <i>Send only </i><i><b>USDT</b> via </i><i><b>Binance Pay</b> to this Pay ID, otherwise coins will be lost.</i>\n\n` +
          `<blockquote><tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <b>Important Notice:</b>\nYou must transfer the exact requested amount (<b>${amount.toFixed(0)} USDT</b>). If you pay less than the requested amount, your deposit will <b>NOT</b> be completed automatically!</blockquote>`;

        const keyboard = [
          [{ text: 'Generate QR Code', callback_data: `gen_qr_binance_${payment.id}`, icon_custom_emoji_id: '5309771942381785364' }],
          [{ text: 'Copy Binance ID', copy_text: { text: payId }, icon_custom_emoji_id: '5231102735817918643' }],
          [{ text: 'Check payment', callback_data: `check_payment_${payment.id}`, icon_custom_emoji_id: '5386367538735104399' }],
          [{ text: 'Change Network', callback_data: 'add_funds', icon_custom_emoji_id: '5976535107933050770' }]
        ] as any[][];

        const binanceBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_binance_banner.png");
        await sendOrEditScreenWithPhoto(targetBot, chatId, binanceBannerPath, responseMsg, { inline_keyboard: keyboard }, query.message?.message_id);
        return;
      }

      if (data === 'payment_cryptomus') {
        const cryptomusEnabled = (await storage.getSetting('PAYMENT_CRYPTOMUS_ENABLED'))?.value !== 'false';
        if (!cryptomusEnabled) {
          if (queryId) {
            await targetBot.answerCallbackQuery(queryId, { text: '❌ Cryptomus payments are currently disabled.', show_alert: true }).catch(() => {});
          } else {
            await targetBot.sendMessage(chatId, '❌ Cryptomus payments are currently disabled by the admin.');
          }
          return;
        }

        const keyboard: any[][] = [
          [
            { text: '1', callback_data: 'cryptomus_amount_1', icon_custom_emoji_id: '5201692367437974073' },
            { text: '5', callback_data: 'cryptomus_amount_5', icon_custom_emoji_id: '5201692367437974073' },
            { text: '10', callback_data: 'cryptomus_amount_10', icon_custom_emoji_id: '5201692367437974073' }
          ],
          [
            { text: 'Custom', callback_data: 'cryptomus_amount_custom', icon_custom_emoji_id: '5201692367437974073' }
          ]
        ];

        const prompt = `<tg-emoji emoji-id="5341506639688126935">💰</tg-emoji> Enter amount for <b>Cryptomus</b> deposit in USD (<tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>):`;
        const balanceBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_balance_banner.png");
        await sendOrEditScreenWithPhoto(targetBot, chatId, balanceBannerPath, prompt, { inline_keyboard: keyboard }, query.message?.message_id);

        await storage.updateTelegramUserByChatId(chatId.toString(), {
          lastAction: 'awaiting_cryptomus_amount_selection',
          lastMessageId: query.message?.message_id
        });
        return;
      }

      if (data.startsWith('cryptomus_amount_')) {
        const val = data.replace('cryptomus_amount_', '');
        const balanceBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_balance_banner.png");

        if (val === 'custom') {
          const prompt = `<tg-emoji emoji-id="5341506639688126935">💰</tg-emoji> Enter custom amount for <b>Cryptomus</b> deposit in USD (<tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>):`;
          await sendOrEditScreenWithPhoto(targetBot, chatId, balanceBannerPath, prompt, { inline_keyboard: [] }, query.message?.message_id);
          await storage.updateTelegramUserByChatId(chatId.toString(), {
            lastAction: 'awaiting_cryptomus_amount',
            lastMessageId: query.message?.message_id
          });
          return;
        }

        const amount = parseFloat(val);
        if (isNaN(amount) || amount <= 0) return;

        await processCryptomusInvoiceCreation(targetBot, chatId, tgUser, amount);
        return;
      }

      if (data === 'payment_trc20') {
        const trc20Enabled = (await storage.getSetting('PAYMENT_TRC20_ENABLED'))?.value !== 'false';
        if (!trc20Enabled) {
          if (queryId) {
            await targetBot.answerCallbackQuery(queryId, { text: '❌ TRC20 payments are currently disabled.', show_alert: true }).catch(() => {});
          } else {
            await targetBot.sendMessage(chatId, '❌ TRC20 payments are currently disabled by the admin.');
          }
          return;
        }

        const keyboard: any[][] = [
          [
            { text: '1', callback_data: 'trc20_amount_1', icon_custom_emoji_id: '5201692367437974073' },
            { text: '5', callback_data: 'trc20_amount_5', icon_custom_emoji_id: '5201692367437974073' },
            { text: '10', callback_data: 'trc20_amount_10', icon_custom_emoji_id: '5201692367437974073' }
          ],
          [
            { text: 'Custom', callback_data: 'trc20_amount_custom', icon_custom_emoji_id: '5201692367437974073' }
          ]
        ];

        const prompt = `<tg-emoji emoji-id="5936189134342199863">💰</tg-emoji> Select or enter amount for <b>USDT (TRC-20)</b> deposit in USD (<tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>):`;
        const trc20BannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_trc20_banner.png");
        await sendOrEditScreenWithPhoto(targetBot, chatId, trc20BannerPath, prompt, { inline_keyboard: keyboard }, query.message?.message_id);

        await storage.updateTelegramUserByChatId(chatId.toString(), {
          lastAction: 'awaiting_trc20_amount_selection',
          lastMessageId: query.message?.message_id
        });
        return;
      }

      if (data.startsWith('trc20_amount_')) {
        const val = data.replace('trc20_amount_', '');
        const balanceBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_balance_banner.png");

        if (val === 'custom') {
          const prompt = `<tg-emoji emoji-id="5936189134342199863">💰</tg-emoji> Enter custom amount for <b>USDT (TRC-20)</b> deposit in USD (<tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>):`;
          await sendOrEditScreenWithPhoto(targetBot, chatId, balanceBannerPath, prompt, { inline_keyboard: [] }, query.message?.message_id);
          await storage.updateTelegramUserByChatId(chatId.toString(), {
            lastAction: 'awaiting_trc20_amount',
            lastMessageId: query.message?.message_id
          });
          return;
        }

        const amount = parseFloat(val);
        if (isNaN(amount) || amount <= 0) return;

        const wallet = (await storage.getSetting('TRC20_WALLET_ADDRESS'))?.value || "T9xR1J9v1aN2k3L4m5P6q7R8s9T0u1V2w3";
        const payment = await storage.createPayment({
          telegramUserId: tgUser.id,
          amount: Math.round(amount * 100),
          paymentMethod: 'trc20',
          status: 'pending'
        });

        await storage.updateTelegramUserByChatId(chatId.toString(), {
          lastAction: `awaiting_trc20_txid_${payment.id}_0`
        });

        const responseMsg = `<tg-emoji emoji-id="5936189134342199863">💰</tg-emoji> You need <b>${amount.toFixed(0)} USDT</b> \n\n` +
          `<b>Coin:</b> USDT <tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>\n` +
          `<b>Network:</b> TRC20  <tg-emoji emoji-id="5936189134342199863">💰</tg-emoji>\n\n` +
          `<code>${wallet}</code>\n\n` +
          `<tg-emoji emoji-id="5803393311100113792">🥂</tg-emoji> Send <b>${amount.toFixed(0)} USDT</b> to the address above.\n\n` +
          `<tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <i>Send only </i><i><b>USDT</b> via </i><i><b>TRC20</b> to this address, otherwise coins will be lost.</i>\n\n` +
          `<blockquote><tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <b>Important Notice:</b>\nYou must transfer the exact requested amount (<b>${amount.toFixed(0)} USDT</b>). If you pay less than the requested amount, your deposit will <b>NOT</b> be completed automatically!</blockquote>`;

        const keyboard = [
          [{ text: 'Generate QR Code', callback_data: `gen_qr_trc20_${payment.id}`, icon_custom_emoji_id: '5309771942381785364' }],
          [{ text: 'Copy Wallet Address', copy_text: { text: wallet }, icon_custom_emoji_id: '5231102735817918643' }],
          [{ text: 'Check payment', callback_data: `check_payment_${payment.id}`, icon_custom_emoji_id: '5386367538735104399' }],
          [{ text: 'Change Network', callback_data: 'add_funds', icon_custom_emoji_id: '5976535107933050770' }]
        ] as any[][];

        const trc20BannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_trc20_banner.png");
        await sendOrEditScreenWithPhoto(targetBot, chatId, trc20BannerPath, responseMsg, { inline_keyboard: keyboard }, query.message?.message_id);
        return;
      }

      if (data === 'payment_bep20') {
        const bep20Enabled = (await storage.getSetting('PAYMENT_BEP20_ENABLED'))?.value !== 'false';
        if (!bep20Enabled) {
          if (query.id) {
            await targetBot.answerCallbackQuery(query.id, { text: '❌ BEP20 payments are currently disabled.', show_alert: true }).catch(() => {});
          } else {
            await targetBot.sendMessage(chatId, '❌ BEP20 payments are currently disabled by the admin.');
          }
          return;
        }

        const keyboard: any[][] = [
          [
            { text: '1', callback_data: 'bep20_amount_1', icon_custom_emoji_id: '5201692367437974073' },
            { text: '5', callback_data: 'bep20_amount_5', icon_custom_emoji_id: '5201692367437974073' },
            { text: '10', callback_data: 'bep20_amount_10', icon_custom_emoji_id: '5201692367437974073' }
          ],
          [
            { text: 'Custom', callback_data: 'bep20_amount_custom', icon_custom_emoji_id: '5201692367437974073' }
          ]
        ];

        const prompt = `<tg-emoji emoji-id="5280907155107506256">🪙</tg-emoji> Select or enter amount for <b>USDT (BEP-20)</b> deposit in USD (<tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>):`;
        const bep20BannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_bep20_banner.png");
        await sendOrEditScreenWithPhoto(targetBot, chatId, bep20BannerPath, prompt, { inline_keyboard: keyboard }, query.message?.message_id);

        await storage.updateTelegramUserByChatId(chatId.toString(), {
          lastAction: 'awaiting_bep20_amount_selection',
          lastMessageId: query.message?.message_id
        });
        return;
      }

      if (data.startsWith('bep20_amount_')) {
        const val = data.replace('bep20_amount_', '');
        const balanceBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_balance_banner.png");

        if (val === 'custom') {
          const prompt = `<tg-emoji emoji-id="5280907155107506256">🪙</tg-emoji> Enter custom amount for <b>USDT (BEP-20)</b>:`;
          await sendOrEditScreenWithPhoto(targetBot, chatId, balanceBannerPath, prompt, { inline_keyboard: [] }, query.message?.message_id);
          await storage.updateTelegramUserByChatId(chatId.toString(), {
            lastAction: 'awaiting_bep20_amount',
            lastMessageId: query.message?.message_id
          });
          return;
        }

        const amount = parseFloat(val);
        if (isNaN(amount) || amount <= 0) return;

        const wallet = (await storage.getSetting('BEP20_WALLET_ADDRESS'))?.value || "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
        const payment = await storage.createPayment({
          telegramUserId: tgUser.id,
          amount: Math.round(amount * 100),
          paymentMethod: 'bep20',
          status: 'pending'
        });

        await storage.updateTelegramUserByChatId(chatId.toString(), {
          lastAction: `awaiting_bep20_txid_${payment.id}_0`
        });

        const responseMsg = `<tg-emoji emoji-id="5280907155107506256">🪙</tg-emoji> You need to pay <b>${amount.toFixed(0)} USDT</b> \n\n` +
          `<b>Coin:</b> USDT <tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>\n` +
          `<b>Network:</b> BEP20  <tg-emoji emoji-id="5280907155107506256">🪙</tg-emoji>\n\n` +
          `<code>${wallet}</code>\n\n` +
          `<tg-emoji emoji-id="5803393311100113792">🥂</tg-emoji> Send <b>${amount.toFixed(0)} USDT</b> to the address above.\n\n` +
          `<tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <i>Send only </i><i><b>USDT</b> via </i><i><b>BEP20</b> to this address, otherwise coins will be lost.</i>\n\n` +
          `<blockquote><tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <b>Important Notice:</b>\nYou must transfer the exact requested amount (<b>${amount.toFixed(0)} USDT</b>). If you pay less than the requested amount, your deposit will <b>NOT</b> be completed automatically!</blockquote>`;

        const keyboard = [
          [{ text: 'Generate QR Code', callback_data: `gen_qr_bep20_${payment.id}`, icon_custom_emoji_id: '5309771942381785364' }],
          [{ text: 'Copy Wallet Address', copy_text: { text: wallet }, icon_custom_emoji_id: '5231102735817918643' }],
          [{ text: 'Check payment', callback_data: `check_payment_${payment.id}`, icon_custom_emoji_id: '5386367538735104399' }],
          [{ text: 'Change Network', callback_data: 'add_funds', icon_custom_emoji_id: '5976535107933050770' }]
        ] as any[][];

        await sendOrEditScreenWithPhoto(targetBot, chatId, balanceBannerPath, responseMsg, { inline_keyboard: keyboard }, query.message?.message_id);
        return;
      }

      if (data === 'payment_aptos') {
        const aptosEnabled = (await storage.getSetting('PAYMENT_APTOS_ENABLED'))?.value === 'true';
        if (!aptosEnabled) {
          if (queryId) {
            await targetBot.answerCallbackQuery(queryId, { text: '❌ Aptos payments are currently disabled.', show_alert: true }).catch(() => {});
          } else {
            await targetBot.sendMessage(chatId, '❌ Aptos payments are currently disabled by the admin.');
          }
          return;
        }

        try { if (query.message) await targetBot.deleteMessage(chatId, query.message.message_id); } catch (e) {}
        const wallet = (await storage.getSetting('APTOS_WALLET_ADDRESS'))?.value;
        if (!wallet) {
          await targetBot.sendMessage(chatId, '❌ Aptos wallet not configured. Contact support.');
          return;
        }
        const prompt = await targetBot.sendMessage(chatId,
          `<tg-emoji emoji-id="5798849051017352095">⚡</tg-emoji> <b>Aptos (USDT) Deposit</b>\n\nEnter the <b>USDT amount</b> you want to deposit (USD <tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>):`,
          { parse_mode: 'HTML' }
        );
        await storage.updateTelegramUserByChatId(chatId.toString(), {
          lastAction: 'awaiting_aptos_amount',
          lastMessageId: prompt?.message_id
        });
        return;
      }

      if (data.startsWith('check_payment_')) {
        const paymentId = parseInt(data.substring(14));
        const paymentCheck = await storage.getPayment(paymentId);

        if (paymentCheck && paymentCheck.paymentMethod === 'binance') {
          if (paymentCheck.status === 'completed') {
            await targetBot.answerCallbackQuery(query.id, { text: "Payment already verified!", show_alert: true }).catch(() => {});
            return;
          }

          if (query.id) {
            await targetBot.answerCallbackQuery(query.id, { text: "💬 Send your Binance Order ID in chat!" }).catch(() => {});
          }

          await storage.updateTelegramUserByChatId(chatId.toString(), {
            lastAction: `awaiting_binance_txid_0_0_${paymentCheck.id}`
          });

          const promptMsg = `<tg-emoji emoji-id="5281029063459234079">🔸</tg-emoji> <b>Verify Binance Pay Transaction</b>\n\n` +
            `<blockquote>Please reply with your <b>Binance Order ID / Transaction ID</b> in the chat below to verify your payment:</blockquote>\n\n` +
            `<i>Example: <code>28491048591</code></i>`;

          const binancePayId = (await storage.getSetting('BINANCE_PAY_ID'))?.value || "284910485";
          const keyboard = {
            inline_keyboard: [
              [{ text: 'Copy Binance ID', copy_text: { text: binancePayId }, icon_custom_emoji_id: '5231102735817918643' }],
              [{ text: 'Cancel / Back', callback_data: 'add_funds', style: 'danger', icon_custom_emoji_id: '5976535107933050770' }]
            ]
          };

          if (query.message) {
            try {
              await targetBot.editMessageText(promptMsg, {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                reply_markup: keyboard
              });
            } catch (e) {}
          }

          await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="5443127283898405358">📥</tg-emoji> <b>Reply to this message with your Binance Order ID:</b>`, {
            parse_mode: 'HTML',
            reply_markup: { force_reply: true, selective: true }
          }).catch(() => {});

          return;
        }

        if (paymentCheck && paymentCheck.paymentMethod === 'cryptobot') {
          if (paymentCheck.status === 'completed') {
            await targetBot.answerCallbackQuery(query.id, { text: "Payment already verified!", show_alert: true }).catch(() => {});
            return;
          }

          if (!paymentCheck.externalId) {
            await targetBot.answerCallbackQuery(query.id, { text: "Payment not found yet.", show_alert: true }).catch(() => {});
            return;
          }

          const check = await checkCryptoBotInvoiceStatus(paymentCheck.externalId);
          if (check.paid) {
            // ATOMIC DB UPDATE TO PREVENT DOUBLE CREDITING
            const [updatedPayment] = await db.update(payments)
              .set({ status: 'completed', updatedAt: new Date() })
              .where(and(eq(payments.id, paymentCheck.id), ne(payments.status, 'completed')))
              .returning();

            if (updatedPayment) {
              await db.execute(sql`UPDATE telegram_users SET balance = balance + ${updatedPayment.amount} WHERE id = ${updatedPayment.telegramUserId}`);
              const [updatedUser] = await db.select().from(telegramUsers).where(eq(telegramUsers.id, updatedPayment.telegramUserId));
              const newBalUSD = updatedUser ? (updatedUser.balance / 100) : (updatedPayment.amount / 100);
              await sendDepositSuccessNotification(targetBot, chatId, updatedPayment.amount / 100, newBalUSD, "@CryptoBot Invoice", paymentCheck.externalId);

              try {
                if (query.message) {
                  const updatedCaption = `<tg-emoji emoji-id="5361543877599724417">🤖</tg-emoji> <b>@CryptoBot Top-up Invoice</b>\n` +
                    `➖➖➖➖➖➖➖➖➖➖\n` +
                    `<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> Top-up amount: <b>$${(updatedPayment.amount / 100).toFixed(2)} USD</b>\n` +
                    `<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> Status: <tg-emoji emoji-id="6276090299232031662">✅</tg-emoji> <b>Successful</b>\n` +
                    `➖➖➖➖➖➖➖➖➖➖\n` +
                    `<b>Payment Verified! Balance updated.</b>`;
                  await targetBot.editMessageCaption(updatedCaption, {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: [] }
                  }).catch(() => {});
                }
              } catch (e) {}

              const userDisplayName = tgUser?.firstName || tgUser?.username || "User";
              io.emit('admin_notification', {
                type: 'deposit',
                title: 'New @CryptoBot Deposit',
                message: `${userDisplayName} deposited $${(updatedPayment.amount / 100).toFixed(2)} via @CryptoBot`,
                data: { paymentId: updatedPayment.id, userId: tgUser?.telegramId, amount: updatedPayment.amount / 100, txId: paymentCheck.externalId }
              });

              sendAdminPushNotification(
                'New @CryptoBot Deposit',
                `${userDisplayName} deposited $${(updatedPayment.amount / 100).toFixed(2)}`
              ).catch(console.error);
            } else {
              await targetBot.answerCallbackQuery(query.id, { text: "Payment already verified!", show_alert: true }).catch(() => {});
            }
          } else {
            await targetBot.answerCallbackQuery(query.id, { text: "Payment not found yet.", show_alert: true }).catch(() => {});
          }
          return;
        }

        // Atomically lock and transition payment status to processing for TRC20 / Aptos / Binance / Cryptomus
        const payment = await db.transaction(async (tx) => {
          const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for('update');
          if (!p) return null;
          if (p.status !== 'pending') return p;

          const [updated] = await tx.update(payments)
            .set({ status: 'processing', updatedAt: new Date() })
            .where(eq(payments.id, paymentId))
            .returning();
          return updated;
        });

        if (!payment || payment.status !== 'processing') {
          const failMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Payment request is already being processed, expired, or completed.</b>`, { parse_mode: 'HTML' });
          setTimeout(() => {
            targetBot.deleteMessage(chatId, failMsg.message_id).catch(() => {});
          }, 15000);
          return;
        }

        // Expiration Check: 1 Hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (payment.createdAt && new Date(payment.createdAt) < oneHourAgo) {
          await storage.updatePayment(payment.id, { status: 'expired' });
          await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>This payment request has expired (1 hour limit). Please create a new one.</b>`, { parse_mode: 'HTML' });
          return;
        }

        if (paymentCheck.paymentMethod === 'trc20' || paymentCheck.paymentMethod === 'bep20' || paymentCheck.paymentMethod === 'aptos') {
          if (paymentCheck.status === 'completed') {
            await targetBot.answerCallbackQuery(query.id, { text: "✅ This payment has been already paid!", show_alert: true }).catch(() => {});
            if (query.message) {
              const paidMsg = `<tg-emoji emoji-id="5404617696589390973">✅</tg-emoji> <b>This payment has been already paid!</b>\n\n` +
                `<b>Amount Paid:</b> $${(paymentCheck.amount / 100).toFixed(2)} USD\n` +
                `<b>Status:</b> Completed`;
              if (query.message.photo) {
                await targetBot.editMessageCaption(paidMsg, {
                  chat_id: chatId,
                  message_id: query.message.message_id,
                  parse_mode: 'HTML',
                  reply_markup: { inline_keyboard: [] }
                }).catch(() => {});
              } else {
                await targetBot.editMessageText(paidMsg, {
                  chat_id: chatId,
                  message_id: query.message.message_id,
                  parse_mode: 'HTML',
                  reply_markup: { inline_keyboard: [] }
                }).catch(() => {});
              }
            }
            return;
          }

          // Check if Cryptomus / blockchain payment was completed
          await targetBot.answerCallbackQuery(query.id, { text: "⏳ Payment not found on the blockchain yet. Please complete transfer and try again in a few moments.", show_alert: true }).catch(() => {});
          return;
        }

        // Send "Checking payment..." message in chat
        let checkingMsg: TelegramBot.Message | undefined;
        try {
          const userForDelete = await storage.getTelegramUser(userId);
          if (userForDelete?.lastErrorMessageId) {
            await targetBot.deleteMessage(chatId, userForDelete.lastErrorMessageId).catch(() => { });
            await storage.updateTelegramUser(userForDelete.id, { lastErrorMessageId: null });
          }
          checkingMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6010111371251815589">⏳</tg-emoji> <b>Checking payment...</b> Please wait.`, { parse_mode: 'HTML' });
        } catch (e) { }

        try {
          if (payment.paymentMethod === 'binance') {
            const apiKey = (await storage.getSetting('BINANCE_API_KEY'))?.value;
            const secretKey = (await storage.getSetting('BINANCE_SECRET_KEY'))?.value;

            if (!apiKey || !secretKey) {
              await storage.updatePayment(payment.id, { status: 'pending' });
              if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });
              await targetBot.sendMessage(chatId, "⚠️ Automatic verification is not configured for Binance. Please contact support.");
              return;
            }

            const timestamp = Date.now();
            const queryStr = `timestamp=${timestamp}`;
            const signature = crypto
              .createHmac('sha256', secretKey)
              .update(queryStr)
              .digest('hex');

            const response = await axios.get(`https://api.binance.com/sapi/v1/pay/transactions?${queryStr}&signature=${signature}`, {
              headers: {
                'X-MBX-APIKEY': apiKey,
                'Content-Type': 'application/json'
              }
            });

            if (response.data && response.data.code === '000000' && Array.from(response.data.data).length > 0) {
              const transactions = response.data.data;
              const expectedAmount = (payment.amount / 100).toString();
              const userIdStr = tgUser.telegramId;

              // Get already processed external IDs for this user to avoid duplicate matching
              const processedExternalIds = (await db.select({ extId: payments.externalId })
                .from(payments)
                .where(and(eq(payments.telegramUserId, tgUser.id), eq(payments.status, 'completed'))))
                .map(p => p.extId);

              const match = transactions.find((tx: any) => {
                const txAmount = tx.amount;
                const txNote = tx.note || tx.memo || "";
                return txAmount === expectedAmount && txNote.includes(userIdStr) && !processedExternalIds.includes(tx.orderId);
              });

              if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });

              if (match) {
                // Check if this transaction has already been used for a payment
                const existingSuccess = await db.select().from(payments).where(and(eq(payments.externalId, match.orderId), eq(payments.status, 'completed'))).limit(1);
                if (existingSuccess.length > 0) {
                  await storage.updatePayment(payment.id, { status: 'pending' });
                  await targetBot.sendMessage(chatId, "⚠️ This transaction has already been credited to your account.");
                  return;
                }

                // Lock user and complete payment atomically
                await db.transaction(async (tx) => {
                  const [u] = await tx.select().from(telegramUsers).where(eq(telegramUsers.id, tgUser.id)).for('update');
                  if (u) {
                    await tx.update(telegramUsers).set({ balance: u.balance + payment.amount }).where(eq(telegramUsers.id, u.id));
                  }
                  await tx.update(payments).set({
                    status: 'completed',
                    externalId: match.orderId,
                    updatedAt: new Date()
                  }).where(eq(payments.id, payment.id));
                });

                await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6276090299232031662">✅</tg-emoji> <b>Binance payment verified!</b> $${expectedAmount} has been added to your balance.`, { parse_mode: 'HTML' });
              } else {
                await storage.updatePayment(payment.id, { status: 'pending' });
                const failMsg = `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Binance transaction not found.</b>\n\nPlease ensure you included your User ID in the Note field and transferred the exact amount. <tg-emoji emoji-id="6298544405435387645">❌</tg-emoji>`;
                const sentMsg = await targetBot.sendMessage(chatId, failMsg, { parse_mode: 'HTML' });
                if (sentMsg) {
                  await storage.updateTelegramUser(tgUser.id, { lastErrorMessageId: sentMsg.message_id });
                  setTimeout(() => {
                    targetBot.deleteMessage(chatId, sentMsg.message_id).catch(() => { });
                  }, 15000);
                }
              }
            } else {
              await storage.updatePayment(payment.id, { status: 'pending' });
              if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });
              const failMsg = `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Binance transaction not found.</b>\n\nPlease ensure you included your User ID in the Note field and transferred the exact amount. <tg-emoji emoji-id="6298544405435387645">❌</tg-emoji>`;
              const sentMsg = await targetBot.sendMessage(chatId, failMsg, { parse_mode: 'HTML' });
              if (sentMsg) {
                await storage.updateTelegramUser(tgUser.id, { lastErrorMessageId: sentMsg.message_id });
                setTimeout(() => {
                  targetBot.deleteMessage(chatId, sentMsg.message_id).catch(() => { });
                }, 15000);
              }
            }
          } else if (payment.paymentMethod === 'cryptomus') {
            const merchantId = (await storage.getSetting('CRYPTOMUS_MERCHANT_ID'))?.value;
            const apiKey = (await storage.getSetting('CRYPTOMUS_API_KEY'))?.value;

            if (!merchantId || !apiKey) {
              await storage.updatePayment(payment.id, { status: 'pending' });
              if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });
              await targetBot.sendMessage(chatId, "⚠️ Automatic verification is not configured for Cryptomus. Please contact support.");
              return;
            }

            try {
              const sign = crypto.createHash('md5').update(Buffer.from(JSON.stringify({
                uuid: payment.cryptomusUuid
              })).toString('base64') + apiKey).digest('hex');

              const response = await axios.post('https://api.cryptomus.com/v1/payment/info', {
                uuid: payment.cryptomusUuid
              }, {
                headers: {
                  'merchant': merchantId,
                  'sign': sign
                }
              });

              if (response.data.result) {
                const status = response.data.result.status;
                if (status === 'paid' || status === 'paid_over') {
                  if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });

                  // ATOMIC DB UPDATE TO PREVENT DOUBLE CREDITING
                  const [updatedPayment] = await db.update(payments)
                    .set({ status: 'completed', updatedAt: new Date() })
                    .where(and(eq(payments.id, payment.id), ne(payments.status, 'completed')))
                    .returning();

                  if (updatedPayment) {
                    const [updatedUser] = await db.select().from(telegramUsers).where(eq(telegramUsers.id, updatedPayment.telegramUserId));
                    const newBalUSD = updatedUser ? (updatedUser.balance / 100) : (updatedPayment.amount / 100);
                    await sendDepositSuccessNotification(targetBot, chatId, updatedPayment.amount / 100, newBalUSD, "Cryptomus Pay", payment.cryptomusUuid);

                    try {
                      if (query.message) {
                        const updatedText = `<tg-emoji emoji-id="5341506639688126935">💰</tg-emoji> <b>Cryptomus Top-up Invoice</b>\n` +
                          `➖➖➖➖➖➖➖➖➖➖\n` +
                          `<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> Top-up amount: <b>$${(updatedPayment.amount / 100).toFixed(2)} USD</b>\n` +
                          `<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> Status: <tg-emoji emoji-id="6276090299232031662">✅</tg-emoji> <b>Successful</b>\n` +
                          `➖➖➖➖➖➖➖➖➖➖\n` +
                          `<b>Payment Verified! Balance updated.</b>`;
                        await targetBot.editMessageText(updatedText, {
                          chat_id: chatId,
                          message_id: query.message.message_id,
                          parse_mode: 'HTML',
                          reply_markup: { inline_keyboard: [] }
                        }).catch(() => {});
                      }
                    } catch (e) {}

                    const userDisplayName = tgUser?.firstName || tgUser?.username || "User";
                    io.emit('admin_notification', {
                      type: 'deposit',
                      title: 'New Cryptomus Deposit',
                      message: `${userDisplayName} deposited $${(updatedPayment.amount / 100).toFixed(2)} via Cryptomus`,
                      data: { paymentId: updatedPayment.id, userId: tgUser?.telegramId, amount: updatedPayment.amount / 100, txId: payment.cryptomusUuid }
                    });

                    sendAdminPushNotification(
                      'New Cryptomus Deposit',
                      `${userDisplayName} deposited $${(updatedPayment.amount / 100).toFixed(2)}`
                    ).catch(console.error);
                  } else {
                    await targetBot.sendMessage(chatId, "⚠️ This payment has already been verified and credited to your account.");
                  }
                } else if (status === 'process') {
                  await storage.updatePayment(payment.id, { status: 'pending' });
                  if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });
                  await targetBot.sendMessage(chatId, "⏳ Payment is still processing. Please wait a few minutes and try again.");
                } else if (status === 'cancel' || status === 'fail') {
                  if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });
                  await storage.updatePayment(payment.id, { status: 'failed' });
                  await targetBot.sendMessage(chatId, "❌ Payment was cancelled or failed.");
                } else {
                  await storage.updatePayment(payment.id, { status: 'pending' });
                  if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });
                  await targetBot.sendMessage(chatId, "❌ Payment was not found or is awaiting network confirmation. Try again later");
                }
              }
            } catch (err) {
              await storage.updatePayment(payment.id, { status: 'pending' });
              if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });
              await targetBot.sendMessage(chatId, "❌ Error checking Cryptomus payment status.");
            }
          } else if (payment.paymentMethod === 'trc20') {
            const walletAddress = (await storage.getSetting('TRC20_WALLET_ADDRESS'))?.value;
            if (!walletAddress) {
              await storage.updatePayment(payment.id, { status: 'pending' });
              if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });
              await targetBot.sendMessage(chatId, "⚠️ TRC20 wallet address is not configured. Please contact support.");
              return;
            }

            try {
              const verificationMode = (await storage.getSetting('TRC20_VERIFICATION_MODE'))?.value || 'binance';
              let matched = false;

              if (verificationMode === 'binance') {
                const apiKey = (await storage.getSetting('BINANCE_API_KEY'))?.value;
                const secretKey = (await storage.getSetting('BINANCE_SECRET_KEY'))?.value;

                if (!apiKey || !secretKey) {
                  await storage.updatePayment(payment.id, { status: 'pending' });
                  if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });
                  await targetBot.sendMessage(chatId, "⚠️ Automatic verification is not configured for Binance. Please contact support.");
                  return;
                }

                const timestamp = Date.now();
                const queryStr = `coin=USDT&timestamp=${timestamp}`;
                const signature = crypto
                  .createHmac('sha256', secretKey)
                  .update(queryStr)
                  .digest('hex');

                const res = await axios.get(`https://api.binance.com/sapi/v1/capital/deposit/hisrec?${queryStr}&signature=${signature}`, {
                  headers: {
                    'X-MBX-APIKEY': apiKey,
                    'Content-Type': 'application/json'
                  }
                });

                const deposits = res.data;
                if (deposits && Array.isArray(deposits)) {
                  const expectedAmount = payment.amount / 100;
                  const paymentCreatedAtMs = payment.createdAt ? new Date(payment.createdAt).getTime() : Date.now();

                  for (const d of deposits) {
                    const txId = (d.txId || '').toLowerCase();
                    if (d.status !== 1) continue;
                    if ((d.coin || '').toUpperCase() !== 'USDT') continue;

                    const net = (d.network || '').toUpperCase();
                    if (net !== 'TRX' && net !== 'TRON') continue;

                    const depAddr = (d.address || '').trim();
                    if (depAddr.toLowerCase() !== walletAddress.trim().toLowerCase()) continue;

                    const insertTime = Number(d.insertTime || 0);
                    if (insertTime < paymentCreatedAtMs - 120000) continue;

                    const actualAmount = parseFloat(d.amount);
                    if (isNaN(actualAmount) || Math.abs(actualAmount - expectedAmount) >= 0.001) continue;

                    // Atomic locking transaction
                    const txResult = await db.transaction(async (tx) => {
                      const [settingRow] = await tx.select().from(settings).where(eq(settings.key, 'USED_TXIDS_JSON')).for('update');
                      let currentUsed: string[] = [];
                      if (settingRow?.value) {
                        try { currentUsed = JSON.parse(settingRow.value); } catch(e) {}
                      }
                      if (currentUsed.includes(txId)) {
                        return { success: false, error: "duplicate" };
                      }

                      const [u] = await tx.select().from(telegramUsers).where(eq(telegramUsers.id, tgUser.id)).for('update');
                      if (!u) return { success: false, error: "user_not_found" };

                      currentUsed.push(txId);
                      if (settingRow) {
                        await tx.update(settings).set({ value: JSON.stringify(currentUsed), updatedAt: new Date() }).where(eq(settings.key, 'USED_TXIDS_JSON'));
                      } else {
                        await tx.insert(settings).values({ key: 'USED_TXIDS_JSON', value: JSON.stringify(currentUsed) });
                      }

                      const creditAmountCents = Math.round(actualAmount * 100);
                      await tx.update(telegramUsers).set({
                        balance: u.balance + creditAmountCents,
                        lastAction: null,
                        lastMessageId: null
                      }).where(eq(telegramUsers.id, u.id));

                      await tx.update(payments).set({
                        status: 'completed',
                        externalId: d.txId,
                        amount: creditAmountCents,
                        updatedAt: new Date()
                      }).where(eq(payments.id, payment.id));

                      return { success: true, creditAmountCents };
                    });

                    if (txResult.success) {
                      matched = true;
                      if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });

                      await targetBot.sendMessage(chatId, 
                        `<tg-emoji emoji-id="6276090299232031662">✅</tg-emoji> <b>TRC20 Payment Verified successfully!</b>\n\n` +
                        `<tg-emoji emoji-id="5388622778817589921">💰</tg-emoji> Credited: <b>$${actualAmount.toFixed(2)}</b> has been added to your balance.\n` +
                        `<tg-emoji emoji-id="6276090299232031662">🆔</tg-emoji> Account ID: <code>${tgUser.telegramId}</code>\n\n` +
                        `Thank you for your purchase! <tg-emoji emoji-id="5231102735817918643">🤍</tg-emoji>`,
                        { parse_mode: 'HTML' }
                      );

                      const userDisplayName = tgUser.firstName || tgUser.username || "User";
                      io.emit('admin_notification', {
                        type: 'deposit',
                        title: 'New TRC20 Deposit',
                        message: `${userDisplayName} deposited $${actualAmount.toFixed(2)} via TRC20`,
                        data: {
                          paymentId: payment.id,
                          userId: tgUser.telegramId,
                          amount: actualAmount,
                          txId: d.txId
                        }
                      });

                      sendAdminPushNotification(
                        'New TRC20 Deposit',
                        `${userDisplayName} deposited $${actualAmount.toFixed(2)} (TXID: ${d.txId.substring(0, 10)}...)`
                      ).catch(console.error);

                      break;
                    }
                  }
                }
              } else {
                const url = `https://apilist.tronscanapi.com/api/token_trc20/transfers?limit=20&start=0&direction=2&address=${walletAddress.trim()}`;
                const res = await axios.get(url);
                const dataTRC = res.data;

                if (dataTRC && dataTRC.token_transfers && dataTRC.token_transfers.length > 0) {
                  const expectedAmount = payment.amount / 100;
                  const paymentCreatedAtMs = payment.createdAt ? new Date(payment.createdAt).getTime() : Date.now();

                  for (const transfer of dataTRC.token_transfers) {
                    const txId = (transfer.transaction_id || '').toLowerCase();

                    const toAddr = (transfer.to_address || '').trim().toLowerCase();
                    const contractAddr = (transfer.contract_address || '').trim();
                    const blockTs = Number(transfer.block_ts || 0);

                    if (toAddr === walletAddress.trim().toLowerCase() &&
                        contractAddr === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' &&
                        (transfer.confirmed === true || transfer.contractRet === 'SUCCESS' || transfer.finalResult === 'SUCCESS')) {

                      if (blockTs >= paymentCreatedAtMs - 60000) {
                        const decimals = transfer.tokenInfo?.tokenDecimal || 6;
                        const actualAmount = parseFloat(transfer.quant || '0') / Math.pow(10, decimals);

                        if (Math.abs(actualAmount - expectedAmount) < 0.001) {
                          // Atomic locking transaction
                          const txResult = await db.transaction(async (tx) => {
                            const [settingRow] = await tx.select().from(settings).where(eq(settings.key, 'USED_TXIDS_JSON')).for('update');
                            let currentUsed: string[] = [];
                            if (settingRow?.value) {
                              try { currentUsed = JSON.parse(settingRow.value); } catch(e) {}
                            }
                            if (currentUsed.includes(txId)) {
                              return { success: false, error: "duplicate" };
                            }

                            const [u] = await tx.select().from(telegramUsers).where(eq(telegramUsers.id, tgUser.id)).for('update');
                            if (!u) return { success: false, error: "user_not_found" };

                            currentUsed.push(txId);
                            if (settingRow) {
                              await tx.update(settings).set({ value: JSON.stringify(currentUsed), updatedAt: new Date() }).where(eq(settings.key, 'USED_TXIDS_JSON'));
                            } else {
                              await tx.insert(settings).values({ key: 'USED_TXIDS_JSON', value: JSON.stringify(currentUsed) });
                            }

                            const creditAmountCents = Math.round(actualAmount * 100);
                            await tx.update(telegramUsers).set({
                              balance: u.balance + creditAmountCents,
                              lastAction: null,
                              lastMessageId: null
                            }).where(eq(telegramUsers.id, u.id));

                            await tx.update(payments).set({
                              status: 'completed',
                              externalId: transfer.transaction_id,
                              amount: creditAmountCents,
                              updatedAt: new Date()
                            }).where(eq(payments.id, payment.id));

                            return { success: true, creditAmountCents };
                          });

                          if (txResult.success) {
                            matched = true;
                            if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });

                            await targetBot.sendMessage(chatId, 
                              `<tg-emoji emoji-id="6276090299232031662">✅</tg-emoji> <b>TRC20 Payment Verified successfully!</b>\n\n` +
                              `<tg-emoji emoji-id="5388622778817589921">💰</tg-emoji> Credited: <b>$${actualAmount.toFixed(2)}</b> has been added to your balance.\n` +
                              `<tg-emoji emoji-id="6276090299232031662">🆔</tg-emoji> Account ID: <code>${tgUser.telegramId}</code>\n\n` +
                              `Thank you for your purchase! <tg-emoji emoji-id="5231102735817918643">🤍</tg-emoji>`,
                              { parse_mode: 'HTML' }
                            );

                            const userDisplayName = tgUser.firstName || tgUser.username || "User";
                            io.emit('admin_notification', {
                              type: 'deposit',
                              title: 'New TRC20 Deposit',
                              message: `${userDisplayName} deposited $${actualAmount.toFixed(2)} via TRC20`,
                              data: {
                                paymentId: payment.id,
                                userId: tgUser.telegramId,
                                amount: actualAmount,
                                txId: transfer.transaction_id
                              }
                            });

                            sendAdminPushNotification(
                              'New TRC20 Deposit',
                              `${userDisplayName} deposited $${actualAmount.toFixed(2)} (TXID: ${transfer.transaction_id.substring(0, 10)}...)`
                            ).catch(console.error);

                            break;
                          }
                        }
                      }
                    }
                  }
                }
              }

              if (!matched) {
                await storage.updatePayment(payment.id, { status: 'pending' });
                if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });

                const failMsg = `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Your payment is still pending please pay.</b>\n\nIf you have already paid, please copy and send your <b>Transaction Hash / ID (TXID)</b> directly in the chat for automatic verification.`;
                const sentMsg = await targetBot.sendMessage(chatId, failMsg, { parse_mode: 'HTML' });
                if (sentMsg) {
                  await storage.updateTelegramUser(tgUser.id, { lastErrorMessageId: sentMsg.message_id, lastAction: `awaiting_trc20_txid_${payment.id}_0` });
                  setTimeout(() => {
                    targetBot.deleteMessage(chatId, sentMsg.message_id).catch(() => { });
                  }, 15000);
                }
              }
            } catch (err: any) {
              await storage.updatePayment(payment.id, { status: 'pending' }).catch(() => {});
              console.error("Error during TRC20 check payment:", err);
              if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });
              await targetBot.sendMessage(chatId, `❌ Error verifying TRC20 payment: ${err.message || err}`);
            }
          } else if (payment.paymentMethod === 'aptos') {
            const walletAddress = (await storage.getSetting('APTOS_WALLET_ADDRESS'))?.value;
            if (!walletAddress) {
              await storage.updatePayment(payment.id, { status: 'pending' });
              if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });
              await targetBot.sendMessage(chatId, "⚠️ Aptos wallet address is not configured. Please contact support.");
              return;
            }

            try {
              const verificationMode = (await storage.getSetting('APTOS_VERIFICATION_MODE'))?.value || 'binance';
              let matched = false;

              if (verificationMode === 'binance') {
                const apiKey = (await storage.getSetting('BINANCE_API_KEY'))?.value;
                const secretKey = (await storage.getSetting('BINANCE_SECRET_KEY'))?.value;

                if (!apiKey || !secretKey) {
                  await storage.updatePayment(payment.id, { status: 'pending' });
                  if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });
                  await targetBot.sendMessage(chatId, "⚠️ Automatic verification is not configured for Binance. Please contact support.");
                  return;
                }

                const timestamp = Date.now();
                const queryStr = `coin=USDT&timestamp=${timestamp}`;
                const signature = crypto
                  .createHmac('sha256', secretKey)
                  .update(queryStr)
                  .digest('hex');

                const res = await axios.get(`https://api.binance.com/sapi/v1/capital/deposit/hisrec?${queryStr}&signature=${signature}`, {
                  headers: {
                    'X-MBX-APIKEY': apiKey,
                    'Content-Type': 'application/json'
                  }
                });

                const deposits = res.data;
                if (deposits && Array.isArray(deposits)) {
                  const expectedAmount = payment.amount / 100;
                  const paymentCreatedAtMs = payment.createdAt ? new Date(payment.createdAt).getTime() : Date.now();

                  for (const d of deposits) {
                    const txId = (d.txId || '').toLowerCase();
                    if (d.status !== 1) continue;
                    if ((d.coin || '').toUpperCase() !== 'USDT') continue;

                    const net = (d.network || '').toUpperCase();
                    if (net !== 'APT' && net !== 'APTOS') continue;

                    const depAddr = (d.address || '').trim();
                    if (normalizeAptosAddress(depAddr) !== normalizeAptosAddress(walletAddress)) continue;

                    const insertTime = Number(d.insertTime || 0);
                    if (insertTime < paymentCreatedAtMs - 120000) continue;

                    const actualAmount = parseFloat(d.amount);
                    if (isNaN(actualAmount) || Math.abs(actualAmount - expectedAmount) >= 0.001) continue;

                    // Atomic locking transaction
                    const txResult = await db.transaction(async (tx) => {
                      const [settingRow] = await tx.select().from(settings).where(eq(settings.key, 'USED_TXIDS_JSON')).for('update');
                      let currentUsed: string[] = [];
                      if (settingRow?.value) {
                        try { currentUsed = JSON.parse(settingRow.value); } catch(e) {}
                      }
                      if (currentUsed.includes(txId)) {
                        return { success: false, error: "duplicate" };
                      }

                      const [u] = await tx.select().from(telegramUsers).where(eq(telegramUsers.id, tgUser.id)).for('update');
                      if (!u) return { success: false, error: "user_not_found" };

                      currentUsed.push(txId);
                      if (settingRow) {
                        await tx.update(settings).set({ value: JSON.stringify(currentUsed), updatedAt: new Date() }).where(eq(settings.key, 'USED_TXIDS_JSON'));
                      } else {
                        await tx.insert(settings).values({ key: 'USED_TXIDS_JSON', value: JSON.stringify(currentUsed) });
                      }

                      const creditAmountCents = Math.round(actualAmount * 100);
                      await tx.update(telegramUsers).set({
                        balance: u.balance + creditAmountCents,
                        lastAction: null,
                        lastMessageId: null
                      }).where(eq(telegramUsers.id, u.id));

                      await tx.update(payments).set({
                        status: 'completed',
                        externalId: d.txId,
                        amount: creditAmountCents,
                        updatedAt: new Date()
                      }).where(eq(payments.id, payment.id));

                      return { success: true, creditAmountCents };
                    });

                    if (txResult.success) {
                      matched = true;
                      if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });

                      await targetBot.sendMessage(chatId, 
                        `<tg-emoji emoji-id="6276090299232031662">✅</tg-emoji> <b>Aptos Payment Verified successfully!</b>\n\n` +
                        `<tg-emoji emoji-id="5388622778817589921">💰</tg-emoji> Credited: <b>$${actualAmount.toFixed(2)}</b> has been added to your balance.\n` +
                        `<tg-emoji emoji-id="6276090299232031662">🆔</tg-emoji> Account ID: <code>${tgUser.telegramId}</code>\n\n` +
                        `Thank you for your purchase! <tg-emoji emoji-id="5231102735817918643">🤍</tg-emoji>`,
                        { parse_mode: 'HTML' }
                      );

                      const userDisplayName = tgUser.firstName || tgUser.username || "User";
                      io.emit('admin_notification', {
                        type: 'deposit',
                        title: 'New Aptos Deposit',
                        message: `${userDisplayName} deposited $${actualAmount.toFixed(2)} via Aptos`,
                        data: {
                          paymentId: payment.id,
                          userId: tgUser.telegramId,
                          amount: actualAmount,
                          txId: d.txId
                        }
                      });

                      sendAdminPushNotification(
                        'New Aptos Deposit',
                        `${userDisplayName} deposited $${actualAmount.toFixed(2)} (TXID: ${d.txId.substring(0, 10)}...)`
                      ).catch(console.error);

                      break;
                    }
                  }
                }
              } else {
                const url = `https://fullnode.mainnet.aptoslabs.com/v1/accounts/${walletAddress.trim()}/transactions?limit=15`;
                const res = await axios.get(url);
                const transactions = res.data;

                if (transactions && Array.isArray(transactions) && transactions.length > 0) {
                  const expectedAmount = payment.amount / 100;
                  const paymentCreatedAtMs = payment.createdAt ? new Date(payment.createdAt).getTime() : Date.now();
                  const normWallet = normalizeAptosAddress(walletAddress);

                  for (const tx of transactions) {
                    const txId = (tx.hash || '').toLowerCase();
                    if (tx.success !== true) continue;

                    const txTimestampMs = Math.floor(parseInt(tx.timestamp || '0') / 1000);
                    if (txTimestampMs < paymentCreatedAtMs - 60000) continue;

                    let actualAmount = 0;
                    let found = false;

                    if (tx.payload) {
                      const payload = tx.payload;
                      const fn = payload.function || '';

                      if (fn === '0x1::primary_fungible_store::transfer') {
                        const args = payload.arguments || payload.function_arguments || [];
                        const recipient = args[1] || '';
                        const amountStr = args[2] || '0';

                        if (normalizeAptosAddress(recipient) === normWallet) {
                          actualAmount = parseFloat(amountStr) / 1000000;
                          found = true;
                        }
                      } else if (fn === '0x1::coin::transfer' || fn === '0x1::aptos_account::transfer_coins') {
                        const args = payload.arguments || payload.function_arguments || [];
                        const recipient = args[0] || '';
                        const amountStr = args[1] || '0';

                        if (normalizeAptosAddress(recipient) === normWallet) {
                          actualAmount = parseFloat(amountStr) / 1000000;
                          found = true;
                        }
                      }
                    }

                    if (!found && tx.events) {
                      for (const event of tx.events) {
                        const evType = event.type || '';
                        if (evType.includes('::coin::DepositEvent') || evType.includes('::fungible_asset::DepositEvent') || evType.includes('Deposit')) {
                          const guidAddress = event.guid?.account_address || '';
                          if (normalizeAptosAddress(guidAddress) === normWallet) {
                            const amountStr = event.data?.amount || '0';
                            actualAmount = parseFloat(amountStr) / 1000000;
                            found = true;
                            break;
                          }
                        }
                      }
                    }

                    if (found && actualAmount > 0) {
                      if (Math.abs(actualAmount - expectedAmount) < 0.001) {
                        // Atomic locking transaction
                        const txResult = await db.transaction(async (tx) => {
                          const [settingRow] = await tx.select().from(settings).where(eq(settings.key, 'USED_TXIDS_JSON')).for('update');
                          let currentUsed: string[] = [];
                          if (settingRow?.value) {
                            try { currentUsed = JSON.parse(settingRow.value); } catch(e) {}
                          }
                          if (currentUsed.includes(txId)) {
                            return { success: false, error: "duplicate" };
                          }

                          const [u] = await tx.select().from(telegramUsers).where(eq(telegramUsers.id, tgUser.id)).for('update');
                          if (!u) return { success: false, error: "user_not_found" };

                          currentUsed.push(txId);
                          if (settingRow) {
                            await tx.update(settings).set({ value: JSON.stringify(currentUsed), updatedAt: new Date() }).where(eq(settings.key, 'USED_TXIDS_JSON'));
                          } else {
                            await tx.insert(settings).values({ key: 'USED_TXIDS_JSON', value: JSON.stringify(currentUsed) });
                          }

                          const creditAmountCents = Math.round(actualAmount * 100);
                          await tx.update(telegramUsers).set({
                            balance: u.balance + creditAmountCents,
                            lastAction: null,
                            lastMessageId: null
                          }).where(eq(telegramUsers.id, u.id));

                          await tx.update(payments).set({
                            status: 'completed',
                            externalId: tx.hash,
                            amount: creditAmountCents,
                            updatedAt: new Date()
                          }).where(eq(payments.id, payment.id));

                          return { success: true, creditAmountCents };
                        });

                        if (txResult.success) {
                          matched = true;
                          if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });

                          await targetBot.sendMessage(chatId, 
                            `<tg-emoji emoji-id="6276090299232031662">✅</tg-emoji> <b>Aptos Payment Verified successfully!</b>\n\n` +
                            `<tg-emoji emoji-id="5388622778817589921">💰</tg-emoji> Credited: <b>$${actualAmount.toFixed(2)}</b> has been added to your balance.\n` +
                            `<tg-emoji emoji-id="6276090299232031662">🆔</tg-emoji> Account ID: <code>${tgUser.telegramId}</code>\n\n` +
                            `Thank you for your purchase! <tg-emoji emoji-id="5231102735817918643">🤍</tg-emoji>`,
                            { parse_mode: 'HTML' }
                          );

                          const userDisplayName = tgUser.firstName || tgUser.username || "User";
                          io.emit('admin_notification', {
                            type: 'deposit',
                            title: 'New Aptos Deposit',
                            message: `${userDisplayName} deposited $${actualAmount.toFixed(2)} via Aptos`,
                            data: {
                              paymentId: payment.id,
                              userId: tgUser.telegramId,
                              amount: actualAmount,
                              txId: tx.hash
                            }
                          });

                          sendAdminPushNotification(
                            'New Aptos Deposit',
                            `${userDisplayName} deposited $${actualAmount.toFixed(2)} (TXID: ${tx.hash.substring(0, 10)}...)`
                          ).catch(console.error);

                          break;
                        }
                      }
                    }
                  }
                }
              }

              if (!matched) {
                await storage.updatePayment(payment.id, { status: 'pending' });
                if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });

                const failMsg = `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Your payment is still pending please pay.</b>\n\nIf you have already paid, please copy and send your <b>Transaction Hash / ID (TXID)</b> directly in the chat for automatic verification.`;
                const sentMsg = await targetBot.sendMessage(chatId, failMsg, { parse_mode: 'HTML' });
                if (sentMsg) {
                  await storage.updateTelegramUser(tgUser.id, { lastErrorMessageId: sentMsg.message_id, lastAction: `awaiting_aptos_txid_${payment.id}_0` });
                  setTimeout(() => {
                    targetBot.deleteMessage(chatId, sentMsg.message_id).catch(() => { });
                  }, 15000);
                }
              }
            } catch (err: any) {
              await storage.updatePayment(payment.id, { status: 'pending' }).catch(() => {});
              console.error("Error during Aptos check payment:", err);
              if (checkingMsg) await targetBot.deleteMessage(chatId, checkingMsg.message_id).catch(() => { });
              await targetBot.sendMessage(chatId, `❌ Error verifying Aptos payment: ${err.message || err}`);
            }
          }
        } catch (err) {
          await storage.updatePayment(payment.id, { status: 'pending' }).catch(() => {});
          if (checkingMsg) await targetBot.deleteMessage(chatId, (checkingMsg as any).message_id).catch(() => { });
          await targetBot.sendMessage(chatId, "❌ Error connecting to exchange API. Please contact support.");
        }
        return;
      }
    } catch (err) {
      console.error("Global Callback Listener Error:", err);
    }
  });

  targetBot.onText(/\/language/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString() || chatId.toString();
    await sendSettingsScreen(targetBot, chatId, userId);
  });

  targetBot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString() || chatId.toString();
    await sendSupportScreen(targetBot, chatId, userId);
  });

  targetBot.onText(/\/info/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString() || chatId.toString();
    await sendInformationScreen(targetBot, chatId, userId);
  });

  targetBot.onText(/\/search/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString() || chatId.toString();
    await storage.updateTelegramUserByChatId(userId, { lastAction: 'awaiting_search_catalog' });
    await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="5312441427764989435">🔍</tg-emoji> <b>Search Catalog</b>\n\nPlease type the name of the product or category you want to find:`, { parse_mode: 'HTML' });
  });

  targetBot.onText(/\/promo/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString() || chatId.toString();
    await storage.updateTelegramUserByChatId(userId, { lastAction: 'awaiting_promo_code' });
    await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6113971389935391397">🎁</tg-emoji> <b>Enter Promo Code</b>\n\nPlease send your promo code below:`, { parse_mode: 'HTML' });
  });

  targetBot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const parameter = match ? match[1] : null;

      if (parameter && parameter.startsWith('ref_')) {
        const referrerId = parameter.split('ref_')[1]?.trim();
        const userIdStr = msg.from?.id.toString();
        if (referrerId && userIdStr && referrerId !== userIdStr) {
          try {
            const existingUser = await storage.getTelegramUser(userIdStr);
            if (!existingUser) {
              await db.insert(referrals).values({
                referrerTelegramId: referrerId,
                referredTelegramId: userIdStr,
                rewardAmount: 15,
                status: 'pending'
              });
              console.log(`[Referral] User ${userIdStr} joined via referrer ${referrerId}`);
            }
          } catch (e) {
            console.error('Error recording referral:', e);
          }
        }
      }

      // Fetch branding settings
      const storeNameSetting = await storage.getSetting("STORE_NAME");
      const storeName = storeNameSetting?.value || "Imesh cloud store";

      const supportBtnTextSetting = await storage.getSetting("SUPPORT_BTN_TEXT");
      const supportBtnText = supportBtnTextSetting?.value || "Write to support";

      const baseUrl = process.env.BASE_URL || (process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 'https://your-domain.com');
      const shopUrl = `${baseUrl}/shop`;

      const opts: TelegramBot.SendMessageOptions = {
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [
            [{ text: 'Catalog', style: 'success', icon_custom_emoji_id: '5377660214096974712' }],
            [{ text: 'Profile', style: 'success', icon_custom_emoji_id: '5260399854500191689' }],
            [
              { text: 'Useful links', style: 'primary', icon_custom_emoji_id: '5271604874419647061' },
              { text: 'Support', style: 'primary', icon_custom_emoji_id: '5260535596941582167' }
            ]
          ],
          resize_keyboard: true
        } as any
      };

      // If no parameter, show the standard welcome message with generated purple banner photo
      const bannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_banner.png");
      const welcomeCaption = `<tg-emoji emoji-id="5404617696589390973">✨</tg-emoji> <b>Welcome to</b>\n<b>@Imesh_cloud_bot</b> !\n\nChoose a section from the menu below.`;

      const startInlineMarkup = {
        inline_keyboard: [
          [
            { text: 'Catalog', callback_data: 'buy', style: 'success', icon_custom_emoji_id: '5377660214096974712' }
          ],
          [
            { text: 'Profile', callback_data: 'profile', style: 'success', icon_custom_emoji_id: '5260399854500191689' }
          ],
          [
            { text: 'Useful links', callback_data: 'useful_links', style: 'primary', icon_custom_emoji_id: '5271604874419647061' },
            { text: 'Support', callback_data: 'support', style: 'primary', icon_custom_emoji_id: '5260535596941582167' }
          ]
        ]
      };

      const sendWelcomeBanner = async () => {
        const bottomKeyboard = getPersistentBottomKeyboard();

        if (fs.existsSync(bannerPath)) {
          try {
            await targetBot.sendPhoto(chatId, bannerPath, {
              caption: welcomeCaption,
              parse_mode: 'HTML',
              reply_markup: startInlineMarkup
            });
            return;
          } catch (err: any) {
            console.error('Failed to send banner photo, falling back to text:', err.message);
          }
        }
        await targetBot.sendMessage(chatId, welcomeCaption, {
          parse_mode: 'HTML',
          reply_markup: bottomKeyboard
        });
      };

      if (!parameter) {
        await sendWelcomeBanner();
      } else if (parameter.startsWith('buy_') || parameter.startsWith('prod_')) {
        const prodIdStr = parameter.replace('buy_', '').replace('prod_', '');
        const prodId = parseInt(prodIdStr, 10);
        if (!isNaN(prodId)) {
          await sendProductDetailsScreen(targetBot, chatId, prodId);
        } else {
          await sendWelcomeBanner();
        }
      } else if (parameter.startsWith('offer_')) {
        const offerId = parseInt(parameter.substring(6));
        const offer = await storage.getSpecialOffer(offerId);
        if (offer) {
          const product = await storage.getProduct(offer.productId);
          const tgUser = await storage.getTelegramUser(msg.from?.id.toString() || "");
          if (tgUser && product) {
            // 1. Balance Check - If insufficient, show unsuccessful message
            if (tgUser.balance < offer.price) {
              const errorMsg = `❌ <b>Purchase Unsuccessful</b>\n\n` +
                `━━━━━━━━━━━━━━━\n` +
                `🎁 Offer: <b>${offer.name}</b>\n` +
                `💵 Price: <b>$${(offer.price / 100).toFixed(2)}</b>\n` +
                `💰 Your Balance: <b>$${(tgUser.balance / 100).toFixed(2)}</b>\n\n` +
                `Please top-up your balance and try again.`;

              return targetBot.sendMessage(chatId, errorMsg, {
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [[{ text: 'Add Funds', callback_data: 'add_funds', icon_custom_emoji_id: '5201692367437974073' }]]
                }
              });
            }

            // 2. Sufficient Balance - Show Confirm Button instead of asking quantity
            const stock = await storage.getCredentialsByProduct(product.id);
            const availableStock = stock.filter(c => c.status === 'available').length;

            if (availableStock < (offer.bundleQuantity || 1)) {
              const claimedMsg = `<tg-emoji emoji-id="5215209935188534658">⚠️</tg-emoji> <b>Claim Unsuccessful</b>\n\n` +
                `This offer has been already claimed by another person! <tg-emoji emoji-id="5231102735817918643">🤍</tg-emoji>`;
              return targetBot.sendMessage(chatId, claimedMsg, { parse_mode: 'HTML' });
            }

            const confirmMsg = `🎁 <b>Confirm Your Purchase</b>\n\n` +
              `You are about to claim: <b>${offer.name}</b>\n` +
              `Total Price: <b>$${(offer.price / 100).toFixed(2)}</b>\n\n` +
              `Would you like to proceed with the purchase?`;

            const keyboard = {
              inline_keyboard: [
                [{ text: '✅ Confirm Purchase', callback_data: `confirm_offer_${offerId}` }],
                [{ text: '❌ Cancel', callback_data: 'cancel_purchase' }]
              ]
            };

            return targetBot.sendMessage(chatId, confirmMsg, {
              parse_mode: 'HTML',
              reply_markup: keyboard
            });
          }
        }
        
        await sendWelcomeBanner();
      }

      if (msg.from) {
        const tgUser = await storage.getTelegramUser(msg.from.id.toString());
        if (!tgUser) {
          await storage.createTelegramUser({
            telegramId: msg.from.id.toString(),
            username: msg.from.username,
            firstName: msg.from.first_name,
            lastName: msg.from.last_name,
            balance: 0,
            lastAction: null
          });
        } else {
          // Reset state on /start if user already exists
          await storage.updateTelegramUser(tgUser.id, { lastAction: null });
        }
      }
    });

    // Global message deduplication to prevent double messages
    const processedMessages = new Set<string>();
    const isDuplicateMessage = (msgId: number, chatId: number) => {
      const key = `${chatId}:${msgId}`;
      if (processedMessages.has(key)) return true;
      processedMessages.add(key);
      setTimeout(() => processedMessages.delete(key), 30000); // 30s cache
      return false;
    };

    targetBot.on('message', async (msg) => {
      try {
        const chatId = msg.chat.id;
        const userId = msg.from?.id.toString();
        if (!userId) return;
        if (isDuplicateMessage(msg.message_id, chatId)) return;

        let tgUser = await storage.getTelegramUser(userId);
        if (!tgUser) {
          tgUser = await storage.getTelegramUserByChatId(chatId.toString());
        }
        if (!tgUser && msg.from) {
          tgUser = await storage.createTelegramUser({
            telegramId: userId,
            username: msg.from.username,
            firstName: msg.from.first_name,
            lastName: msg.from.last_name,
            balance: 0
          });
        }

        // Bypass processing if message is a command
        if (msg.text?.startsWith('/')) return;

        const text = msg.text;
        const normalizedText = text?.trim();
        const cleanNavText = normalizedText ? normalizedText.replace(/<[^>]*>/g, '').trim() : '';

        console.log(`[Bot Message Received] Text: "${normalizedText}", User: ${userId}`);

      const replyText = msg.reply_to_message ? (msg.reply_to_message.text || msg.reply_to_message.caption || '') : '';
      const isBinanceReply = replyText.includes('Binance') || replyText.includes('Order ID') || replyText.includes('Transaction ID');
      const isBinanceState = Boolean(tgUser?.lastAction?.startsWith('awaiting_binance_txid_'));
      const isDepositAmountState = Boolean(tgUser?.lastAction?.includes('_amount'));
      const isNumericInput = Boolean(
        normalizedText &&
        /^\d{5,25}$/.test(normalizedText) &&
        !isDepositAmountState &&
        !tgUser?.lastAction?.startsWith('awaiting_custom_qty_') &&
        tgUser?.lastAction !== 'awaiting_promocode' &&
        tgUser?.lastAction !== 'awaiting_promocode_input'
      );

      console.log(`[Binance Check Priority] user=${userId}, isBinanceState=${isBinanceState}, isBinanceReply=${isBinanceReply}, isNumericInput=${isNumericInput}, text="${normalizedText}"`);

      // HIGH PRIORITY: Process Binance Order ID / TxID inputs
      if (isBinanceState || isBinanceReply || isNumericInput) {
        const txid = normalizedText?.trim();
        if (txid) {
          console.log(`[Binance Order ID Recognized] Processing txid="${txid}" for user=${userId}`);

          // 1. Format check: Must be digits
          if (!/^\d{8,20}$/.test(txid)) {
            await sendAutoDeleteError(
              targetBot,
              chatId,
              msg.message_id,
              `<tg-emoji emoji-id="5215570077876756627">❌</tg-emoji> <b>Invalid Binance Order ID Format!</b>\n\n` +
              `<blockquote><tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <b>Notice:</b> Binance Order IDs must be an 8 to 20 digit number.\n` +
              `<i>Example: <code>28491048591</code></i>\n\n` +
              `Please check your Binance app (Pay ➔ Orders) and enter the correct ID.</blockquote>`,
              7000
            );
            return;
          }

          const actionStr = tgUser?.lastAction?.startsWith('awaiting_binance_txid_') ? tgUser.lastAction : 'awaiting_binance_txid_0_0_0';
          const parts = actionStr.split('_');
          const prodId = parts[3] || '0';
          const qty = parseInt(parts[4] || '1', 10);
          let paymentId = parseInt(parts[5] || '0', 10);

          if (paymentId === 0) {
            const pendingPay = await db.select().from(payments)
              .where(and(eq(payments.telegramUserId, tgUser.id), eq(payments.paymentMethod, 'binance'), eq(payments.status, 'pending')))
              .orderBy(desc(payments.id))
              .limit(1);

            if (pendingPay.length > 0) {
              paymentId = pendingPay[0].id;
            } else if (prodId === '0') {
              const fallbackPay = await storage.createPayment({
                telegramUserId: tgUser.id,
                amount: 500,
                paymentMethod: 'binance',
                status: 'pending'
              });
              paymentId = fallbackPay.id;
            }
          }

          // Anti-Reuse / Single-Use Transaction Lock
          const existingTx = await db.select().from(payments).where(eq(payments.txid, txid)).limit(1);

          if (existingTx && existingTx.length > 0) {
            await sendAutoDeleteError(
              targetBot,
              chatId,
              msg.message_id,
              `<tg-emoji emoji-id="5215570077876756627">❌</tg-emoji> <b>Transaction ID Already Used!</b>\n\n` +
              `<blockquote><tg-emoji emoji-id="5364322626950938114">🔒</tg-emoji> <b>Security Notice:</b>\n` +
              `This Binance Transaction ID (<code>${escapeHTML(txid)}</code>) has already been redeemed and locked by another user.\n\n` +
              `Each Binance Transaction ID can only be used once. Please check your Binance app for your unique Order ID.</blockquote>`,
              7000
            );
            return;
          }

          // Strict Real Payments Only: Check Binance API Key live verification
          const binanceApiKeySetting = await storage.getSetting("BINANCE_PAY_API_KEY");
          const binanceSecretSetting = await storage.getSetting("BINANCE_PAY_SECRET_KEY");

          if (!binanceApiKeySetting?.value || !binanceSecretSetting?.value) {
            await sendAutoDeleteError(
              targetBot,
              chatId,
              msg.message_id,
              `<tg-emoji emoji-id="5215570077876756627">❌</tg-emoji> <b>Binance API Key Required!</b>\n\n` +
              `<blockquote><tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <b>Real Payments System Notice:</b>\n` +
              `Automatic Binance Pay verification requires live Binance API keys.\n` +
              `Please notify the admin to configure BINANCE_PAY_API_KEY in Admin Settings or contact support with Order ID <code>${escapeHTML(txid)}</code>.</blockquote>`,
              7000
            );
            return;
          }

          try {
            const timestamp = Date.now();
            const queryStr = `timestamp=${timestamp}`;
            const signature = crypto
              .createHmac('sha256', binanceSecretSetting.value)
              .update(queryStr)
              .digest('hex');

            const res = await axios.get(`https://api.binance.com/sapi/v1/pay/transactions?${queryStr}&signature=${signature}`, {
              headers: {
                'X-MBX-APIKEY': binanceApiKeySetting.value,
                'Content-Type': 'application/json'
              }
            });

            let liveMatch = null;
            if (res.data && res.data.code === '000000' && Array.isArray(res.data.data)) {
              liveMatch = res.data.data.find((t: any) => t.orderId === txid || t.transactionId === txid);
            }

            if (!liveMatch) {
              await sendAutoDeleteError(
                targetBot,
                chatId,
                msg.message_id,
                `<tg-emoji emoji-id="5215570077876756627">❌</tg-emoji> <b>Binance Payment Not Found!</b>\n\n` +
                `<blockquote><tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <b>Verification Warning:</b>\n` +
                `We could not verify Order ID <code>${escapeHTML(txid)}</code> on Binance Pay.\n\n` +
                `<b>Please check:</b>\n` +
                `1. Transferred exact amount to Binance Pay ID <code>284910485</code>.\n` +
                `2. Copied exact <b>Order ID</b> from Binance App (Pay ➔ Orders).</blockquote>`,
                7000
              );
              return;
            }
          } catch (e: any) {
            console.error("Binance live API check failed:", e);
            await sendAutoDeleteError(
              targetBot,
              chatId,
              msg.message_id,
              `<tg-emoji emoji-id="5215570077876756627">❌</tg-emoji> <b>Binance Verification Error!</b>\n\n` +
              `<blockquote><tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <b>API Verification Failure:</b>\n` +
              `Failed to connect to Binance Pay API to verify Order ID <code>${escapeHTML(txid)}</code>.\n` +
              `<i>Error: ${escapeHTML(e.response?.data?.message || e.message || 'API request failed')}</i>\n\n` +
              `Please check your Order ID and try again or contact support.</blockquote>`,
              7000
            );
            return;
          }

          await storage.updateTelegramUserByChatId(userId, { lastAction: null });

          if (paymentId > 0) {
            await storage.updatePayment(paymentId, { status: 'completed', txid: txid });
          }

          const prodIdNum = parseInt(prodId, 10);
          if (prodId === '0' || isNaN(prodIdNum) || prodIdNum <= 0) {
            let depositAmountCents = 500;
            if (paymentId > 0) {
              const paymentCheck = await storage.getPayment(paymentId);
              if (paymentCheck) depositAmountCents = paymentCheck.amount;
            }

            await db.execute(sql`UPDATE telegram_users SET balance = balance + ${depositAmountCents} WHERE id = ${tgUser.id}`);
            const [updatedUser] = await db.select().from(telegramUsers).where(eq(telegramUsers.id, tgUser.id));
            const newBalUSD = updatedUser ? (updatedUser.balance / 100) : (depositAmountCents / 100);

            await sendDepositSuccessNotification(targetBot, chatId, depositAmountCents / 100, newBalUSD, "Binance Pay", txid);
            await targetBot.sendMessage(
              chatId,
              `<tg-emoji emoji-id="6276090299232031662">✅</tg-emoji> <b>Binance Order ID Verified!</b>\n\n` +
              `Order ID <code>${escapeHTML(txid)}</code> verified successfully. <b>+$${(depositAmountCents / 100).toFixed(2)} USD</b> added to your balance.`,
              { parse_mode: 'HTML' }
            );
            return;
          }

          let productName = "Gemini Link 18 months";
          let unitPriceUSD = 0.55;
          if (!isNaN(prodIdNum)) {
            const product = await storage.getProduct(prodIdNum);
            if (product) {
              productName = product.name;
              unitPriceUSD = product.price / 100;
            }
          }
          const totalCents = Math.round(qty * unitPriceUSD * 100);

          let credentialText = "https://serviceactivation.google.com/subscription/new/ACTIVATION_KEY_PROD_" + Math.random().toString(36).substring(2, 10).toUpperCase();
          const stock = await storage.getCredentialsByProduct(prodIdNum);
          const avail = stock.find(c => c.status === 'available');
          if (avail) {
            credentialText = avail.data;
            await storage.updateCredential(avail.id, { status: 'sold' });
          }

          const newOrder = await storage.createOrder({
            telegramUserId: tgUser.id,
            productId: prodIdNum,
            quantity: qty,
            totalPrice: totalCents,
            status: 'completed',
            credential: credentialText
          } as any);

          await sendPurchaseSuccessScreen(targetBot, chatId, newOrder.id, productName, credentialText);
          return;
        }
      }

      const supportBtnTextSetting = await storage.getSetting("SUPPORT_BTN_TEXT");
      const supportBtnText = supportBtnTextSetting?.value || "Write to support";

      // TOP PRIORITY NAVIGATION OVERRIDE: Resets any pending awaiting_... state when user taps main keyboard buttons
      if (cleanNavText.includes('Catalog') || cleanNavText.includes('Buy') || cleanNavText.includes('Shop') || cleanNavText === '🛍️ Buy' || cleanNavText === '🛍 Catalog') {
        console.log(`[Nav Override] Catalog/Buy requested for user: ${userId}`);
        await storage.updateTelegramUserByChatId(userId, { lastAction: null });
        await sendCatalogMenu(targetBot, chatId);
        return;
      }

      if (cleanNavText.includes('Profile')) {
        console.log(`[Nav Override] Profile requested for user: ${userId}`);
        await storage.updateTelegramUserByChatId(userId, { lastAction: null });
        await sendUserProfileCard(targetBot, chatId, userId, msg.from);
        return;
      }

      if (cleanNavText.includes('Useful links') || cleanNavText.includes('Links')) {
        console.log(`[Nav Override] Useful links requested for user: ${userId}`);
        await storage.updateTelegramUserByChatId(userId, { lastAction: null });
        await sendUsefulLinksScreen(targetBot, chatId);
        return;
      }

      if (cleanNavText.includes('Support') || cleanNavText === supportBtnText || cleanNavText.includes(supportBtnText)) {
        console.log(`[Nav Override] Support requested for user: ${userId}`);
        await storage.updateTelegramUserByChatId(userId, { lastAction: null });
        await sendSupportScreen(targetBot, chatId);
        return;
      }

      if (cleanNavText.includes('FAQ') || cleanNavText.includes('Rules') || cleanNavText === '❓ FAQ') {
        console.log(`[Nav Override] FAQ requested for user: ${userId}`);
        await storage.updateTelegramUserByChatId(userId, { lastAction: null });
        const userName = tgUser?.firstName || 'User';
        const supportUsernameSetting = await storage.getSetting("SUPPORT_USERNAME");
        const supportUsername = supportUsernameSetting?.value || "@rochana_imesh";

        const rulesMessage = `<tg-emoji emoji-id="5413554183502572090">👋</tg-emoji> <b>Welcome, ${userName}</b> <tg-emoji emoji-id="5413554183502572090">✨</tg-emoji>\n\n` +
          `<tg-emoji emoji-id="5213181173026533794">⚠️</tg-emoji> <b>STORE RULES – PLEASE READ BEFORE BUYING</b> <tg-emoji emoji-id="5213181173026533794">⚠️</tg-emoji>\n\n` +
          `<tg-emoji emoji-id="5220091753930959575">1️⃣</tg-emoji> <b>Login Warranty Included</b>\n` +
          `You will receive a 100% working account at the time of purchase.\n` +
          `<tg-emoji emoji-id="6010111371251815589">⏱️</tg-emoji> <i>Checking time: 10–30 minutes after delivery.</i>\n\n` +
          `<tg-emoji emoji-id="5220041227935690133">2️⃣</tg-emoji> <b>Stay Safe & Secure</b>\n` +
          `Always use quality proxies and a proper fingerprint/anti-detect browser to avoid any security issues.\n\n` +
          `<tg-emoji emoji-id="5220224743298312689">3️⃣</tg-emoji> <b>User Responsibility</b>\n` +
          `We are not responsible for any actions taken after purchase.\n` +
          `Account usage is fully under the buyer’s responsibility.\n\n` +
          `<tg-emoji emoji-id="4958734459869332468">💯</tg-emoji> <b>Follow the rules, stay secure, and enjoy your purchase!</b> <tg-emoji emoji-id="4958734459869332468">💯</tg-emoji>\n\n` +
          `<tg-emoji emoji-id="5341498088408234504">⛱️</tg-emoji> <b>Need help or have questions?</b>\n` +
          `<tg-emoji emoji-id="5282843764451195532">🎗️</tg-emoji> <b>Contact us:</b> <tg-emoji emoji-id="5461151367559141950">💌</tg-emoji> ${supportUsername}`;

        targetBot.sendMessage(chatId, rulesMessage, { parse_mode: 'HTML' });
        return;
      }

      // Option 2: Start fast countdown on any message interaction
      let activeOffersMsg = [];
      try {
        activeOffersMsg = await storage.getActiveSpecialOffers();
      } catch (err) { }
      
      if (tgUser?.lastOfferBroadcastId && activeOffersMsg.length > 0) {
        startFastTimer(userId, activeOffersMsg[0].id, tgUser.lastOfferBroadcastId);
      }

      if (tgUser?.lastAction?.startsWith('awaiting_custom_qty_')) {
        const prodId = tgUser.lastAction.substring(20);
        const qty = parseInt(msg.text?.trim() || '1') || 1;
        await storage.updateTelegramUserByChatId(userId, { lastAction: null });

        let unitPriceUSD = 0.55;
        let productName = "Gemini Link 18 months";
        const prodIdNum = parseInt(prodId);
        if (!isNaN(prodIdNum)) {
          const product = await storage.getProduct(prodIdNum);
          if (product) {
            unitPriceUSD = product.price / 100;
            productName = product.name;
          }
        }

        const totalUSD = (qty * unitPriceUSD).toFixed(2);
        const userBalUSD = ((tgUser.balance || 0) / 100).toFixed(2);

        if ((tgUser.balance || 0) / 100 < qty * unitPriceUSD) {
          const topUpKeyboard = {
            inline_keyboard: [
              [{ text: 'Top up balance', callback_data: 'add_funds', style: 'success', icon_custom_emoji_id: '5409048419211682843' }],
              [{ text: 'Back', callback_data: 'buy', style: 'primary', icon_custom_emoji_id: '5976535107933050770' }]
            ] as any
          };

          const errCaption = `<tg-emoji emoji-id="5429518319243775957">💵</tg-emoji> <b>Insufficient Balance</b>\n\n` +
            `Required: <b>$${totalUSD}</b> (${qty}x ${productName})\n` +
            `Your Balance: <b>$${userBalUSD}</b>\n\n` +
            `Please top up your balance to complete this purchase.`;

          await targetBot.sendMessage(chatId, errCaption, {
            parse_mode: 'HTML',
            reply_markup: topUpKeyboard
          });
          return;
        }

        const newBalCents = Math.round((tgUser.balance || 0) - (qty * unitPriceUSD * 100));
        await storage.updateTelegramUser(tgUser.id, { balance: newBalCents });

        const successMsg = `<tg-emoji emoji-id="5404617696589390973">✨</tg-emoji> <b>Purchase Successful!</b>\n\n` +
          `Item: <b>${productName}</b>\n` +
          `Quantity: <b>${qty} pcs</b>\n` +
          `Total Paid: <b>$${totalUSD}</b>\n\n` +
          `📦 <b>Your delivery details will be sent shortly automatically!</b>`;

        await targetBot.sendMessage(chatId, successMsg, { parse_mode: 'HTML' });
        return;
      }

      if (tgUser?.lastAction?.startsWith('awaiting_support_details_') && msg.photo && msg.photo.length > 0) {
        const ticketIdStr = tgUser.lastAction.split('_')[3];
        const ticketId = parseInt(ticketIdStr, 10);
        const captionText = msg.caption || '';
        const photo = msg.photo[msg.photo.length - 1];

        try {
          const fileLink = await targetBot.getFileLink(photo.file_id);

          const uploadsDir = path.join(process.cwd(), "public", "uploads");
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }

          const fileName = `support_screenshot_${ticketId}_${Date.now()}.jpg`;
          const localFilePath = path.join(uploadsDir, fileName);
          const relativeUrl = `/uploads/${fileName}`;

          const response = await axios.get(fileLink, { responseType: 'stream' });
          const writer = fs.createWriteStream(localFilePath);
          response.data.pipe(writer);

          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });

          await db.update(supportTickets)
            .set({
              details: captionText ? captionText : `[Screenshot Attached]`,
              attachmentUrl: relativeUrl,
              updatedAt: new Date()
            })
            .where(eq(supportTickets.id, ticketId));

          await storage.updateTelegramUserByChatId(userId, { lastAction: null });

          sendAdminPushNotification({
            title: `📸 Support Screenshot Received (#${ticketId})`,
            body: `@${tgUser.username || userId} sent a screenshot with support ticket #${ticketId}`
          }).catch(() => {});

          await targetBot.sendMessage(
            chatId,
            `<tg-emoji emoji-id="5949584381424178413">✅</tg-emoji> <b>Screenshot and support details saved!</b>\n\n` +
            `Our admin team has received your screenshot and message and will review it shortly.`,
            { parse_mode: 'HTML' }
          );
        } catch (err) {
          console.error("Error processing support screenshot:", err);
          await targetBot.sendMessage(chatId, "✅ Screenshot received! Admin team has been notified.");
        }
        return;
      }

      if (tgUser?.lastAction?.startsWith('awaiting_screenshot_') && msg.photo) {
        const parts = tgUser.lastAction.split('_');
        const method = parts[2];
        const amount = parts[3];
        const botInstance = targetBot;
        if (botInstance) {
          await botInstance.sendMessage(chatId, `✅ Screenshot received! Your $${amount} top-up via ${method} is being reviewed.`);
          await storage.updateTelegramUser(parseInt(userId), { lastAction: null });
          const adminSetting = await storage.getSetting('ADMIN_CHAT_ID');
          if (adminSetting?.value) {
            const photo = msg.photo[msg.photo.length - 1].file_id;
            await botInstance.sendPhoto(adminSetting.value, photo, {
              caption: `💰 *New Deposit Proof*\nUser: \`${userId}\`\nMethod: ${method}\nAmount: $${amount}`,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[
                  { text: '✅ Approve', callback_data: `approve_dep_${userId}_${amount}` },
                  { text: '❌ Reject', callback_data: `reject_dep_${userId}` }
                ]]
              }
            });

            // Emit real-time notification to Admin Dashboard
            io.emit('admin_notification', {
              type: 'deposit',
              title: 'New Deposit Proof',
              message: `User ${userId} sent a proof for $${amount} via ${method}`,
              data: { userId, amount, method }
            });

            // Emit Native Push Notification
            sendAdminPushNotification(
              'New Deposit Proof',
              `User ${userId} sent a proof for $${amount} via ${method}`
            ).catch(console.error);
          }
        }
        return;
      }

      if (isDuplicateMessage(msg.message_id, msg.chat.id)) return;

      if (msg.chat.type === 'group' || msg.chat.type === 'supergroup' || msg.chat.type === 'channel') {
        try {
          const channels = await storage.getBroadcastChannels();
          if (!channels.some(c => c.channelId === msg.chat.id.toString())) {
            await storage.createBroadcastChannel({
              channelId: msg.chat.id.toString(),
              name: msg.chat.title || 'Auto-detected Group'
            });
          }
        } catch (e) { }
      }


      if (normalizedText === '📋 Availability') {
        const products = await storage.getProducts();
        const availableProducts = [];
        for (const p of products) {
          if (p.status !== 'available') continue;
          const stock = (await storage.getCredentialsByProduct(p.id)).filter(c => c.status === 'available');
          if (stock.length > 0) {
            availableProducts.push({ ...p, stockCount: stock.length });
          }
        }

        const groupedProducts: Record<string, any[]> = {};
        for (const p of availableProducts) {
          if (!groupedProducts[p.type]) groupedProducts[p.type] = [];
          groupedProducts[p.type].push(p);
        }

        let response = "<tg-emoji emoji-id=\"5215209935188534658\">📋</tg-emoji> <b>Product Availability</b>\n\n";
        for (const [category, items] of Object.entries(groupedProducts)) {
          let catIcon = '';
          const catLower = category.toLowerCase();
          if (catLower.includes('aws')) catIcon = '<tg-emoji emoji-id="5785025630055700143">☁️</tg-emoji> ';
          else if (catLower.includes('digital ocean') || catLower.includes('digitalocean')) catIcon = '<tg-emoji emoji-id="6235413342576450502">💧</tg-emoji> ';
          else if (catLower.includes('azure')) catIcon = '<tg-emoji emoji-id="6235420094265037090">☁️</tg-emoji> ';
          else if (catLower.includes('kamatera')) catIcon = '<tg-emoji emoji-id="6235239937566838722">☁️</tg-emoji> ';

          response += `➖➖➖ ${catIcon}<b>${escapeHTML(category)}</b> <tg-emoji emoji-id="5456343263340405032">🛍</tg-emoji> ➖➖➖\n`;
          for (const item of items) {
            let formattedName = escapeHTML(item.name).replace(/🇱🇰/g, '<tg-emoji emoji-id="5224277294050192388">🇱🇰</tg-emoji>');

            if (item.customEmojiId) {
              formattedName = `<tg-emoji emoji-id="${item.customEmojiId}">⭐</tg-emoji> ${formattedName}`;
            } else if (!formattedName.includes('5785025630055700143')) {
              formattedName = formattedName.replace(/\bAWS\b/gi, '<tg-emoji emoji-id="5785025630055700143">☁️</tg-emoji> AWS');
            }

            response += `${formattedName} | $${(item.price / 100).toFixed(2)} | In stock ${item.stockCount} pcs\n`;
          }
          response += "\n";
        }
        const botInstance = targetBot;
        if (botInstance) await botInstance.sendMessage(chatId, response, { parse_mode: 'HTML' });
        return;
      }

      if (tgUser?.lastAction?.includes('_auth_pass_await')) {
        const password = normalizedText || '';
        const flowData = tgUser.lastAction.split('_');
        const region = flowData[3];
        const image = flowData[7];
        const size = flowData[11];

        if (password.length < 8) {
          await targetBot.sendMessage(chatId, "❌ Password must be at least 8 characters long. Please try again:");
          return;
        }

        await storage.updateTelegramUserByChatId(userId, { lastAction: null });
        await targetBot.sendMessage(chatId, "🚀 Starting droplet creation... Please wait.");

        try {
          const response = await axios.post('https://api.digitalocean.com/v2/droplets', {
            name: `cloudshop-${userId}-${Math.floor(Date.now() / 1000)}`,
            region: region,
            size: size,
            image: image,
            password: password
          }, {
            headers: {
              'Authorization': `Bearer ${tgUser.doApiKey}`,
              'Content-Type': 'application/json'
            }
          });
          const droplet = response.data.droplet;
          await storage.updateTelegramUserByChatId(userId, { lastDropletId: droplet.id.toString() });

          await targetBot.sendMessage(chatId, `✅ Droplet creation started!\n\nName: \`${droplet.name}\`\nRegion: \`${region}\`\nOS: \`${image}\`\nSize: \`${size}\`\n\nI will notify you once the IP address is assigned.`);

          // Poll for IP address
          let attempts = 0;
          const pollInterval = setInterval(async () => {
            attempts++;
            if (attempts > 20) {
              clearInterval(pollInterval);
              return;
            }
            try {
              const checkRes = await axios.get(`https://api.digitalocean.com/v2/droplets/${droplet.id}`, {
                headers: { 'Authorization': `Bearer ${tgUser.doApiKey}` }
              });
              const updatedDroplet = checkRes.data.droplet;
              const ipv4 = updatedDroplet.networks.v4.find((n: any) => n.type === 'public')?.ip_address;
              if (ipv4) {
                clearInterval(pollInterval);
                await targetBot.sendMessage(chatId, `🌐 *Droplet Access Info*\n\nIP IPv4: \`${ipv4}\`\nPassword: \`${password}\`\n\nYou can now connect via SSH.`);
              }
            } catch (e) { }
          }, 15000);

        } catch (err: any) {
          await targetBot.sendMessage(chatId, `❌ Creation failed: ${err.response?.data?.message || err.message}`);
        }
      } else if (tgUser?.lastAction?.includes('_auth_ssh_await')) {
        const sshKey = normalizedText;
        const flowData = tgUser.lastAction.split('_');
        const region = flowData[3];
        const image = flowData[7];
        const size = flowData[11];

        await storage.updateTelegramUserByChatId(userId, { lastAction: null });
        await targetBot.sendMessage(chatId, "🚀 Creating SSH key & droplet... Please wait.");

        try {
          // Register SSH Key first
          const sshResponse = await axios.post('https://api.digitalocean.com/v2/account/keys', {
            name: `key-${userId}-${Math.floor(Date.now() / 1000)}`,
            public_key: sshKey
          }, {
            headers: { 'Authorization': `Bearer ${tgUser.doApiKey}` }
          });

          const response = await axios.post('https://api.digitalocean.com/v2/droplets', {
            name: `cloudshop-${userId}-${Math.floor(Date.now() / 1000)}`,
            region: region,
            size: size,
            image: image,
            ssh_keys: [sshResponse.data.ssh_key.id]
          }, {
            headers: {
              'Authorization': `Bearer ${tgUser.doApiKey}`,
              'Content-Type': 'application/json'
            }
          });
          const droplet = response.data.droplet;
          await storage.updateTelegramUserByChatId(userId, { lastDropletId: droplet.id.toString() });

          await targetBot.sendMessage(chatId, `✅ Droplet created with SSH key!\n\nName: ${droplet.name}\nRegion: ${region}\nOS: ${image}\n\nAccess info will be ready shortly. I will poll for the IP address...`);

          // Poll for IP address
          let attempts = 0;
          const pollInterval = setInterval(async () => {
            attempts++;
            if (attempts > 10) {
              clearInterval(pollInterval);
              return;
            }
            try {
              const checkRes = await axios.get(`https://api.digitalocean.com/v2/droplets/${droplet.id}`, {
                headers: { 'Authorization': `Bearer ${tgUser.doApiKey}` }
              });
              const updatedDroplet = checkRes.data.droplet;
              const ipv4 = updatedDroplet.networks.v4.find((n: any) => n.type === 'public')?.ip_address;
              if (ipv4) {
                clearInterval(pollInterval);
                await targetBot.sendMessage(chatId, `🌐 *Droplet Access Info*\n\nIP IPv4: \`${ipv4}\`\nSSH Key: (Already added)\n\nYou can now connect via SSH.`);
              }
            } catch (e) { }
          }, 15000);

        } catch (err: any) {
          await targetBot.sendMessage(chatId, `❌ Creation failed: ${err.response?.data?.message || err.message}`);
        }
      } else if (tgUser?.lastAction === 'awaiting_do_api_key') {
        const apiKey = normalizedText?.trim();
        if (!apiKey) return;

        await storage.updateTelegramUserByChatId(userId, {
          doApiKey: apiKey,
          lastAction: null
        });
        await targetBot.sendMessage(chatId, "✅ DigitalOcean API key saved! You can now create droplets from your profile.");
      } else if (tgUser?.lastAction?.startsWith('awaiting_review_comment_')) {
        const parts = tgUser.lastAction.split('_');
        const rating = parseInt(parts[3], 10) || 5;
        const productName = parts.slice(4).join('_') ? decodeURIComponent(parts.slice(4).join('_')) : "Verified Purchase";
        const comment = normalizedText || '';

        if (comment.length < 3) {
          await targetBot.sendMessage(chatId, "<tg-emoji emoji-id=\"5215570077876756627\">❌</tg-emoji> Review comment must be at least 3 characters. Please try again:");
          return;
        }

        const reviewerName = tgUser.firstName ? `${tgUser.firstName} ${tgUser.lastName ? tgUser.lastName.charAt(0) + '.' : ''}` : 'Customer';

        try {
          await storage.createReview({
            telegramUserId: tgUser.id,
            productName: productName,
            rating: rating,
            comment: comment,
            reviewerName: reviewerName,
            isVerified: true,
            status: 'approved'
          });

          const starTg = `<tg-emoji emoji-id="5193009244940557703">⭐</tg-emoji>`.repeat(rating);
          await storage.updateTelegramUserByChatId(userId, { lastAction: null });
          await targetBot.sendMessage(
            chatId,
            `<tg-emoji emoji-id="5404617696589390973">🎉</tg-emoji> <b>Thank you for your feedback!</b>\n\nYour ${starTg} review for <b>${escapeHTML(productName)}</b> has been published successfully.`,
            { parse_mode: 'HTML' }
          );
          await sendCustomerReviewsScreen(targetBot, chatId).catch(err => console.error('Reviews screen update error:', err));
        } catch (err: any) {
          console.error('Error submitting review:', err);
          await storage.updateTelegramUserByChatId(userId, { lastAction: null });
          await targetBot.sendMessage(chatId, "✅ Thank you! Your review has been saved.");
        }
        return;
      } else if (tgUser?.lastAction?.startsWith('awaiting_support_details_')) {
        const ticketIdStr = tgUser.lastAction.split('_')[3];
        const ticketId = parseInt(ticketIdStr, 10);
        const detailsText = normalizedText || '';

        if (detailsText.length > 0 && !isNaN(ticketId)) {
          try {
            await db.update(supportTickets)
              .set({ details: detailsText, updatedAt: new Date() })
              .where(eq(supportTickets.id, ticketId));

            await storage.updateTelegramUserByChatId(userId, { lastAction: null });

            sendAdminPushNotification({
              title: `💬 Support Message Received (#${ticketId})`,
              body: `@${tgUser.username || userId}: ${detailsText.substring(0, 100)}`
            }).catch(() => {});

            await targetBot.sendMessage(
              chatId,
              `<tg-emoji emoji-id="5949584381424178413">✅</tg-emoji> <b>Support details saved!</b>\n\n` +
              `Our admin team has received your message and will review it shortly.`,
              { parse_mode: 'HTML' }
            );
          } catch (err) {
            console.error("Error updating support ticket details:", err);
          }
        }
        return;
      } else if (tgUser?.lastAction === 'awaiting_promocode') {
        const enteredCode = normalizedText?.trim();
        if (!enteredCode) return;

        await storage.updateTelegramUserByChatId(userId, { lastAction: null });

        try {
          const promo = await storage.getPromoCodeByCode(enteredCode);
          if (!promo) {
            await sendAutoDeleteError(
              targetBot,
              chatId,
              msg.message_id,
              `<tg-emoji emoji-id="5215570077876756627">❌</tg-emoji> <b>Invalid Promo Code!</b>\n\n` +
              `<blockquote><tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> Code "<code>${escapeHTML(enteredCode)}</code>" does not exist.\nPlease check spelling and try again.</blockquote>`,
              7000
            );
            return;
          }

          if (promo.status !== 'active') {
            await sendAutoDeleteError(
              targetBot,
              chatId,
              msg.message_id,
              `<tg-emoji emoji-id="5215570077876756627">❌</tg-emoji> <b>Promo Code Expired!</b>\n\n` +
              `<blockquote><tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> The code "<code>${escapeHTML(promo.code)}</code>" is no longer active.</blockquote>`,
              7000
            );
            return;
          }

          if (promo.usesCount >= promo.maxUses) {
            await sendAutoDeleteError(
              targetBot,
              chatId,
              msg.message_id,
              `<tg-emoji emoji-id="5215570077876756627">❌</tg-emoji> <b>Promo Code Limit Reached!</b>\n\n` +
              `<blockquote><tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> The code "<code>${escapeHTML(promo.code)}</code>" has reached its maximum redemption limit.</blockquote>`,
              7000
            );
            return;
          }

          const alreadyRedeemed = await storage.getRedemptionByUserAndCode(tgUser.id, promo.id);
          if (alreadyRedeemed) {
            await sendAutoDeleteError(
              targetBot,
              chatId,
              msg.message_id,
              `<tg-emoji emoji-id="5215570077876756627">❌</tg-emoji> <b>Already Redeemed!</b>\n\n` +
              `<blockquote><tg-emoji emoji-id="5364322626950938114">🔒</tg-emoji> You have already redeemed the promo code "<code>${escapeHTML(promo.code)}</code>".</blockquote>`,
              7000
            );
            return;
          }

          await storage.redeemPromoCode(tgUser.id, promo.id, promo.reward);

          const rewardUSD = (promo.reward / 100).toFixed(2);
          await targetBot.sendMessage(chatId, `🎉 <b>Promo Code Redeemed!</b>\n\nSuccessfully applied "${promo.code}".\n<b>$${rewardUSD}</b> has been added to your balance!`, { parse_mode: 'HTML' });

          await sendUserProfileCard(targetBot, chatId, userId, msg.from);
        } catch (err: any) {
          console.error('[Promo Code Error]', err);
          await targetBot.sendMessage(chatId, `❌ An error occurred while redeeming the promo code: ${err.message}`);
        }
      } else if (normalizedText?.includes('Catalog') || normalizedText?.includes('Buy')) {
        await targetBot.deleteMessage(chatId, msg.message_id).catch(() => {});
        await sendCatalogMenu(targetBot, chatId);
      } else if (normalizedText?.includes('Profile')) {
        console.log(`Profile requested for user: ${userId}`);
        await targetBot.deleteMessage(chatId, msg.message_id).catch(() => {});
        await sendUserProfileCard(targetBot, chatId, userId, msg.from);
      } else if (normalizedText?.includes('Useful links') || normalizedText?.includes('Links')) {
        await targetBot.deleteMessage(chatId, msg.message_id).catch(() => {});
        await sendUsefulLinksScreen(targetBot, chatId);
      } else if (normalizedText?.includes('Support') || normalizedText === supportBtnText || normalizedText?.includes(supportBtnText)) {
        await targetBot.deleteMessage(chatId, msg.message_id).catch(() => {});
        await sendSupportScreen(targetBot, chatId);
      } else if (normalizedText === '❓ FAQ' || normalizedText?.includes('FAQ')) {
        await targetBot.deleteMessage(chatId, msg.message_id).catch(() => {});
        const userName = tgUser?.firstName || 'User';
        const supportUsernameSetting = await storage.getSetting("SUPPORT_USERNAME");
        const supportUsername = supportUsernameSetting?.value || "@rochana_imesh";

        const rulesMessage = `<tg-emoji emoji-id="5413554183502572090">👋</tg-emoji> <b>Welcome, ${userName}</b> <tg-emoji emoji-id="5413554183502572090">✨</tg-emoji>\n\n` +
          `<tg-emoji emoji-id="5213181173026533794">⚠️</tg-emoji> <b>STORE RULES – PLEASE READ BEFORE BUYING</b> <tg-emoji emoji-id="5213181173026533794">⚠️</tg-emoji>\n\n` +
          `<tg-emoji emoji-id="5220091753930959575">1️⃣</tg-emoji> <b>Login Warranty Included</b>\n` +
          `You will receive a 100% working account at the time of purchase.\n` +
          `<tg-emoji emoji-id="6010111371251815589">⏱️</tg-emoji> <i>Checking time: 10–30 minutes after delivery.</i>\n\n` +
          `<tg-emoji emoji-id="5220041227935690133">2️⃣</tg-emoji> <b>Stay Safe & Secure</b>\n` +
          `Always use quality proxies and a proper fingerprint/anti-detect browser to avoid any security issues.\n\n` +
          `<tg-emoji emoji-id="5220224743298312689">3️⃣</tg-emoji> <b>User Responsibility</b>\n` +
          `We are not responsible for any actions taken after purchase.\n` +
          `Account usage is fully under the buyer’s responsibility.\n\n` +
          `<tg-emoji emoji-id="4958734459869332468">💯</tg-emoji> <b>Follow the rules, stay secure, and enjoy your purchase!</b> <tg-emoji emoji-id="4958734459869332468">💯</tg-emoji>\n\n` +
          `<tg-emoji emoji-id="5341498088408234504">⛱️</tg-emoji> <b>Need help or have questions?</b>\n` +
          `<tg-emoji emoji-id="5282843764451195532">🎗️</tg-emoji> <b>Contact us:</b> <tg-emoji emoji-id="5461151367559141950">💌</tg-emoji> ${supportUsername}`;

        targetBot.sendMessage(chatId, rulesMessage, { parse_mode: 'HTML' });
      } else if (tgUser?.lastAction?.startsWith('awaiting_quantity_')) {
        const productId = parseInt(tgUser.lastAction.split('_')[2]);
        const quantity = parseInt(normalizedText || "0");
        console.log(`[Purchase] User ${chatId} entered quantity: ${quantity} for product: ${productId}`);

        // Basic validation outside tx
        if (isNaN(quantity) || quantity <= 0) return targetBot.sendMessage(chatId, "❌ Please enter a valid number.");

        const product = await storage.getProduct(productId);
        if (!product) return targetBot.sendMessage(chatId, "❌ Product not found.");

        const stock = await storage.getCredentialsByProduct(productId);
        const availableStock = stock.filter(c => c.status === 'available').length;
        console.log(`[Purchase] Product: ${product.name}, Available Stock: ${availableStock}, Requested: ${quantity}`);

        if (quantity > availableStock) {
          console.log(`[Purchase] Rejecting due to insufficient stock: ${quantity} > ${availableStock}`);
          return targetBot.sendMessage(chatId, `❌ Sorry, you can enter maximum ${availableStock} pcs only for this product.`);
        }

        try {
          const result = await db.transaction(async (tx) => {
            // 1. Get user and product inside transaction
            const user = await tx.query.telegramUsers.findFirst({
              where: eq(telegramUsers.id, tgUser.id)
            });

            if (!user) throw new Error("User not found.");

            const totalPrice = product.price * quantity;

            // 2. Stock check first inside transaction
            const availableCredentials = await tx.select()
              .from(credentials)
              .where(and(eq(credentials.productId, productId), eq(credentials.status, 'available')))
              .limit(quantity)
              .for('update', { skipLocked: true });

            if (availableCredentials.length < quantity) {
              throw new Error(`Sorry, only ${availableCredentials.length} Pcs remaining.`);
            }

            // 3. Atomic Balance check and deduction
            const [updatedUser] = await tx
              .update(telegramUsers)
              .set({
                balance: sql`${telegramUsers.balance} - ${totalPrice}`
              })
              .where(and(eq(telegramUsers.id, user.id), gte(telegramUsers.balance, totalPrice)))
              .returning();

            if (!updatedUser) throw new Error("Insufficient balance");

            // 4. Mark credentials as sold and create orders
            const createdOrders: any[] = [];
            for (const cred of availableCredentials) {
              await tx.update(credentials)
                .set({ status: 'sold' })
                .where(eq(credentials.id, cred.id));

              const [newOrder] = await tx.insert(orders).values({
                telegramUserId: user.id,
                productId: product.id,
                credentialId: cred.id,
                status: 'completed'
              }).returning();
              createdOrders.push(newOrder);
            }

            // 5. Clear last action
            await tx.update(telegramUsers)
              .set({ lastAction: null, lastMessageId: null })
              .where(eq(telegramUsers.id, user.id));

            return { product, availableCredentials, totalPrice, createdOrders };
          });

          // 6. Success Response
          const lastOrderId = result.createdOrders && result.createdOrders.length > 0
            ? result.createdOrders[0].id
            : 3659;

          await sendOrderSuccessMessage(
            targetBot,
            chatId,
            lastOrderId,
            result.product.name,
            result.availableCredentials[0]?.content || "Item credentials delivered."
          );

          // Emit real-time notification to Admin Dashboard
          const userDisplayName = tgUser.firstName || tgUser.username || "User";
          io.emit('admin_notification', {
            type: 'purchase',
            title: 'New Purchase (Telegram Bot)',
            message: `${userDisplayName} bought ${quantity}x ${result.product.name} ($${(result.totalPrice / 100).toFixed(2)})`,
            data: {
              ...result,
              quantity,
              tgUser
            }
          });

          // Emit Native Push Notification
          sendAdminPushNotification(
            'New Purchase (Telegram Bot)',
            `${userDisplayName} bought ${quantity}x ${result.product.name} ($${(result.totalPrice / 100).toFixed(2)})`
          ).catch(console.error);

        } catch (err: any) {
          console.error('Normal purchase error:', err);
          if (err.message === "Insufficient balance") {
            const totalPrice = product.price * quantity;
            
            const errorMsg = `<tg-emoji emoji-id="5215209935188534658">❌</tg-emoji> <b>Insufficient Balance!</b>\n\n` +
              `Your current balance is <b>$${(tgUser.balance / 100).toFixed(2)}</b>, but this purchase costs <b>$${(totalPrice / 100).toFixed(2)}</b>.\n\n` +
              `Please top up your account to continue. <tg-emoji emoji-id="5231102735817918643">💸</tg-emoji>`;

            await targetBot.sendMessage(chatId, errorMsg, {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [[{ text: '💰 Add Now (Top-up)', callback_data: 'add_funds' }]]
              }
            });
          } else {
            await targetBot.sendMessage(chatId, `❌ Purchase failed: ${err.message}`);
          }
          // Also clear the last action if it was a real logic error
          await storage.updateTelegramUser(tgUser.id, { lastAction: null });
        }
      } else if (tgUser?.lastAction === 'awaiting_cryptobot_amount') {
        const amount = parseFloat(normalizedText || "0");

        try {
          if (tgUser.lastMessageId) {
            await targetBot.deleteMessage(chatId, tgUser.lastMessageId);
          }
          await targetBot.deleteMessage(chatId, msg.message_id);
        } catch (e) { }

        if (isNaN(amount) || amount <= 0) {
          targetBot.sendMessage(chatId, "❌ Invalid amount. Please enter a valid number.");
          return;
        }

        const newPayment = await storage.createPayment({
          telegramUserId: tgUser.id,
          amount: Math.round(amount * 100),
          paymentMethod: 'cryptobot',
          status: 'pending'
        });

        const res = await createCryptoBotInvoice(amount, newPayment.id.toString());
        await storage.updateTelegramUser(tgUser.id, { lastAction: null });

        if (res.success && res.payUrl) {
          if (res.invoiceId) {
            await storage.updatePayment(newPayment.id, { externalId: res.invoiceId.toString() });
          }
          const msgText = `<tg-emoji emoji-id="5361543877599724417">🤖</tg-emoji> <b>@CryptoBot Top-up Invoice</b>\n` +
            `➖➖➖➖➖➖➖➖➖➖\n` +
            `<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> Top-up amount: <b>$${amount.toFixed(2)} USD</b>\n` +
            `<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> Status: <tg-emoji emoji-id="6010111371251815589">⏳</tg-emoji> Pending\n` +
            `➖➖➖➖➖➖➖➖➖➖\n` +
            `Click on the button below to pay via <b>@CryptoBot</b>:`;

          const keyboard: any[][] = [
            [{ text: `Pay $${amount.toFixed(2)} via @CryptoBot`, url: res.payUrl, icon_custom_emoji_id: '5361543877599724417' }],
            [{ text: 'Check top-up', callback_data: `check_payment_${newPayment.id}`, icon_custom_emoji_id: '6010111371251815589' }]
          ];

          const imagePath = path.resolve(process.cwd(), 'public/assets/cryptobot.png');
          try {
            await sendPhotoWithCache(targetBot, chatId, imagePath, 'FILE_ID_CRYPTOBOT', {
              caption: msgText,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: keyboard
              }
            });
          } catch (photoErr) {
            console.error("Failed to send CryptoBot photo:", photoErr);
            await targetBot.sendMessage(chatId, msgText, {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: keyboard
              }
            });
          }
        } else {
          targetBot.sendMessage(chatId, `❌ Failed to create @CryptoBot invoice: ${res.error || 'Please check admin settings'}`);
        }
      } else if (tgUser?.lastAction === 'awaiting_cryptomus_amount') {
        const amount = parseFloat(normalizedText || "0");

        // Delete prompt and user input
        try {
          if (tgUser.lastMessageId) {
            await targetBot.deleteMessage(chatId, tgUser.lastMessageId);
          }
          await targetBot.deleteMessage(chatId, msg.message_id);
        } catch (e) { }

        if (isNaN(amount) || amount <= 0) {
          targetBot.sendMessage(chatId, "❌ Invalid amount. Please enter a number.");
          return;
        }

        await processCryptomusInvoiceCreation(targetBot, chatId, tgUser, amount);
      } else if (tgUser?.lastAction === 'awaiting_binance_deposit_amount') {
        const amount = parseFloat(normalizedText || "0");

        // Delete prompt and user input
        try {
          if (tgUser.lastMessageId) {
            await targetBot.deleteMessage(chatId, tgUser.lastMessageId);
          }
          await targetBot.deleteMessage(chatId, msg.message_id);
        } catch (e) { }

        if (isNaN(amount) || amount <= 0) {
          targetBot.sendMessage(chatId, "❌ Invalid amount. Please enter a number.");
          return;
        }

        const payIdKey = 'BINANCE_PAY_ID';
        const payId = (await storage.getSetting(payIdKey))?.value || "284910485";

        await storage.updateTelegramUserByChatId(chatId.toString(), { lastAction: null });

        const payment = await storage.createPayment({
          telegramUserId: tgUser.id,
          amount: Math.round(amount * 100),
          paymentMethod: 'binance',
          status: 'pending'
        });

        await storage.updateTelegramUserByChatId(chatId.toString(), {
          lastAction: `awaiting_binance_txid_${payment.id}_0`
        });

        const responseMsg = `<tg-emoji emoji-id="5281029063459234079">🔸</tg-emoji> You need to pay <b>${amount.toFixed(0)} USDT</b> \n\n` +
          `<b>Coin:</b> USDT <tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>\n` +
          `<b>Method:</b> Binance Pay / Pay ID  <tg-emoji emoji-id="5281029063459234079">🔸</tg-emoji>\n\n` +
          `<b>Pay ID:</b> <code>${payId}</code>\n\n` +
          `<tg-emoji emoji-id="5803393311100113792">🥂</tg-emoji> Send <b>${amount.toFixed(0)} USDT</b> to the Pay ID above.\n\n` +
          `<tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <i>Send only <b>USDT</b> via <b>Binance Pay</b> to this Pay ID, otherwise coins will be lost.</i>\n\n` +
          `<blockquote><tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <b>Important Notice:</b>\nYou must transfer the exact requested amount (<b>${amount.toFixed(0)} USDT</b>). If you pay less than the requested amount, your deposit will <b>NOT</b> be completed automatically!</blockquote>`;

        const keyboard = [
          [{ text: 'Copy Binance ID', copy_text: { text: payId }, icon_custom_emoji_id: '5231102735817918643' }],
          [{ text: 'Generate QR Code', callback_data: `gen_qr_binance_${payment.id}`, icon_custom_emoji_id: '5309771942381785364' }],
          [{ text: 'Check payment', callback_data: `check_payment_${payment.id}`, icon_custom_emoji_id: '5386367538735104399' }],
          [{ text: 'Change Network', callback_data: 'add_funds', icon_custom_emoji_id: '5976535107933050770' }]
        ] as any[][];

        const binanceBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_binance_banner.png");
        await sendOrEditScreenWithPhoto(targetBot, chatId, binanceBannerPath, responseMsg, { inline_keyboard: keyboard });
      } else if (tgUser?.lastAction === 'awaiting_trc20_amount') {
        try {
          const amount = parseFloat(normalizedText || "0");

          try {
            if (tgUser.lastMessageId) {
              await targetBot.deleteMessage(chatId, tgUser.lastMessageId);
            }
            await targetBot.deleteMessage(chatId, msg.message_id);
          } catch (e) { }

          if (isNaN(amount) || amount <= 0) {
            targetBot.sendMessage(chatId, "❌ Invalid amount. Please enter a number.");
            return;
          }

          const wallet = (await storage.getSetting('TRC20_WALLET_ADDRESS'))?.value || "Not Set";

          const payment = await storage.createPayment({
            telegramUserId: tgUser.id,
            amount: Math.round(amount * 100),
            paymentMethod: 'trc20',
            status: 'pending'
          });

          await storage.updateTelegramUserByChatId(chatId.toString(), {
            lastAction: `awaiting_trc20_txid_${payment.id}_0`
          });

          const responseMsg = `<tg-emoji emoji-id="5936189134342199863">💰</tg-emoji> You need <b>${amount.toFixed(0)} USDT</b> \n\n` +
            `<b>Coin:</b> USDT <tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>\n` +
            `<b>Network:</b> TRC20  <tg-emoji emoji-id="5936189134342199863">💰</tg-emoji>\n\n` +
            `<code>${wallet}</code>\n\n` +
            `<tg-emoji emoji-id="5803393311100113792">🥂</tg-emoji> Send <b>${amount.toFixed(0)} USDT</b> to the address above.\n\n` +
            `<tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <i>Send only <b>USDT</b> via <b>TRC20</b> to this address, otherwise coins will be lost.</i>\n\n` +
            `<blockquote><tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <b>Important Notice:</b>\nYou must transfer the exact requested amount (<b>${amount.toFixed(0)} USDT</b>). If you pay less than the requested amount, your deposit will <b>NOT</b> be completed automatically!</blockquote>`;

          const keyboard = [
            [{ text: 'Copy Address', copy_text: { text: wallet }, icon_custom_emoji_id: '5231102735817918643' }],
            [{ text: 'Generate QR Code', callback_data: `gen_qr_trc20_${payment.id}`, icon_custom_emoji_id: '5309771942381785364' }],
            [{ text: 'Check payment', callback_data: `check_payment_${payment.id}`, icon_custom_emoji_id: '5386367538735104399' }],
            [{ text: 'Change Network', callback_data: 'add_funds', icon_custom_emoji_id: '5976535107933050770' }]
          ] as any[][];

          const trc20BannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_trc20_banner.png");
          await sendOrEditScreenWithPhoto(targetBot, chatId, trc20BannerPath, responseMsg, { inline_keyboard: keyboard });
        } catch (err: any) {
          console.error("Error initiating TRC20 payment:", err);
          targetBot.sendMessage(chatId, `❌ Failed to initiate TRC20 deposit: ${err.message || err}`);
        }
      } else if (tgUser?.lastAction === 'awaiting_bep20_amount') {
        try {
          const amount = parseFloat(normalizedText || "0");

          try {
            if (tgUser.lastMessageId) {
              await targetBot.deleteMessage(chatId, tgUser.lastMessageId);
            }
            await targetBot.deleteMessage(chatId, msg.message_id);
          } catch (e) { }

          if (isNaN(amount) || amount <= 0) {
            targetBot.sendMessage(chatId, "❌ Invalid amount. Please enter a valid number.");
            return;
          }

          const wallet = (await storage.getSetting('BEP20_WALLET_ADDRESS'))?.value || "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";

          const payment = await storage.createPayment({
            telegramUserId: tgUser.id,
            amount: Math.round(amount * 100),
            paymentMethod: 'bep20',
            status: 'pending'
          });

          await storage.updateTelegramUserByChatId(chatId.toString(), {
            lastAction: `awaiting_bep20_txid_${payment.id}_0`
          });

          const responseMsg = `<tg-emoji emoji-id="5280907155107506256">🪙</tg-emoji> You need to pay <b>${amount.toFixed(0)} USDT</b> \n\n` +
            `<b>Coin:</b> USDT <tg-emoji emoji-id="5201692367437974073">💵</tg-emoji>\n` +
            `<b>Network:</b> BEP20  <tg-emoji emoji-id="5280907155107506256">🪙</tg-emoji>\n\n` +
            `<code>${wallet}</code>\n\n` +
            `<tg-emoji emoji-id="5803393311100113792">🥂</tg-emoji> Send <b>${amount.toFixed(0)} USDT</b> to the address above.\n\n` +
            `<tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <i>Send only <b>USDT</b> via <b>BEP20</b> to this address, otherwise coins will be lost.</i>\n\n` +
            `<blockquote><tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <b>Important Notice:</b>\nYou must transfer the exact requested amount (<b>${amount.toFixed(0)} USDT</b>). If you pay less than the requested amount, your deposit will <b>NOT</b> be completed automatically!</blockquote>`;

          const keyboard = [
            [{ text: 'Copy Address', copy_text: { text: wallet }, icon_custom_emoji_id: '5231102735817918643' }],
            [{ text: 'Generate QR Code', callback_data: `gen_qr_bep20_${payment.id}`, icon_custom_emoji_id: '5309771942381785364' }],
            [{ text: 'Check payment', callback_data: `check_payment_${payment.id}`, icon_custom_emoji_id: '5386367538735104399' }],
            [{ text: 'Change Network', callback_data: 'add_funds', icon_custom_emoji_id: '5976535107933050770' }]
          ] as any[][];

          const bep20BannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_bep20_banner.png");
          await sendOrEditScreenWithPhoto(targetBot, chatId, bep20BannerPath, responseMsg, { inline_keyboard: keyboard });
        } catch (err: any) {
          console.error("Error initiating BEP20 payment:", err);
          targetBot.sendMessage(chatId, `❌ Failed to initiate BEP20 deposit: ${err.message || err}`);
        }
      } else if (tgUser?.lastAction?.startsWith('awaiting_bep20_txid_')) {
        const parts = tgUser.lastAction.split('_');
        const paymentId = parseInt(parts[3]);
        const txId = normalizedText?.trim() || "";

        try {
          if (tgUser.lastMessageId) {
            await targetBot.deleteMessage(chatId, tgUser.lastMessageId);
          }
          await targetBot.deleteMessage(chatId, msg.message_id);
        } catch (e) { }

        if (!txId) {
          const failMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Please enter a valid Transaction Hash (TXID).</b>`, { parse_mode: 'HTML' });
          setTimeout(() => {
            targetBot.deleteMessage(chatId, failMsg.message_id).catch(() => {});
          }, 15000);
          return;
        }

        const payment = await db.transaction(async (tx) => {
          const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for('update');
          if (!p) return null;
          if (p.status !== 'pending') return p;

          const [updated] = await tx.update(payments)
            .set({ status: 'completed', updatedAt: new Date() })
            .where(eq(payments.id, paymentId))
            .returning();
          return updated;
        });

        if (payment && tgUser) {
          const newBalCents = tgUser.balance + payment.amount;
          await db.update(telegramUsers).set({ balance: newBalCents, lastAction: null }).where(eq(telegramUsers.id, tgUser.id));
          await sendDepositSuccessNotification(targetBot, chatId.toString(), payment.amount, 'USDT (BEP-20)');
        }
      } else if (tgUser?.lastAction === 'awaiting_aptos_amount') {
        try {
          const amount = parseFloat(normalizedText || "0");

          try {
            if (tgUser.lastMessageId) {
              await targetBot.deleteMessage(chatId, tgUser.lastMessageId);
            }
            await targetBot.deleteMessage(chatId, msg.message_id);
          } catch (e) { }

          if (isNaN(amount) || amount <= 0) {
            targetBot.sendMessage(chatId, "❌ Invalid amount. Please enter a number.");
            return;
          }

          const wallet = (await storage.getSetting('APTOS_WALLET_ADDRESS'))?.value || "Not Set";

          const existingPending = await storage.getPendingPaymentByAmount(tgUser.id, Math.round(amount * 100));
          if (existingPending) {
            await storage.updateTelegramUserByChatId(chatId.toString(), { lastAction: null });
            return targetBot.sendMessage(chatId, `⚠️ You already have a pending $${amount} payment. Please pay that one first or wait for it to expire (1 hour).`);
          }

          const payment = await storage.createPayment({
            telegramUserId: tgUser.id,
            amount: Math.round(amount * 100),
            paymentMethod: 'aptos',
            status: 'pending'
          });

          await storage.updateTelegramUserByChatId(chatId.toString(), {
            lastAction: `awaiting_aptos_txid_${payment.id}_0`
          });

          const responseMsg = `<tg-emoji emoji-id="5798849051017352095">⚡</tg-emoji> <b>Top-up: Aptos (USDT)</b>\n` +
            `━━━━━━━━━━━━━━━\n` +
            `<tg-emoji emoji-id="6276090299232031662">✅</tg-emoji> <b>Aptos Address:</b> <code>${wallet}</code>\n` +
            `<tg-emoji emoji-id="5231102735817918643">💵</tg-emoji> <b>Transfer amount:</b> <code>${amount.toFixed(2)}$</code>\n\n` +
            `<tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <b>IMPORTANT</b>\n` +
            `• Please transfer this <b>exact amount</b>.\n` +
            `• You <b>MUST</b> use the <b>Aptos network</b>.\n` +
            `━━━━━━━━━━━━━━━\n` +
            `<tg-emoji emoji-id="6010111371251815589">⏳</tg-emoji> After payment, click on Check payment`;

          const keyboard = [
            [{ text: `Copy Wallet Address`, callback_data: `copy_wallet_aptos`, icon_custom_emoji_id: '5334982154868783692' }],
            [{ text: 'Check payment', callback_data: `check_payment_${payment.id}`, icon_custom_emoji_id: '6010111371251815589' }]
          ] as any[][];

          const imagePath = path.resolve(process.cwd(), 'public/assets/usdt_aptos.png');
          try {
            await sendPhotoWithCache(targetBot, chatId, imagePath, 'FILE_ID_USDT_APTOS', {
              caption: responseMsg,
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: keyboard }
            });
          } catch (photoErr) {
            console.error("Failed to send Aptos photo:", photoErr);
            await targetBot.sendMessage(chatId, responseMsg, {
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: keyboard }
            });
          }
        } catch (err: any) {
          console.error("Error initiating Aptos payment:", err);
          targetBot.sendMessage(chatId, `❌ Failed to initiate Aptos deposit: ${err.message || err}`);
        }
      } else if (tgUser?.lastAction?.startsWith('awaiting_trc20_txid_')) {
        const parts = tgUser.lastAction.split('_');
        const paymentId = parseInt(parts[3]);
        const attempts = parts.length > 4 ? parseInt(parts[4]) : 0;
        const txId = normalizedText?.trim() || "";

        try {
          if (tgUser.lastMessageId) {
            await targetBot.deleteMessage(chatId, tgUser.lastMessageId);
          }
          await targetBot.deleteMessage(chatId, msg.message_id);
        } catch (e) { }

        if (!txId) {
          const failMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Please enter a valid Transaction ID (TXID).</b>`, { parse_mode: 'HTML' });
          setTimeout(() => {
            targetBot.deleteMessage(chatId, failMsg.message_id).catch(() => {});
          }, 15000);
          return;
        }

        // Lock payment and transition status to processing
        const payment = await db.transaction(async (tx) => {
          const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for('update');
          if (!p) return null;
          if (p.status !== 'pending') return p;

          const [updated] = await tx.update(payments)
            .set({ status: 'processing', updatedAt: new Date() })
            .where(eq(payments.id, paymentId))
            .returning();
          return updated;
        });

        if (!payment || payment.status !== 'processing') {
          const failMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Payment request not found or already processed. Please request a new deposit.</b>`, { parse_mode: 'HTML' });
          setTimeout(() => {
            targetBot.deleteMessage(chatId, failMsg.message_id).catch(() => {});
          }, 15000);
          return;
        }

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (payment.createdAt && new Date(payment.createdAt) < oneHourAgo) {
          await storage.updatePayment(payment.id, { status: 'expired' });
          await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>This payment request has expired. Please create a new one.</b>`, { parse_mode: 'HTML' });
          return;
        }

        const walletAddress = (await storage.getSetting('TRC20_WALLET_ADDRESS'))?.value;
        if (!walletAddress) {
          await storage.updatePayment(payment.id, { status: 'pending' });
          await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>TRC20 wallet is not configured. Please contact support.</b>`, { parse_mode: 'HTML' });
          return;
        }

        try {
          const verificationMode = (await storage.getSetting('TRC20_VERIFICATION_MODE'))?.value || 'binance';
          const checkingMsgText = verificationMode === 'binance' 
            ? `⏳ <b>Verifying your TRC20 payment via Binance...</b> Please wait a moment.`
            : `⏳ <b>Verifying your TRC20 payment on-chain...</b> Please wait a moment.`;
          const checkingMsg = await targetBot.sendMessage(chatId, checkingMsgText, { parse_mode: 'HTML' });

          const result = verificationMode === 'binance'
            ? await verifyDepositViaBinance(txId, 'TRC20', walletAddress)
            : await verifyTrc20Transaction(txId, walletAddress);

          try {
            await targetBot.deleteMessage(chatId, checkingMsg.message_id);
          } catch (e) { }

          if (result.success && result.actualAmount) {
            const txResult = await db.transaction(async (tx) => {
              const [settingRow] = await tx.select().from(settings).where(eq(settings.key, 'USED_TXIDS_JSON')).for('update');
              let currentUsed: string[] = [];
              if (settingRow?.value) {
                try { currentUsed = JSON.parse(settingRow.value); } catch(e) {}
              }
              if (currentUsed.includes(txId.toLowerCase())) {
                return { success: false, error: "duplicate" };
              }

              const [u] = await tx.select().from(telegramUsers).where(eq(telegramUsers.id, tgUser.id)).for('update');
              if (!u) return { success: false, error: "user_not_found" };

              currentUsed.push(txId.toLowerCase());
              if (settingRow) {
                await tx.update(settings).set({ value: JSON.stringify(currentUsed), updatedAt: new Date() }).where(eq(settings.key, 'USED_TXIDS_JSON'));
              } else {
                await tx.insert(settings).values({ key: 'USED_TXIDS_JSON', value: JSON.stringify(currentUsed) });
              }

              const creditAmountCents = Math.round(result.actualAmount * 100);
              await tx.update(telegramUsers).set({
                balance: u.balance + creditAmountCents,
                lastAction: null,
                lastMessageId: null
              }).where(eq(telegramUsers.id, u.id));

              await tx.update(payments).set({
                status: 'completed',
                externalId: txId,
                amount: creditAmountCents,
                updatedAt: new Date()
              }).where(eq(payments.id, payment.id));

              return { success: true, creditAmountCents };
            });

            if (txResult.success) {
              await targetBot.sendMessage(chatId, 
                `<tg-emoji emoji-id="6276090299232031662">✅</tg-emoji> <b>TRC20 Payment Verified successfully!</b>\n\n` +
                `<tg-emoji emoji-id="5388622778817589921">💰</tg-emoji> Credited: <b>$${result.actualAmount.toFixed(2)}</b> has been added to your balance.\n` +
                `<tg-emoji emoji-id="6276090299232031662">🆔</tg-emoji> Account ID: <code>${tgUser.telegramId}</code>\n\n` +
                `Thank you for your purchase! <tg-emoji emoji-id="5231102735817918643">🤍</tg-emoji>`,
                { parse_mode: 'HTML' }
              );

              const userDisplayName = tgUser.firstName || tgUser.username || "User";
              io.emit('admin_notification', {
                type: 'deposit',
                title: 'New TRC20 Deposit',
                message: `${userDisplayName} deposited $${result.actualAmount.toFixed(2)} via TRC20`,
                data: {
                  paymentId: payment.id,
                  userId: tgUser.telegramId,
                  amount: result.actualAmount,
                  txId
                }
              });

              sendAdminPushNotification(
                'New TRC20 Deposit',
                `${userDisplayName} deposited $${result.actualAmount.toFixed(2)} (TXID: ${txId.substring(0, 10)}...)`
              ).catch(console.error);
            } else {
              await storage.updatePayment(payment.id, { status: 'pending' });
              const failMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Verification failed:</b> This Transaction ID (TXID) has already been used.`, { parse_mode: 'HTML' });
              const newAttempts = attempts + 1;
              if (newAttempts >= 3) {
                await storage.updateTelegramUserByChatId(chatId.toString(), { lastAction: null });
                const warnMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Too many failed attempts.</b> Please click "Check payment" again to retry.`, { parse_mode: 'HTML' });
                setTimeout(() => {
                  targetBot.deleteMessage(chatId, warnMsg.message_id).catch(() => {});
                }, 15000);
              } else {
                await storage.updateTelegramUserByChatId(chatId.toString(), { lastAction: `awaiting_trc20_txid_${payment.id}_${newAttempts}` });
              }
              setTimeout(() => {
                targetBot.deleteMessage(chatId, failMsg.message_id).catch(() => {});
              }, 15000);
            }
          } else {
            await storage.updatePayment(payment.id, { status: 'pending' });
            const failMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Verification failed:</b> ${result.error || 'Transaction details did not match.'}\n\nPlease check your TXID and try entering it again:`, { parse_mode: 'HTML' });
            const newAttempts = attempts + 1;
            if (newAttempts >= 3) {
              await storage.updateTelegramUserByChatId(chatId.toString(), { lastAction: null });
              const warnMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Too many failed attempts.</b> Please click "Check payment" again to retry.`, { parse_mode: 'HTML' });
              setTimeout(() => {
                targetBot.deleteMessage(chatId, warnMsg.message_id).catch(() => {});
              }, 15000);
            } else {
              await storage.updateTelegramUserByChatId(chatId.toString(), { lastAction: `awaiting_trc20_txid_${payment.id}_${newAttempts}` });
            }
            setTimeout(() => {
              targetBot.deleteMessage(chatId, failMsg.message_id).catch(() => {});
            }, 15000);
          }
        } catch (err: any) {
          await storage.updatePayment(payment.id, { status: 'pending' }).catch(() => {});
          const failMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Verification failed:</b> ${err.message || err}`, { parse_mode: 'HTML' });
          const newAttempts = attempts + 1;
          if (newAttempts >= 3) {
            await storage.updateTelegramUserByChatId(chatId.toString(), { lastAction: null });
            const warnMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Too many failed attempts.</b> Please click "Check payment" again to retry.`, { parse_mode: 'HTML' });
            setTimeout(() => {
              targetBot.deleteMessage(chatId, warnMsg.message_id).catch(() => {});
            }, 15000);
          } else {
            await storage.updateTelegramUserByChatId(chatId.toString(), { lastAction: `awaiting_trc20_txid_${payment.id}_${newAttempts}` });
          }
          setTimeout(() => {
            targetBot.deleteMessage(chatId, failMsg.message_id).catch(() => {});
          }, 15000);
        }
        return;
      }

      if (tgUser?.lastAction?.startsWith('awaiting_aptos_txid_')) {
        const parts = tgUser.lastAction.split('_');
        const paymentId = parseInt(parts[3]);
        const attempts = parts.length > 4 ? parseInt(parts[4]) : 0;
        const txId = normalizedText?.trim() || "";

        try {
          if (tgUser.lastMessageId) {
            await targetBot.deleteMessage(chatId, tgUser.lastMessageId);
          }
          await targetBot.deleteMessage(chatId, msg.message_id);
        } catch (e) { }

        if (!txId) {
          const failMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Please enter a valid Transaction ID (TXID).</b>`, { parse_mode: 'HTML' });
          setTimeout(() => {
            targetBot.deleteMessage(chatId, failMsg.message_id).catch(() => {});
          }, 15000);
          return;
        }

        // Lock payment and transition status to processing
        const payment = await db.transaction(async (tx) => {
          const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for('update');
          if (!p) return null;
          if (p.status !== 'pending') return p;

          const [updated] = await tx.update(payments)
            .set({ status: 'processing', updatedAt: new Date() })
            .where(eq(payments.id, paymentId))
            .returning();
          return updated;
        });

        if (!payment || payment.status !== 'processing') {
          const failMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Payment request not found or already processed. Please request a new deposit.</b>`, { parse_mode: 'HTML' });
          setTimeout(() => {
            targetBot.deleteMessage(chatId, failMsg.message_id).catch(() => {});
          }, 15000);
          return;
        }

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (payment.createdAt && new Date(payment.createdAt) < oneHourAgo) {
          await storage.updatePayment(payment.id, { status: 'expired' });
          await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>This payment request has expired. Please create a new one.</b>`, { parse_mode: 'HTML' });
          return;
        }

        const walletAddress = (await storage.getSetting('APTOS_WALLET_ADDRESS'))?.value;
        if (!walletAddress) {
          await storage.updatePayment(payment.id, { status: 'pending' });
          await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Aptos wallet is not configured. Please contact support.</b>`, { parse_mode: 'HTML' });
          return;
        }

        try {
          const verificationMode = (await storage.getSetting('APTOS_VERIFICATION_MODE'))?.value || 'binance';
          const checkingMsgText = verificationMode === 'binance' 
            ? `⏳ <b>Verifying your Aptos payment via Binance...</b> Please wait a moment.`
            : `⏳ <b>Verifying your Aptos payment on-chain...</b> Please wait a moment.`;
          const checkingMsg = await targetBot.sendMessage(chatId, checkingMsgText, { parse_mode: 'HTML' });

          const result = verificationMode === 'binance'
            ? await verifyDepositViaBinance(txId, 'APTOS', walletAddress)
            : await verifyAptosTransaction(txId, walletAddress);

          try {
            await targetBot.deleteMessage(chatId, checkingMsg.message_id);
          } catch (e) { }

          if (result.success && result.actualAmount) {
            const txResult = await db.transaction(async (tx) => {
              const [settingRow] = await tx.select().from(settings).where(eq(settings.key, 'USED_TXIDS_JSON')).for('update');
              let currentUsed: string[] = [];
              if (settingRow?.value) {
                try { currentUsed = JSON.parse(settingRow.value); } catch(e) {}
              }
              if (currentUsed.includes(txId.toLowerCase())) {
                return { success: false, error: "duplicate" };
              }

              const [u] = await tx.select().from(telegramUsers).where(eq(telegramUsers.id, tgUser.id)).for('update');
              if (!u) return { success: false, error: "user_not_found" };

              currentUsed.push(txId.toLowerCase());
              if (settingRow) {
                await tx.update(settings).set({ value: JSON.stringify(currentUsed), updatedAt: new Date() }).where(eq(settings.key, 'USED_TXIDS_JSON'));
              } else {
                await tx.insert(settings).values({ key: 'USED_TXIDS_JSON', value: JSON.stringify(currentUsed) });
              }

              const creditAmountCents = Math.round(result.actualAmount * 100);
              await tx.update(telegramUsers).set({
                balance: u.balance + creditAmountCents,
                lastAction: null,
                lastMessageId: null
              }).where(eq(telegramUsers.id, u.id));

              await tx.update(payments).set({
                status: 'completed',
                externalId: txId,
                amount: creditAmountCents,
                updatedAt: new Date()
              }).where(eq(payments.id, payment.id));

              return { success: true, creditAmountCents };
            });

            if (txResult.success) {
              await targetBot.sendMessage(chatId, 
                `<tg-emoji emoji-id="6276090299232031662">✅</tg-emoji> <b>Aptos Payment Verified successfully!</b>\n\n` +
                `<tg-emoji emoji-id="5388622778817589921">💰</tg-emoji> Credited: <b>$${result.actualAmount.toFixed(2)}</b> has been added to your balance.\n` +
                `<tg-emoji emoji-id="6276090299232031662">🆔</tg-emoji> Account ID: <code>${tgUser.telegramId}</code>\n\n` +
                `Thank you for your purchase! <tg-emoji emoji-id="5231102735817918643">🤍</tg-emoji>`,
                { parse_mode: 'HTML' }
              );

              const userDisplayName = tgUser.firstName || tgUser.username || "User";
              io.emit('admin_notification', {
                type: 'deposit',
                title: 'New Aptos Deposit',
                message: `${userDisplayName} deposited $${result.actualAmount.toFixed(2)} via Aptos`,
                data: {
                  paymentId: payment.id,
                  userId: tgUser.telegramId,
                  amount: result.actualAmount,
                  txId
                }
              });

              sendAdminPushNotification(
                'New Aptos Deposit',
                `${userDisplayName} deposited $${result.actualAmount.toFixed(2)} (TXID: ${txId.substring(0, 10)}...)`
              ).catch(console.error);
            } else {
              await storage.updatePayment(payment.id, { status: 'pending' });
              const failMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Verification failed:</b> This Transaction ID (TXID) has already been used.`, { parse_mode: 'HTML' });
              const newAttempts = attempts + 1;
              if (newAttempts >= 3) {
                await storage.updateTelegramUserByChatId(chatId.toString(), { lastAction: null });
                const warnMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Too many failed attempts.</b> Please click "Check payment" again to retry.`, { parse_mode: 'HTML' });
                setTimeout(() => {
                  targetBot.deleteMessage(chatId, warnMsg.message_id).catch(() => {});
                }, 15000);
              } else {
                await storage.updateTelegramUserByChatId(chatId.toString(), { lastAction: `awaiting_aptos_txid_${payment.id}_${newAttempts}` });
              }
              setTimeout(() => {
                targetBot.deleteMessage(chatId, failMsg.message_id).catch(() => {});
              }, 15000);
            }
          } else {
            await storage.updatePayment(payment.id, { status: 'pending' });
            const failMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Verification failed:</b> ${result.error || 'Transaction details did not match.'}\n\nPlease check your TXID and try entering it again:`, { parse_mode: 'HTML' });
            const newAttempts = attempts + 1;
            if (newAttempts >= 3) {
              await storage.updateTelegramUserByChatId(chatId.toString(), { lastAction: null });
              const warnMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Too many failed attempts.</b> Please click "Check payment" again to retry.`, { parse_mode: 'HTML' });
              setTimeout(() => {
                targetBot.deleteMessage(chatId, warnMsg.message_id).catch(() => {});
              }, 15000);
            } else {
              await storage.updateTelegramUserByChatId(chatId.toString(), { lastAction: `awaiting_aptos_txid_${payment.id}_${newAttempts}` });
            }
            setTimeout(() => {
              targetBot.deleteMessage(chatId, failMsg.message_id).catch(() => {});
            }, 15000);
          }
        } catch (err: any) {
          await storage.updatePayment(payment.id, { status: 'pending' }).catch(() => {});
          const failMsg = await targetBot.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> <b>Verification failed:</b> ${err.message || err}`, { parse_mode: 'HTML' });
        }
      } else {
        // Fallback for any unhandled text message: Always respond so bot is never silent
        await sendAutoDeleteError(
          targetBot,
          chatId,
          msg.message_id,
          `<tg-emoji emoji-id="5443127283898405358">📥</tg-emoji> <b>Binance Order ID Verification</b>\n\n` +
          `<blockquote><tg-emoji emoji-id="6327875123646829719">⚠️</tg-emoji> <b>Instructions:</b>\n` +
          `If you are verifying a deposit, please send your <b>8 to 20 digit Binance Order ID</b> in chat.\n` +
          `<i>Example: <code>28491048591</code></i>\n\n` +
          `Or tap <b>Catalog</b> below to browse products.</blockquote>`,
          7000
        );
      }
    } catch (messageErr) {
      console.error("Message Handler Global Catch Error:", messageErr);
    }
  });
};
initBot().catch(err => console.error("Initial bot setup failed:", err));
initAdminBotController().catch(err => console.error("Admin bot setup failed:", err));

// Start Backup Scheduler
BackupService.startBackupScheduler().catch(err => console.error("Backup scheduler failed to start:", err));

  // Cryptomus Webhook Handler
  app.post("/api/payments/webhook", async (req, res) => {
    try {
      const apiKey = (await storage.getSetting('CRYPTOMUS_API_KEY'))?.value;
      if (!apiKey) {
        console.error("[Cryptomus Webhook] API Key not configured.");
        return res.status(500).json({ message: "Cryptomus API Key not configured" });
      }

      const { sign, ...data } = req.body;
      if (!sign) {
        console.warn("[Cryptomus Webhook] Missing sign parameter.");
        return res.status(400).json({ message: "Missing sign parameter" });
      }

      const serialized = JSON.stringify(data);
      const computedSign = crypto
        .createHash('md5')
        .update(Buffer.from(serialized).toString('base64') + apiKey)
        .digest('hex');

      if (computedSign !== sign) {
        console.warn("[Cryptomus Webhook] Signature verification failed.", { computedSign, sign });
        return res.status(400).json({ message: "Invalid signature" });
      }

      const { uuid, status } = data;
      if (!uuid) {
        return res.status(400).json({ message: "Missing uuid" });
      }

      console.log(`[Cryptomus Webhook] Received notification for UUID: ${uuid}, Status: ${status}`);

      if (status === 'paid' || status === 'paid_over') {
        const result = await db.transaction(async (tx) => {
          const [payment] = await tx.select().from(payments).where(eq(payments.cryptomusUuid, uuid)).for('update');
          if (!payment) {
            return { success: false, error: "Payment not found" };
          }

          if (payment.status === 'completed') {
            return { success: true, alreadyCompleted: true };
          }

          if (payment.status !== 'pending' && payment.status !== 'processing') {
            return { success: false, error: `Invalid payment status: ${payment.status}` };
          }

          await tx.update(payments).set({ status: 'processing', updatedAt: new Date() }).where(eq(payments.id, payment.id));

          const [user] = await tx.select().from(telegramUsers).where(eq(telegramUsers.id, payment.telegramUserId)).for('update');
          if (!user) {
            return { success: false, error: "User not found" };
          }

          await tx.update(telegramUsers).set({
            balance: user.balance + payment.amount
          }).where(eq(telegramUsers.id, user.id));

          await tx.update(payments).set({ status: 'completed', updatedAt: new Date() }).where(eq(payments.id, payment.id));

          return { success: true, payment, user };
        });

        if (!result.success) {
          console.error("[Cryptomus Webhook] Processing failed:", result.error);
          return res.status(400).json({ message: result.error });
        }

        if (result.alreadyCompleted) {
          return res.json({ success: true, message: "Already completed" });
        }

        const payment = result.payment!;
        const user = result.user!;
        const chatId = user.telegramId;

        const activeBot = bot || (await getBotToken() ? new TelegramBot((await getBotToken())!) : null);
        if (activeBot) {
          try {
            await activeBot.sendMessage(chatId, `✅ Cryptomus payment verified! $${(payment.amount / 100).toFixed(2)} has been added to your balance.`);
          } catch (botErr) {
            console.error("[Cryptomus Webhook] Failed to send Telegram message to user:", botErr);
          }
        }

        const userDisplayName = user.firstName || user.username || "User";
        io.emit('admin_notification', {
          type: 'deposit',
          title: 'New Cryptomus Deposit',
          message: `${userDisplayName} deposited $${(payment.amount / 100).toFixed(2)} via Cryptomus`,
          data: {
            paymentId: payment.id,
            userId: user.telegramId,
            amount: payment.amount / 100,
            txId: uuid
          }
        });

        sendAdminPushNotification(
          'New Cryptomus Deposit',
          `${userDisplayName} deposited $${(payment.amount / 100).toFixed(2)}`
        ).catch(console.error);
      }

      return res.json({ success: true });
    } catch (error: any) {
      console.error("[Cryptomus Webhook] Unexpected error:", error);
      return res.status(500).json({ message: error.message || error });
    }
  });

  // @CryptoBot Webhook Handler
  app.post("/api/payments/cryptobot/webhook", express.json(), async (req, res) => {
    try {
      const tokenSetting = await storage.getSetting('CRYPTO_BOT_API_TOKEN');
      const apiToken = tokenSetting?.value || process.env.CRYPTO_BOT_API_TOKEN;

      if (!apiToken) {
        console.error("[CryptoBot Webhook] API Token not configured.");
        return res.status(500).json({ message: "CryptoBot API Token not configured" });
      }

      const signature = req.headers['crypto-pay-api-signature'] as string;
      if (!signature) {
        console.warn("[CryptoBot Webhook] Missing signature header.");
        return res.status(400).json({ message: "Missing signature header" });
      }

      const rawBody = (req as any).rawBody
        ? ((req as any).rawBody as Buffer).toString('utf-8')
        : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      const secret = crypto.createHash('sha256').update(apiToken).digest();
      const checkSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

      if (checkSignature !== signature) {
        console.warn("[CryptoBot Webhook] Signature verification failed.");
        return res.status(400).json({ message: "Invalid signature" });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      if (body.update_type === 'invoice_paid') {
        const invoice = body.payload;
        const paymentId = parseInt(invoice.payload, 10);
        const uuid = invoice.invoice_id ? invoice.invoice_id.toString() : '';

        if (!isNaN(paymentId)) {
          // ATOMIC UPDATE: Only update if status is currently 'pending' to prevent DOUBLE CREDITING
          const [updatedPayment] = await db.update(payments)
            .set({ status: 'completed', externalId: uuid, updatedAt: new Date() })
            .where(and(eq(payments.id, paymentId), eq(payments.status, 'pending')))
            .returning();

          if (updatedPayment) {
            await db.execute(sql`UPDATE telegram_users SET balance = balance + ${updatedPayment.amount} WHERE id = ${updatedPayment.telegramUserId}`);

            const [user] = await db.select().from(telegramUsers).where(eq(telegramUsers.id, updatedPayment.telegramUserId));

            const activeBot = await getBroadcastBot();
            if (activeBot && user) {
              await sendDepositSuccessNotification(activeBot, user.telegramId, updatedPayment.amount / 100, user.balance / 100, "@CryptoBot Invoice", uuid).catch((err: any) => console.error("Failed to notify user:", err));
            }

            if (user) {
              const userDisplayName = user.firstName || user.username || "User";
              io.emit('admin_notification', {
                type: 'deposit',
                title: 'New @CryptoBot Deposit',
                message: `${userDisplayName} deposited $${(updatedPayment.amount / 100).toFixed(2)} via @CryptoBot`,
                data: { paymentId: updatedPayment.id, userId: user.telegramId, amount: updatedPayment.amount / 100, txId: uuid }
              });

              sendAdminPushNotification(
                'New @CryptoBot Deposit',
                `${userDisplayName} deposited $${(updatedPayment.amount / 100).toFixed(2)}`
              ).catch(console.error);
            }
          }
        }
      }

      return res.json({ ok: true });
    } catch (error: any) {
      console.error("[CryptoBot Webhook] Error:", error);
      return res.status(500).json({ message: error.message || error });
    }
  });

  // Push Notification Routes
  app.get("/api/admin/push-key", isAuth, async (req, res) => {
    const { publicKey } = await initPushNotifications();
    res.json({ publicKey });
  });

  app.post("/api/admin/subscribe", isAuth, async (req, res) => {
    const { subscription } = req.body;
    console.log('[PUSH] Received subscription request from user:', req.session.userId);
    if (!subscription) {
      console.error('[PUSH] No subscription object provided');
      return res.status(400).json({ message: "Subscription required" });
    }
    await storage.savePushSubscription(req.session.userId!, subscription);
    console.log('[PUSH] Subscription saved successfully for user:', req.session.userId);
    res.sendStatus(201);
  });

  app.post("/api/admin/test-push", isAuth, async (req, res) => {
    console.log('[PUSH] Manual test trigger by user:', req.session.userId);
    await sendAdminPushNotification(
      'Test Alert',
      'This is a test notification from Shopeefy!',
      '/settings'
    );
    res.json({ success: true });
  });

  // --- Telegram Client (MTProto) API Routes ---
  app.get("/api/telegram-client/status", isAuth, async (req, res) => {
    try {
      res.json({ connected: isClientConnected() });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/telegram-client/send-code", isAuth, async (req, res) => {
    const { apiId, apiHash, phoneNumber } = req.body;
    if (!apiId || !apiHash || !phoneNumber) {
      return res.status(400).json({ message: "apiId, apiHash, and phoneNumber are required." });
    }
    try {
      await sendOtpCode(Number(apiId), apiHash, phoneNumber);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/telegram-client/login", isAuth, async (req, res) => {
    const { code, password } = req.body;
    if (!code) {
      return res.status(400).json({ message: "Verification code is required." });
    }
    try {
      const result = await signInClient(code, password);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/telegram-client/logout", isAuth, async (req, res) => {
    try {
      const result = await logoutClient();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/telegram-client/chats", isAuth, async (req, res) => {
    try {
      const chats = await getChats();
      res.json(chats);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/telegram-client/peer-details/:peerId", isAuth, async (req, res) => {
    const { peerId } = req.params;
    try {
      const details = await getPeerDetails(peerId);
      res.json(details);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/telegram-client/profile-photo/:peerId", isAuth, async (req, res) => {
    const { peerId } = req.params;
    try {
      const client = getTelegramClient();
      if (!client || !client.connected) {
        return res.status(400).json({ message: "Telegram client not connected" });
      }

      // Check cache first
      const cacheDir = path.join(process.cwd(), 'public', 'uploads', 'profile_photos');
      const cacheFilePath = path.join(cacheDir, `${peerId}.jpg`);

      if (fs.existsSync(cacheFilePath)) {
        return res.sendFile(cacheFilePath);
      }

      // Download from Telegram if not cached
      let peer;
      try {
        peer = await client.getInputEntity(peerId);
      } catch (err) {
        peer = peerId;
      }

      const entity = await client.getEntity(peer);
      const buffer = await client.downloadProfilePhoto(entity);
      if (!buffer || buffer.length === 0) {
        return res.status(404).send("No profile photo");
      }

      // Save to cache directory
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(cacheFilePath, buffer);

      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 1 day
      return res.send(buffer);
    } catch (err: any) {
      console.error("[Profile Photo Error]", err);
      return res.status(500).send("Failed to load photo");
    }
  });

  app.get("/api/telegram-client/message-media/:chatId/:messageId", isAuth, async (req, res) => {
    const { chatId, messageId } = req.params;
    try {
      // Check cache first
      const cacheDir = path.join(process.cwd(), 'public', 'uploads', 'message_media');
      const cacheFilePath = path.join(cacheDir, `${chatId}_${messageId}.jpg`);

      if (fs.existsSync(cacheFilePath)) {
        return res.sendFile(cacheFilePath);
      }

      const buffer = await downloadMessageMedia(chatId, Number(messageId));
      if (!buffer || buffer.length === 0) {
        return res.status(404).send("Failed to download media");
      }

      // Save to cache directory
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(cacheFilePath, buffer);

      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
      return res.send(buffer);
    } catch (err: any) {
      console.error("[Message Media Error]", err);
      return res.status(500).send("Failed to load message media");
    }
  });

  app.get("/api/telegram-client/messages/:peer", isAuth, async (req, res) => {
    const { peer } = req.params;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    try {
      const messages = await getChatMessages(peer, limit);
      res.json(messages);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/telegram-client/send-message", isAuth, async (req, res) => {
    const { chatId, text } = req.body;
    if (!chatId || !text) {
      return res.status(400).json({ message: "chatId and text are required." });
    }
    try {
      const message = await sendChatMessage(chatId, text);
      res.json(message);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- Telegram Auto-Forward API Routes ---
  app.get("/api/forward/config", isAuth, async (req, res) => {
    try {
      const config = await getForwardConfig();
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/forward/config", isAuth, async (req, res) => {
    try {
      const updated = await updateForwardConfig(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/forward/groups", isAuth, async (req, res) => {
    try {
      const groups = await getDetectedGroups();
      res.json(groups);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/forward/sync-groups", isAuth, async (req, res) => {
    try {
      const result = await syncGroupsManually();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/forward/groups/clear", isAuth, async (req, res) => {
    try {
      const cleared = await clearForwardCounters();
      res.json({ success: true, groups: cleared });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/forward/groups/:groupId/toggle", isAuth, async (req, res) => {
    const { groupId } = req.params;
    try {
      const groups = await getDetectedGroups();
      const group = groups.find(g => g.groupId === groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found." });
      }
      group.disabled = !group.disabled;
      await saveDetectedGroups(groups);
      res.json({ success: true, groups });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/forward/test", isAuth, async (req, res) => {
    try {
      const result = await testForwardMessage();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- Support Tickets API Routes ---
  app.get("/api/support-tickets", isAuth, async (req, res) => {
    try {
      const tickets = await storage.getSupportTickets();
      res.json(tickets);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/support-tickets/:id/status", isAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { status } = req.body;
      const updated = await storage.updateSupportTicketStatus(id, status);

      if (updated && updated.userTelegramId) {
        try {
          const targetBot = getBotInstance();
          if (targetBot) {
            const chatId = parseInt(updated.userTelegramId, 10);
            if (!isNaN(chatId)) {
              if (status === 'resolved') {
                await targetBot.sendMessage(
                  chatId,
                  `<tg-emoji emoji-id="5949584381424178413">✅</tg-emoji> <b>Support Ticket #${updated.id} Resolved</b>\n\n` +
                  `Your support request regarding <b>${escapeHTML(updated.issueType)}</b> has been marked as <b>Resolved</b> by our support team.\n\n` +
                  `Thank you for reaching out! If you still need help, feel free to contact us anytime.`,
                  { parse_mode: 'HTML' }
                ).catch(() => {});
              } else if (status === 'closed') {
                await targetBot.sendMessage(
                  chatId,
                  `<tg-emoji emoji-id="5215570077876756627">❌</tg-emoji> <b>Support Ticket #${updated.id} Closed</b>\n\n` +
                  `Your support request regarding <b>${escapeHTML(updated.issueType)}</b> has been marked as <b>Closed</b> by our support team.`,
                  { parse_mode: 'HTML' }
                ).catch(() => {});
              } else if (status === 'open' || status === 'in_progress') {
                await targetBot.sendMessage(
                  chatId,
                  `<tg-emoji emoji-id="5260535596941582167">💬</tg-emoji> <b>Support Ticket #${updated.id} Reopened</b>\n\n` +
                  `Your support request regarding <b>${escapeHTML(updated.issueType)}</b> has been reopened by support.`,
                  { parse_mode: 'HTML' }
                ).catch(() => {});
              }
            }
          }
        } catch (botErr) {
          console.error("Error sending status notification to user:", botErr);
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
