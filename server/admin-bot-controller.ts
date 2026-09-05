import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import os from 'os';
import path from 'path';
import { db } from './db';
import { storage } from './storage';
import { payments, orders, products, telegramUsers, settings, promoCodes, promoCodeRedemptions, broadcastLogs, categories } from '@shared/schema';
import { eq, gte, and, sql, desc, ne, like, or } from 'drizzle-orm';

// Hardcoded fallback admin bot token & admin IDs
const HARDCODED_ADMIN_BOT_TOKEN = '7313441520:AAFKE2NgsX4QoFc_xkeQwBF7VtYNydnslj0';
const HARDCODED_ADMIN_CHAT_IDS = ['7507799896', '8420861243'];

let adminBot: TelegramBot | null = null;
let mainBotReference: TelegramBot | null = null;

// Multi-step interactive state machine for Admin Bot
interface AdminSessionState {
  step?: string;
  data?: any;
}
const adminSessions: Map<string, AdminSessionState> = new Map();

export async function getAdminSession(chatId: string | number): Promise<AdminSessionState | undefined> {
  const idStr = String(chatId);
  const mem = adminSessions.get(idStr);
  if (mem) return mem;
  try {
    const setting = await storage.getSetting(`ADMIN_SESSION_${idStr}`);
    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      adminSessions.set(idStr, parsed);
      return parsed;
    }
  } catch (e) {}
  return undefined;
}

export async function setAdminSession(chatId: string | number, state: AdminSessionState) {
  const idStr = String(chatId);
  adminSessions.set(idStr, state);
  try {
    await storage.setSetting(`ADMIN_SESSION_${idStr}`, JSON.stringify(state));
  } catch (e) {}
}

export async function clearAdminSession(chatId: string | number) {
  const idStr = String(chatId);
  adminSessions.delete(idStr);
  try {
    await storage.setSetting(`ADMIN_SESSION_${idStr}`, '');
  } catch (e) {}
}

let inMemoryPausedState = false;
let inMemoryAdminChatIds = new Set<string>(HARDCODED_ADMIN_CHAT_IDS);
let inMemoryBotTokens = new Set<string>([HARDCODED_ADMIN_BOT_TOKEN]);
let selectedServerMap: Map<string, string> = new Map();

export function setMainBotReferenceForAdmin(bot: TelegramBot) {
  mainBotReference = bot;
}

export function escapeHTML(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function patchBotMethods(targetBot: TelegramBot) {
  if (!targetBot || (targetBot as any).__patched) return;
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
           str.includes('DOCUMENT_INVALID');
  };

  targetBot.sendMessage = async function(chatId: any, text: string, options?: any) {
    try {
      return await originalSendMessage(chatId, text, options);
    } catch (err: any) {
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
      const caption = options?.caption;
      if (isDocumentInvalid(err) && typeof caption === 'string' && caption.includes('<tg-emoji')) {
        console.warn(`[Bot API] DOCUMENT_INVALID detected. Stripping tg-emoji tags and retrying sendPhoto to ${chatId}`);
        const cleanOptions = { ...options, caption: stripEmojis(caption) };
        return await originalSendPhoto(chatId, photo, cleanOptions, fileOpts);
      }
      throw err;
    }
  } as any;

  targetBot.sendVideo = async function(chatId: any, video: any, options?: any) {
    try {
      return await originalSendVideo(chatId, video, options);
    } catch (err: any) {
      const caption = options?.caption;
      if (isDocumentInvalid(err) && typeof caption === 'string' && caption.includes('<tg-emoji')) {
        console.warn(`[Bot API] DOCUMENT_INVALID detected. Stripping tg-emoji tags and retrying sendVideo to ${chatId}`);
        const cleanOptions = { ...options, caption: stripEmojis(caption) };
        return await originalSendVideo(chatId, video, cleanOptions);
      }
      throw err;
    }
  } as any;

  targetBot.sendDocument = async function(chatId: any, doc: any, options?: any) {
    try {
      return await originalSendDocument(chatId, doc, options);
    } catch (err: any) {
      const caption = options?.caption;
      if (isDocumentInvalid(err) && typeof caption === 'string' && caption.includes('<tg-emoji')) {
        console.warn(`[Bot API] DOCUMENT_INVALID detected. Stripping tg-emoji tags and retrying sendDocument to ${chatId}`);
        const cleanOptions = { ...options, caption: stripEmojis(caption) };
        return await originalSendDocument(chatId, doc, cleanOptions);
      }
      throw err;
    }
  } as any;
}

// Convert Telegram Message Entities (including Premium Custom Emojis) into HTML format
export function entitiesToHTML(text: string, entities?: TelegramBot.MessageEntity[]): string {
  if (!text) return '';
  if (!entities || entities.length === 0) return text;

  const sorted = [...entities].sort((a, b) => b.offset - a.offset);
  let result = text;

  for (const entity of sorted) {
    const start = entity.offset;
    const end = entity.offset + entity.length;
    const innerText = result.substring(start, end);

    let tagOpen = '';
    let tagClose = '';

    if (entity.type === 'custom_emoji' && entity.custom_emoji_id) {
      tagOpen = `<tg-emoji emoji-id="${entity.custom_emoji_id}">`;
      tagClose = `</tg-emoji>`;
    } else if (entity.type === 'bold') {
      tagOpen = '<b>';
      tagClose = '</b>';
    } else if (entity.type === 'italic') {
      tagOpen = '<i>';
      tagClose = '</i>';
    } else if (entity.type === 'code') {
      tagOpen = '<code>';
      tagClose = '</code>';
    } else if (entity.type === 'pre') {
      tagOpen = '<pre>';
      tagClose = '</pre>';
    } else if (entity.type === 'strikethrough') {
      tagOpen = '<s>';
      tagClose = '</s>';
    } else if (entity.type === 'underline') {
      tagOpen = '<u>';
      tagClose = '</u>';
    } else if (entity.type === 'text_link' && entity.url) {
      tagOpen = `<a href="${entity.url}">`;
      tagClose = '</a>';
    }

    if (tagOpen && tagClose) {
      result = result.substring(0, start) + tagOpen + innerText + tagClose + result.substring(end);
    }
  }

  return result;
}

export async function getAuthorizedBotTokens(): Promise<string[]> {
  const tokens = new Set<string>([HARDCODED_ADMIN_BOT_TOKEN]);
  inMemoryBotTokens.forEach(t => tokens.add(t));
  try {
    const dbSetting = await storage.getSetting('ADMIN_BOT_TOKEN');
    if (dbSetting?.value) {
      tokens.add(dbSetting.value.trim());
    }
    const dbList = await storage.getSetting('ADMIN_BOT_TOKENS');
    if (dbList?.value) {
      dbList.value.split(',').forEach(t => {
        const clean = t.trim();
        if (clean) tokens.add(clean);
      });
    }
  } catch (err) { }
  return Array.from(tokens);
}

export async function addBotToken(newToken: string): Promise<string[]> {
  const cleanToken = newToken.trim();
  inMemoryBotTokens.add(cleanToken);
  const current = await getAuthorizedBotTokens();
  if (!current.includes(cleanToken)) {
    current.push(cleanToken);
    try {
      await storage.setSetting('ADMIN_BOT_TOKENS', current.join(','));
    } catch (err) {
      console.error('[ADMIN BOT] DB setting error:', err);
    }
  }
  return current;
}

export function getServerName(): string {
  return process.env.SERVER_NAME || process.env.SERVER_ID || os.hostname() || 'Server-Main';
}

export async function getRegisteredServers(): Promise<string[]> {
  const servers = new Set<string>(['All Servers', getServerName()]);
  try {
    const dbSetting = await storage.getSetting('REGISTERED_SERVERS');
    if (dbSetting?.value) {
      dbSetting.value.split(',').forEach(s => {
        const clean = s.trim();
        if (clean) servers.add(clean);
      });
    }
  } catch (err) { }
  return Array.from(servers);
}

export async function registerServerHeartbeat() {
  try {
    const currentName = getServerName();
    const existing = await getRegisteredServers();
    if (!existing.includes(currentName)) {
      existing.push(currentName);
      await storage.setSetting('REGISTERED_SERVERS', existing.join(','));
    }
  } catch (err) {
    console.error('[ADMIN BOT] Heartbeat registration error:', err);
  }
}

export async function getAuthorizedAdminChatIds(): Promise<string[]> {
  const chatIds = new Set<string>(HARDCODED_ADMIN_CHAT_IDS);
  if (process.env.ADMIN_CHAT_ID) {
    process.env.ADMIN_CHAT_ID.split(',').forEach(id => {
      const clean = id.trim();
      if (clean) chatIds.add(clean);
    });
  }
  if (process.env.ADMIN_CHAT_IDS) {
    process.env.ADMIN_CHAT_IDS.split(',').forEach(id => {
      const clean = id.trim();
      if (clean) chatIds.add(clean);
    });
  }
  inMemoryAdminChatIds.forEach(id => chatIds.add(id));
  try {
    const dbSetting = await storage.getSetting('ADMIN_CHAT_IDS');
    if (dbSetting?.value) {
      dbSetting.value.split(',').forEach(id => {
        const clean = id.trim();
        if (clean) {
          chatIds.add(clean);
          inMemoryAdminChatIds.add(clean);
        }
      });
    }
  } catch (err) { }
  return Array.from(chatIds);
}

export async function isAuthorizedAdmin(chatId: string | number): Promise<boolean> {
  if (!chatId) return false;
  const idStr = String(chatId).trim();
  const authorized = await getAuthorizedAdminChatIds();
  return authorized.includes(idStr);
}

export async function isShopBotPaused(): Promise<boolean> {
  try {
    const setting = await storage.getSetting('SHOP_BOT_PAUSED');
    if (setting?.value !== undefined) {
      inMemoryPausedState = setting.value === 'true';
    }
  } catch (err) { }
  return inMemoryPausedState;
}

export async function setShopBotPaused(paused: boolean): Promise<boolean> {
  inMemoryPausedState = paused;
  try {
    await storage.setSetting('SHOP_BOT_PAUSED', paused ? 'true' : 'false');
  } catch (err) {
    console.error('[ADMIN BOT] Setting DB update error:', err);
  }
  return paused;
}

export async function addAdminChatId(newChatId: string): Promise<string[]> {
  const cleanId = String(newChatId).trim();
  inMemoryAdminChatIds.add(cleanId);
  const current = await getAuthorizedAdminChatIds();
  if (!current.includes(cleanId)) {
    current.push(cleanId);
    try {
      await storage.setSetting('ADMIN_CHAT_IDS', current.join(','));
    } catch (err) {
      console.error('[ADMIN BOT] DB setting error:', err);
    }
  }
  return current;
}

export async function removeAdminChatId(chatIdToRemove: string): Promise<string[]> {
  const cleanId = String(chatIdToRemove).trim();
  inMemoryAdminChatIds.delete(cleanId);
  const current = await getAuthorizedAdminChatIds();
  const updated = current.filter(id => id !== cleanId);
  try {
    await storage.setSetting('ADMIN_CHAT_IDS', updated.join(','));
  } catch (err) {
    console.error('[ADMIN BOT] DB setting error:', err);
  }
  return updated;
}

// PERSISTENT ADMIN REPLY KEYBOARD
export function getAdminReplyKeyboard() {
  return {
    keyboard: [
      [
        { text: 'Products & Stock' },
        { text: 'Customer Accounts' }
      ],
      [
        { text: 'Mass Broadcast' },
        { text: 'Promo Codes' }
      ],
      [
        { text: 'Settings & Gateways' },
        { text: 'Daily Reports' }
      ]
    ],
    resize_keyboard: true,
    persistent: true
  };
}

export function getActiveAdminBot(overrideBot?: TelegramBot): TelegramBot | null {
  return overrideBot || adminBot || mainBotReference;
}

export function isDedicatedAdminBot(bot: TelegramBot | null): boolean {
  if (!bot) return false;
  if (adminBot && (bot === adminBot || bot.token === HARDCODED_ADMIN_BOT_TOKEN)) return true;
  if (bot.token === HARDCODED_ADMIN_BOT_TOKEN) return true;
  return false;
}

export async function sendAdminMenu(chatId: string | number, overrideBot?: TelegramBot) {
  const botToUse = getActiveAdminBot(overrideBot);
  if (!botToUse) return;

  const isPaused = await isShopBotPaused();
  const statusLabel = isPaused ? 'Status: PAUSED (Maintenance Mode)' : 'Status: ACTIVE (Live)';
  const adminIds = await getAuthorizedAdminChatIds();
  const currentServer = selectedServerMap.get(String(chatId)) || getServerName();

  const text = `⚡ <b>FULL A-Z ADMIN CONTROL PANEL</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 <b>Server Node:</b> <code>${currentServer}</code>\n` +
    `🤖 <b>Shop Bot Status:</b> ${isPaused ? '🔴 PAUSED' : '🟢 ACTIVE'}\n` +
    `👥 <b>Authorized Admins:</b> ${adminIds.length}\n\n` +
    `Select a category from the menu below or use the persistent keyboard buttons:`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '📦 Products & Stock', callback_data: 'menu_products' }],
      [{ text: '👥 Customer Accounts', callback_data: 'menu_customers' }],
      [{ text: '📢 Mass Broadcast', callback_data: 'menu_broadcast' }],
      [{ text: '🎟️ Promo Codes', callback_data: 'menu_promocodes' }],
      [{ text: '⚙️ Settings & Gateways', callback_data: 'menu_settings' }],
      [{ text: statusLabel, callback_data: 'toggle_status' }],
      [{ text: '📊 24h Daily Statement', callback_data: 'get_statement' }]
    ]
  };

  await botToUse.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: getAdminReplyKeyboard()
  }).catch(err => console.error('[ADMIN BOT] sendAdminMenu error:', err?.message || err));

  await botToUse.sendMessage(chatId, `👇 <b>Control Dashboard Quick Actions:</b>`, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  }).catch(err => console.error('[ADMIN BOT] sendAdminMenu quick actions error:', err?.message || err));
}

// ----------------------------------------------------
// 1. PRODUCTS & STOCK MANAGEMENT SUB-MENU
// ----------------------------------------------------
export async function sendProductsAdminMenu(chatId: string | number, overrideBot?: TelegramBot) {
  const botToUse = getActiveAdminBot(overrideBot);
  if (!botToUse) return;
  const allProducts = await db.select().from(products);

  let msg = `📦 <b>PRODUCTS & STOCK MANAGEMENT</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Total Products: <b>${allProducts.length}</b>\n\n`;

  for (const p of allProducts.slice(0, 15)) {
    const priceUSD = (p.price / 100).toFixed(2);
    const emojiTag = p.customEmojiId ? `<tg-emoji emoji-id="${p.customEmojiId}">📦</tg-emoji>` : `📦`;
    const nameEsc = escapeHTML(p.name);
    const catEsc = escapeHTML(p.category || 'General');
    msg += `${emojiTag} <b>ID ${p.id}:</b> ${nameEsc} — <b>$${priceUSD}</b> (${catEsc})\n`;
  }
  if (allProducts.length > 15) {
    msg += `\n<i>...and ${allProducts.length - 15} more products.</i>\n`;
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ Add New Product', callback_data: 'admin_add_product' }],
      [{ text: '🔑 Add Stock / Accounts', callback_data: 'admin_add_stock' }],
      [{ text: '✨ Set Product Premium Custom Emoji', callback_data: 'admin_edit_emoji' }],
      [{ text: '✏️ Edit Product Price', callback_data: 'admin_edit_price' }],
      [{ text: '🗑️ Delete Product', callback_data: 'admin_delete_product' }],
      [{ text: '⏪ Back to Main Admin Menu', callback_data: 'admin_main_menu' }]
    ]
  };

  await botToUse.sendMessage(chatId, msg, { parse_mode: 'HTML', reply_markup: keyboard }).catch(err => console.error('[ADMIN BOT] sendProductsAdminMenu error:', err?.message || err));
}

// ----------------------------------------------------
// 2. CUSTOMER ACCOUNTS SUB-MENU
// ----------------------------------------------------
export async function sendCustomersAdminMenu(chatId: string | number, overrideBot?: TelegramBot) {
  const botToUse = getActiveAdminBot(overrideBot);
  if (!botToUse) return;
  const usersCount = (await db.select().from(telegramUsers)).length;

  const msg = `👥 <b>CUSTOMER ACCOUNTS MANAGEMENT</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Total Registered Customers: <b>${usersCount}</b>\n\n` +
    `Choose an action to manage customer balances, search users, or ban/unban customer accounts:`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '🔍 Search Customer Profile', callback_data: 'admin_search_customer' }],
      [{ text: '💵 Credit User Balance', callback_data: 'admin_credit_balance' }],
      [{ text: '➖ Debit User Balance', callback_data: 'admin_debit_balance' }],
      [{ text: '🚫 Ban / Unban Customer', callback_data: 'admin_toggle_ban' }],
      [{ text: '⏪ Back to Main Admin Menu', callback_data: 'admin_main_menu' }]
    ]
  };

  await botToUse.sendMessage(chatId, msg, { parse_mode: 'HTML', reply_markup: keyboard }).catch(err => console.error('[ADMIN BOT] sendCustomersAdminMenu error:', err?.message || err));
}

// ----------------------------------------------------
// 3. PROMO CODES SUB-MENU
// ----------------------------------------------------
export async function sendPromoCodesAdminMenu(chatId: string | number, overrideBot?: TelegramBot) {
  const botToUse = getActiveAdminBot(overrideBot);
  if (!botToUse) return;
  const codes = await db.select().from(promoCodes);

  let msg = `🎟️ <b>PROMO CODES & DISCOUNTS</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Total Active Codes: <b>${codes.length}</b>\n\n`;

  for (const c of codes) {
    const rewardUSD = (c.reward / 100).toFixed(2);
    msg += `▪️ <code>${c.code}</code>: <b>+$${rewardUSD}</b> (${c.usesCount}/${c.maxUses} used) [${c.status}]\n`;
  }
  if (codes.length === 0) {
    msg += `<i>No promo codes active yet.</i>\n`;
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ Create New Promo Code', callback_data: 'admin_create_promo' }],
      [{ text: '🗑️ Delete Promo Code', callback_data: 'admin_delete_promo' }],
      [{ text: '⏪ Back to Main Admin Menu', callback_data: 'admin_main_menu' }]
    ]
  };

  await botToUse.sendMessage(chatId, msg, { parse_mode: 'HTML', reply_markup: keyboard }).catch(err => console.error('[ADMIN BOT] sendPromoCodesAdminMenu error:', err?.message || err));
}

// ----------------------------------------------------
// 4. SETTINGS & GATEWAYS SUB-MENU
// ----------------------------------------------------
export async function sendSettingsAdminMenu(chatId: string | number, overrideBot?: TelegramBot) {
  const botToUse = getActiveAdminBot(overrideBot);
  if (!botToUse) return;

  const bep20On = (await storage.getSetting('PAYMENT_BEP20_ENABLED'))?.value !== 'false';
  const trc20On = (await storage.getSetting('PAYMENT_TRC20_ENABLED'))?.value !== 'false';
  const binanceOn = (await storage.getSetting('PAYMENT_BINANCE_ENABLED'))?.value !== 'false';
  const cryptomusOn = (await storage.getSetting('PAYMENT_CRYPTOMUS_ENABLED'))?.value !== 'false';

  const msg = `⚙️ <b>SETTINGS & PAYMENT GATEWAYS</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `▪️ BEP20 USDT: <b>${bep20On ? '🟢 Enabled' : '🔴 Disabled'}</b>\n` +
    `▪️ TRC20 USDT: <b>${trc20On ? '🟢 Enabled' : '🔴 Disabled'}</b>\n` +
    `▪️ Binance Pay: <b>${binanceOn ? '🟢 Enabled' : '🔴 Disabled'}</b>\n` +
    `▪️ Cryptomus: <b>${cryptomusOn ? '🟢 Enabled' : '🔴 Disabled'}</b>\n`;

  const keyboard = {
    inline_keyboard: [
      [{ text: `BEP20: ${bep20On ? 'Disable' : 'Enable'}`, callback_data: 'toggle_gateway_bep20' }, { text: `TRC20: ${trc20On ? 'Disable' : 'Enable'}`, callback_data: 'toggle_gateway_trc20' }],
      [{ text: `Binance: ${binanceOn ? 'Disable' : 'Enable'}`, callback_data: 'toggle_gateway_binance' }, { text: `Cryptomus: ${cryptomusOn ? 'Disable' : 'Enable'}`, callback_data: 'toggle_gateway_cryptomus' }],
      [{ text: '👤 Authorized Admin Chat IDs', callback_data: 'admin_manage_chat_ids' }],
      [{ text: '✏️ Update Wallet Address / Pay ID', callback_data: 'admin_edit_wallet_settings' }],
      [{ text: '🔑 Change Admin Bot Token', callback_data: 'prompt_add_bot_token' }],
      [{ text: '⏪ Back to Main Admin Menu', callback_data: 'admin_main_menu' }]
    ]
  };

  await botToUse.sendMessage(chatId, msg, { parse_mode: 'HTML', reply_markup: keyboard }).catch(err => console.error('[ADMIN BOT] sendSettingsAdminMenu error:', err?.message || err));
}

// ----------------------------------------------------
// 5. RICH MASS BROADCAST SUB-MENU & ENGINE
// ----------------------------------------------------
export async function sendBroadcastAdminMenu(chatId: string | number, overrideBot?: TelegramBot) {
  const botToUse = getActiveAdminBot(overrideBot);
  if (!botToUse) return;

  const pastLogs = await db.select().from(broadcastLogs).orderBy(desc(broadcastLogs.createdAt)).limit(5);

  let msg = `📢 <b>MASS BROADCAST ENGINE</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Send rich announcement broadcasts to ALL registered main bot users.\n\n` +
    `<b>Recent Broadcasts & Recalls:</b>\n`;

  if (pastLogs.length === 0) {
    msg += `<i>No broadcast logs recorded yet.</i>\n`;
  } else {
    for (const log of pastLogs) {
      msg += `▪️ <b>Broadcast #${log.id}:</b> ${log.recipientCount} recipients [${log.broadcastType}] — ${log.createdAt ? new Date(log.createdAt).toISOString().split('T')[0] : ''}\n`;
    }
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ Create New Broadcast', callback_data: 'admin_start_broadcast' }],
      [{ text: '🗑️ Delete / Recall Sent Broadcast', callback_data: 'admin_recall_broadcast' }],
      [{ text: '⏪ Back to Main Admin Menu', callback_data: 'admin_main_menu' }]
    ]
  };

  await botToUse.sendMessage(chatId, msg, { parse_mode: 'HTML', reply_markup: keyboard }).catch(err => console.error('[ADMIN BOT] sendBroadcastAdminMenu error:', err?.message || err));
}

export async function generate24hDailyStatementText(targetServer?: string): Promise<string> {
  const now = new Date();
  const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const serverTag = targetServer || getServerName();

  let depositCount = 0;
  let totalDepositAmount = 0;
  let orderCount = 0;
  let totalOrderRevenue = 0;
  let totalUserCount = 0;

  try {
    const recentPayments = await db.select()
      .from(payments)
      .where(and(gte(payments.createdAt, past24h), eq(payments.status, 'completed')));
    totalDepositAmount = recentPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    depositCount = recentPayments.length;
  } catch (err) { }

  try {
    const recentOrders = await db.select({
      orderId: orders.id,
      createdAt: orders.createdAt,
      price: products.price,
      productName: products.name
    })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .where(gte(orders.createdAt, past24h));

    totalOrderRevenue = recentOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
    orderCount = recentOrders.length;
  } catch (err) { }

  let monthlyUserCount = 0;
  let activeUserCount = 0;

  try {
    const allUsers = await db.select().from(telegramUsers);
    totalUserCount = allUsers.length;
    const past30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    monthlyUserCount = allUsers.filter(u => u.createdAt && new Date(u.createdAt) >= past30d).length;
    activeUserCount = allUsers.filter(u => u.lastRequestAt && new Date(u.lastRequestAt) >= past24h).length;
  } catch (err) { }

  const isPaused = await isShopBotPaused();
  const statusStr = isPaused ? '🔴 PAUSED (Maintenance Mode)' : '🟢 ACTIVE (Live)';

  const statementText = `
🌐 <b>MULTI-SERVER DAILY STATEMENT REPORT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🖥️ <b>Server Node:</b> <code>${serverTag}</code>
📅 <b>Date:</b> ${now.toISOString().split('T')[0]}
🤖 <b>Node Status:</b> ${statusStr}

💰 <b>DEPOSITS (Past 24h)</b>
▪️ Successful Deposits: <b>${depositCount}</b>
▪️ Total Deposited: <b>$${(totalDepositAmount / 100).toFixed(2)}</b>

🛒 <b>ORDERS & SALES (Past 24h)</b>
▪️ Products Sold: <b>${orderCount}</b>
▪️ Total Sales Revenue: <b>$${(totalOrderRevenue / 100).toFixed(2)}</b>

👥 <b>CUSTOMER STATS</b>
▪️ Total Registered Customers: <b>${totalUserCount}</b>
▪️ New Customers (Past 30d): <b>${monthlyUserCount}</b>
▪️ Active Customers (Past 24h): <b>${activeUserCount}</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>Generated automatically by Multi-Server Control Engine.</i>
`.trim();

  return statementText;
}

export async function generatePaymentsCSV(targetServer?: string): Promise<Buffer> {
  const serverTag = targetServer || getServerName();
  let csvContent = `Server Node,ID,User ID,Username,First Name,Amount,Currency,Payment Method,Status,Date\n`;
  try {
    const allPayments = await db.select({
      id: payments.id,
      telegramUserId: payments.telegramUserId,
      username: telegramUsers.username,
      firstName: telegramUsers.firstName,
      amount: payments.amount,
      currency: payments.currency,
      status: payments.status,
      paymentMethod: payments.paymentMethod,
      createdAt: payments.createdAt
    })
      .from(payments)
      .leftJoin(telegramUsers, eq(payments.telegramUserId, telegramUsers.id))
      .orderBy(desc(payments.createdAt));

    for (const p of allPayments) {
      const username = p.username ? `@${p.username}` : 'N/A';
      const firstName = (p.firstName || 'User').replace(/,/g, ' ');
      const dateStr = p.createdAt ? new Date(p.createdAt).toISOString() : '';
      csvContent += `"${serverTag}",${p.id},${p.telegramUserId},"${username}","${firstName}",${(p.amount / 100).toFixed(2)},${p.currency},"${p.paymentMethod}","${p.status}","${dateStr}"\n`;
    }
  } catch (err) {
    csvContent += `"${serverTag}",# Database currently offline\n`;
  }

  return Buffer.from(csvContent, 'utf-8');
}

export async function sendDailyStatementToAdmins() {
  if (!adminBot) return;
  try {
    const statementText = await generate24hDailyStatementText();
    const adminIds = await getAuthorizedAdminChatIds();

    for (const chatId of adminIds) {
      try {
        await adminBot.sendMessage(chatId, statementText, { parse_mode: 'HTML' }).catch(() => {});
      } catch (err: any) { }
    }
  } catch (err) { }
}

export async function initAdminBotController() {
  if (adminBot) return adminBot;

  const activeTokens = await getAuthorizedBotTokens();
  const targetToken = activeTokens[0] || HARDCODED_ADMIN_BOT_TOKEN;
  const mainTokenSetting = await storage.getSetting("TELEGRAM_BOT_TOKEN");
  const mainToken = mainTokenSetting?.value || process.env.TELEGRAM_BOT_TOKEN;
  const isSameAsMain = targetToken === mainToken;

  try {
    console.log(`[ADMIN BOT] Initializing Multi-Server Admin Controller (${getServerName()})...`);
    await registerServerHeartbeat();
    adminBot = new TelegramBot(targetToken, { polling: !isSameAsMain });
    adminBot.removeAllListeners();
    patchBotMethods(adminBot);

    adminBot.on('polling_error', (err: any) => {
      if (err?.code === 'ETELEGRAM' && err?.message?.includes('409 Conflict')) {
        console.warn('[ADMIN BOT] 409 Conflict: another instance is polling. Retrying polling in 10s...');
        adminBot?.stopPolling().catch(() => {});
        setTimeout(() => {
          adminBot?.startPolling().catch(() => {});
        }, 10000);
      } else {
        console.warn('[ADMIN BOT] Polling error:', err?.message || err);
      }
    });
    adminBot.on('error', (err: any) => {
      console.warn('[ADMIN BOT] General error:', err?.message || err);
    });

    // Handle commands
    adminBot.onText(/\/(start|admin|menu|status|help|broadcast|massbroadcast)/, async (msg) => {
      const chatId = msg.chat.id;
      if (!(await isAuthorizedAdmin(chatId))) {
        await adminBot?.sendMessage(chatId, '❌ Access Denied. You are not an authorized admin.').catch(() => {});
        return;
      }
      const text = (msg.text || '').trim();
      if (text.startsWith('/broadcast') || text.startsWith('/massbroadcast')) {
        adminSessions.delete(String(chatId));
        await sendBroadcastAdminMenu(chatId);
        return;
      }
      adminSessions.delete(String(chatId));
      await sendAdminMenu(chatId);
    });

    // Handle persistent reply keyboard texts & incoming messages
    adminBot.on('message', async (msg) => {
      const chatId = String(msg.chat.id);
      if (!(await isAuthorizedAdmin(chatId))) return;

      const text = (msg.text || msg.caption || '').trim();

      if (text.includes('Products & Stock')) {
        adminSessions.delete(chatId);
        await sendProductsAdminMenu(chatId);
        return;
      }
      if (text.includes('Customer Accounts')) {
        adminSessions.delete(chatId);
        await sendCustomersAdminMenu(chatId);
        return;
      }
      if (text.includes('Mass Broadcast') || text.toLowerCase().includes('broadcast') || text.includes('📢 Broadcast') || text.includes('📢 Mass Broadcast')) {
        adminSessions.delete(chatId);
        await sendBroadcastAdminMenu(chatId);
        return;
      }
      if (text.includes('Promo Codes')) {
        adminSessions.delete(chatId);
        await sendPromoCodesAdminMenu(chatId);
        return;
      }
      if (text.includes('Settings & Gateways')) {
        adminSessions.delete(chatId);
        await sendSettingsAdminMenu(chatId);
        return;
      }
      if (text.includes('Daily Reports')) {
        adminSessions.delete(chatId);
        const report = await generate24hDailyStatementText();
        await adminBot?.sendMessage(chatId, report, { parse_mode: 'HTML' }).catch(() => {});
        return;
      }

      // Handle active step inputs
      const session = adminSessions.get(chatId);
      if (session && session.step) {
        if (session.step === 'add_prod_name') {
          session.data = { name: text };
          session.step = 'add_prod_price';
          await adminBot?.sendMessage(chatId, `💰 Enter Product Price in USD (e.g. <code>5.00</code>):`, { parse_mode: 'HTML' }).catch(() => {});
          return;
        }
        if (session.step === 'add_prod_price') {
          const price = parseFloat(text);
          if (isNaN(price) || price <= 0) {
            await adminBot?.sendMessage(chatId, `❌ Invalid price. Enter numeric amount in USD (e.g. 5.00):`).catch(() => {});
            return;
          }
          session.data.price = Math.round(price * 100);
          session.step = 'add_prod_category';
          await adminBot?.sendMessage(chatId, `📁 Enter Category Name (e.g. <code>VPN</code>, <code>Streaming</code>, <code>Accounts</code>):`, { parse_mode: 'HTML' }).catch(() => {});
          return;
        }
        if (session.step === 'add_prod_category') {
          session.data.category = text;
          session.step = 'add_prod_desc';
          await adminBot?.sendMessage(chatId, `📝 Enter Product Description:`, { parse_mode: 'HTML' }).catch(() => {});
          return;
        }
        if (session.step === 'add_prod_desc') {
          session.data.description = text;
          session.step = 'add_prod_emoji';
          await adminBot?.sendMessage(chatId, `✨ <b>Select / Send Premium Custom Emoji for "${escapeHTML(session.data.name)}":</b>\n\nSend or paste ANY Telegram Premium Custom Emoji from your emoji picker. The system will automatically capture its Custom Emoji ID and assign it to this product!\n\n<i>Or type <code>skip</code> to use default product icon.</i>`, { parse_mode: 'HTML' }).catch(() => {});
          return;
        }

        // Auto-Capture Custom Emoji Step for Product Creation
        if (session.step === 'add_prod_emoji') {
          let customEmojiId: string | null = null;
          const entities = msg.caption_entities || msg.entities;

          if (entities && entities.length > 0) {
            const customEmojiEntity = entities.find(e => e.type === 'custom_emoji' && e.custom_emoji_id);
            if (customEmojiEntity && customEmojiEntity.custom_emoji_id) {
              customEmojiId = customEmojiEntity.custom_emoji_id;
            }
          }

          const [newProd] = await db.insert(products).values({
            name: session.data.name,
            price: session.data.price,
            type: session.data.category || 'General',
            category: session.data.category || 'General',
            description: session.data.description,
            customEmojiId: customEmojiId || null,
            stockCount: 0
          }).returning();

          adminSessions.delete(chatId);
          const emojiTag = customEmojiId ? `<tg-emoji emoji-id="${customEmojiId}">✨</tg-emoji>` : `📦`;
          await adminBot?.sendMessage(chatId, `${emojiTag} <b>Product Created Successfully!</b>\n\n<b>ID:</b> ${newProd.id}\n<b>Name:</b> ${escapeHTML(newProd.name)}\n<b>Price:</b> $${(newProd.price / 100).toFixed(2)}\n<b>Category:</b> ${escapeHTML(newProd.category || 'General')}\n<b>Custom Emoji ID:</b> <code>${customEmojiId || 'Default'}</code>`, { parse_mode: 'HTML' }).catch(() => {});
          await sendProductsAdminMenu(chatId);
          return;
        }

        // Auto-Capture Custom Emoji Step for Existing Product Update
        if (session.step === 'update_prod_emoji') {
          const productId = session.data.productId;
          let customEmojiId: string | null = null;
          const entities = msg.caption_entities || msg.entities;

          if (entities && entities.length > 0) {
            const customEmojiEntity = entities.find(e => e.type === 'custom_emoji' && e.custom_emoji_id);
            if (customEmojiEntity && customEmojiEntity.custom_emoji_id) {
              customEmojiId = customEmojiEntity.custom_emoji_id;
            }
          }

          if (!customEmojiId) {
            await adminBot?.sendMessage(chatId, `⚠️ <b>No Premium Custom Emoji detected in your message!</b>\n\nPlease send or paste a Telegram Premium Custom Emoji from your emoji picker to link it to this product.`, { parse_mode: 'HTML' }).catch(() => {});
            return;
          }

          await db.update(products).set({ customEmojiId }).where(eq(products.id, productId));
          adminSessions.delete(chatId);

          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="${customEmojiId}">✨</tg-emoji> <b>Product Premium Custom Emoji Updated!</b>\n\nCustom Emoji ID <code>${customEmojiId}</code> has been captured and linked to Product ID #${productId} across the system!`, { parse_mode: 'HTML' }).catch(() => {});
          await sendProductsAdminMenu(chatId);
          return;
        }

        // Add Stock step
        if (session.step === 'add_stock_keys') {
          const productId = session.data.productId;
          const keys = text.split('\n').map(k => k.trim()).filter(k => k.length > 0);
          if (keys.length === 0) {
            await adminBot?.sendMessage(chatId, `❌ No valid stock keys provided. Please paste stock credentials line-by-line.`).catch(() => {});
            return;
          }
          const { stockAccounts } = await import('@shared/schema');
          let added = 0;
          for (const key of keys) {
            await db.insert(stockAccounts).values({
              productId,
              credentials: key,
              status: 'available'
            });
            added++;
          }
          await db.execute(sql`UPDATE products SET stock_count = stock_count + ${added} WHERE id = ${productId}`);
          adminSessions.delete(chatId);
          await adminBot?.sendMessage(chatId, `✅ <b>Successfully added ${added} stock accounts/keys to Product ID ${productId}!</b>`, { parse_mode: 'HTML' }).catch(() => {});
          await sendProductsAdminMenu(chatId);
          return;
        }

        // Credit Balance Step
        if (session.step === 'credit_user_search') {
          session.data = { target: text };
          session.step = 'credit_user_amount';
          await adminBot?.sendMessage(chatId, `💵 Enter amount to <b>CREDIT (+)</b> in USD (e.g. <code>10.00</code>):`, { parse_mode: 'HTML' }).catch(() => {});
          return;
        }
        if (session.step === 'credit_user_amount') {
          const amount = parseFloat(text);
          if (isNaN(amount) || amount <= 0) {
            await adminBot?.sendMessage(chatId, `❌ Invalid amount. Enter numeric USD amount:`).catch(() => {});
            return;
          }
          const target = session.data.target;
          const [user] = await db.select().from(telegramUsers).where(or(eq(telegramUsers.telegramId, target), eq(telegramUsers.username, target.replace('@', ''))));
          if (!user) {
            await adminBot?.sendMessage(chatId, `❌ Customer user not found for ID/username: <code>${target}</code>`, { parse_mode: 'HTML' }).catch(() => {});
            adminSessions.delete(chatId);
            return;
          }
          const creditCents = Math.round(amount * 100);
          await db.execute(sql`UPDATE telegram_users SET balance = balance + ${creditCents} WHERE id = ${user.id}`);
          adminSessions.delete(chatId);
          await adminBot?.sendMessage(chatId, `✅ <b>Credited +$${amount.toFixed(2)} USD to User ${user.firstName || user.username || user.telegramId}!</b>`, { parse_mode: 'HTML' }).catch(() => {});

          if (mainBotReference && user.telegramId) {
            const newBalUSD = ((user.balance || 0) + creditCents) / 100;
            const caption = `<tg-emoji emoji-id="5949584381424178413">✅</tg-emoji> <b>Balance Added Successfully!</b>\n` +
              `➖➖➖➖➖➖➖➖➖➖\n\n` +
              `<tg-emoji emoji-id="5429518319243775957">💵</tg-emoji> Amount Credited: <b>+$${amount.toFixed(2)} USD</b> <tg-emoji emoji-id="5409048419211682843">💵</tg-emoji>\n` +
              `<tg-emoji emoji-id="5370919202796348364">💳</tg-emoji> Payment Method: <b>Admin Manual Credit</b>\n` +
              `➖➖➖➖➖➖➖➖➖➖\n\n` +
              `<tg-emoji emoji-id="6032693626394382504">💎</tg-emoji> Your New Balance: <b>$${newBalUSD.toFixed(2)} USD</b>\n\n` +
              `<tg-emoji emoji-id="5377660214096974712">✨</tg-emoji> Thank you for trusting <b>Shopeefy</b>! Your balance has been updated.`;

            const inline_keyboard = [
              [
                { text: '🛍️ Catalog', callback_data: 'buy', style: 'success', icon_custom_emoji_id: '5377660214096974712' },
                { text: '👤 Profile', callback_data: 'profile', style: 'primary', icon_custom_emoji_id: '5260399854500191689' }
              ]
            ];
            const paymentBannerPath = path.join(process.cwd(), "public", "imesh_cloudbot_balance_banner.png");
            if (fs.existsSync(paymentBannerPath)) {
              mainBotReference.sendPhoto(Number(user.telegramId), fs.createReadStream(paymentBannerPath), {
                caption,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard } as any
              }).catch(() => {});
            } else {
              mainBotReference.sendMessage(Number(user.telegramId), caption, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard } as any
              }).catch(() => {});
            }
          }
          await sendCustomersAdminMenu(chatId);
          return;
        }

        // Broadcast steps (Auto-converts Telegram Premium Custom Emojis, HTML formatting & downloads Photo Buffer)
        if (session.step === 'broadcast_text') {
          const rawText = msg.caption || msg.text || '';
          const entities = msg.caption_entities || msg.entities;
          const formattedHTML = entitiesToHTML(rawText, entities);

          let photoBuffer: Buffer | undefined = undefined;
          if (msg.photo && msg.photo.length > 0 && adminBot) {
            try {
              const photoFileId = msg.photo[msg.photo.length - 1].file_id;
              const fileLink = await adminBot.getFileLink(photoFileId);
              const res = await axios.get(fileLink, { responseType: 'arraybuffer' });
              photoBuffer = Buffer.from(res.data);
            } catch (err: any) {
              console.error('[ADMIN BOT] Failed to download broadcast photo buffer:', err?.message || err);
            }
          }

          session.data = session.data || {};
          session.data.messageText = formattedHTML;
          session.data.photoBuffer = photoBuffer;
          session.step = 'broadcast_button_choice';

          const keyboard = {
            inline_keyboard: [
              [{ text: '🛒 Attach Buy Now Product Button', callback_data: 'bcast_attach_product' }],
              [{ text: '🔗 Attach Custom URL Button', callback_data: 'bcast_attach_url' }],
              [{ text: '⚡ Send Broadcast (No Extra Buttons)', callback_data: 'bcast_confirm_send' }]
            ]
          };
          await adminBot?.sendMessage(chatId, `📝 <b>Broadcast Content Recorded (${photoBuffer ? 'Photo &' : ''} Text with Premium Emojis)!</b>\n\nWould you like to attach an interactive button to this broadcast?`, { parse_mode: 'HTML', reply_markup: keyboard }).catch(() => {});
          return;
        }

        if (session.step === 'broadcast_url_btn_text') {
          session.data.customButtonText = text;
          session.step = 'broadcast_url_btn_url';
          await adminBot?.sendMessage(chatId, `🔗 Enter the Destination URL for the button (e.g. <code>https://t.me/...</code>):`, { parse_mode: 'HTML' }).catch(() => {});
          return;
        }

        if (session.step === 'broadcast_url_btn_url') {
          session.data.customButtonUrl = text;
          session.step = 'broadcast_confirm';

          const keyboard = {
            inline_keyboard: [
              [{ text: '⚡ CONFIRM & SEND BROADCAST', callback_data: 'bcast_confirm_send' }],
              [{ text: '❌ Cancel Broadcast', callback_data: 'admin_main_menu' }]
            ]
          };

          await adminBot?.sendMessage(chatId, `📢 <b>BROADCAST PREVIEW READY</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n${session.data.messageText}\n\n<b>Button:</b> [ ${session.data.customButtonText} ] -> ${session.data.customButtonUrl}`, {
            parse_mode: 'HTML',
            reply_markup: keyboard
          }).catch(() => {});
          return;
        }

        // Promo Code step
        if (session.step === 'promo_code_name') {
          session.data = { code: text.toUpperCase().trim() };
          session.step = 'promo_code_reward';
          await adminBot?.sendMessage(chatId, `💰 Enter Discount Reward Amount in USD (e.g. <code>5.00</code>):`, { parse_mode: 'HTML' }).catch(() => {});
          return;
        }
        if (session.step === 'promo_code_reward') {
          const reward = parseFloat(text);
          if (isNaN(reward) || reward <= 0) {
            await adminBot?.sendMessage(chatId, `❌ Invalid reward. Enter numeric amount in USD (e.g. 5.00):`).catch(() => {});
            return;
          }
          session.data.reward = Math.round(reward * 100);
          session.step = 'promo_code_uses';
          await adminBot?.sendMessage(chatId, `🔢 Enter Maximum Uses Limit (e.g. <code>100</code>):`, { parse_mode: 'HTML' }).catch(() => {});
          return;
        }
        if (session.step === 'promo_code_uses') {
          const uses = parseInt(text);
          if (isNaN(uses) || uses <= 0) {
            await adminBot?.sendMessage(chatId, `❌ Invalid limit. Enter integer limit:`).catch(() => {});
            return;
          }
          await db.insert(promoCodes).values({
            code: session.data.code,
            reward: session.data.reward,
            maxUses: uses,
            usesCount: 0,
            status: 'active'
          });
          adminSessions.delete(chatId);
          await adminBot?.sendMessage(chatId, `✅ <b>Promo Code <code>${session.data.code}</code> Created Successfully! (+$${(session.data.reward / 100).toFixed(2)})</b>`, { parse_mode: 'HTML' }).catch(() => {});
          await sendPromoCodesAdminMenu(chatId);
          return;
        }
      }
    });

    const handledAdminCallbackQueryIds = new Set<string>();

    adminBot.on('callback_query', async (query) => {
      if (query.id && handledAdminCallbackQueryIds.has(query.id)) return;
      if (query.id) {
        handledAdminCallbackQueryIds.add(query.id);
        if (handledAdminCallbackQueryIds.size > 1000) {
          const firstKey = handledAdminCallbackQueryIds.values().next().value;
          if (firstKey) handledAdminCallbackQueryIds.delete(firstKey);
        }
      }
      await handleAdminCallbackQuery(query);
    });

    // Schedule 24-hour Automated Daily Statement Cron
    setInterval(() => {
      sendDailyStatementToAdmins().catch(() => {});
    }, 24 * 60 * 60 * 1000);

    // Heartbeat every 10 minutes to register server node
    setInterval(() => {
      registerServerHeartbeat().catch(() => {});
    }, 10 * 60 * 1000);

    console.log(`[ADMIN BOT] Multi-Server Admin Controller (${getServerName()}) running with polling!`);
    return adminBot;
  } catch (err) {
    console.error('[ADMIN BOT] Initialization failed:', err);
    return null;
  }
}

export async function handleAdminCallbackQuery(query: TelegramBot.CallbackQuery, overrideBot?: TelegramBot): Promise<boolean> {
  if (!query.message || !query.data) return false;

  const chatId = query.message.chat.id;
  const data = query.data;

  if (!(await isAuthorizedAdmin(chatId))) return false;

  const botToUse = getActiveAdminBot(overrideBot);
  if (!botToUse) return false;

  await botToUse.answerCallbackQuery(query.id).catch(() => {});

  if (data === 'admin_main_menu') {
    adminSessions.delete(String(chatId));
    await sendAdminMenu(chatId, botToUse);
    return true;
  }
  if (data === 'menu_products') {
    await sendProductsAdminMenu(chatId, botToUse);
    return true;
  }
  if (data === 'menu_customers') {
    await sendCustomersAdminMenu(chatId, botToUse);
    return true;
  }
  if (data === 'menu_promocodes') {
    await sendPromoCodesAdminMenu(chatId, botToUse);
    return true;
  }
  if (data === 'menu_settings') {
    await sendSettingsAdminMenu(chatId, botToUse);
    return true;
  }
  if (data === 'admin_manage_chat_ids') {
    const adminIds = await getAuthorizedAdminChatIds();
    const msgText = `👥 <b>AUTHORIZED ADMIN CHAT IDS</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Current Admins (<b>${adminIds.length}</b>):\n` +
      adminIds.map(id => `▪️ <code>${id}</code>`).join('\n') + `\n\n` +
      `To add a new admin, run:\n<code>/addadmin &lt;CHAT_ID&gt;</code>\n\n` +
      `To remove an admin, run:\n<code>/deladmin &lt;CHAT_ID&gt;</code>`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '➕ Add New Admin Chat ID', callback_data: 'prompt_add_admin_id' }],
        [{ text: '⏪ Back to Settings', callback_data: 'menu_settings' }]
      ]
    };
    await botToUse.sendMessage(chatId, msgText, { parse_mode: 'HTML', reply_markup: keyboard }).catch(() => {});
    return true;
  }
  if (data === 'prompt_add_admin_id') {
    adminSessions.set(String(chatId), { step: 'input_add_admin_id' });
    await botToUse.sendMessage(chatId, `👥 <b>Send or Paste Telegram Chat ID</b> to authorize as Admin (e.g. <code>7507799896</code>):`, { parse_mode: 'HTML' }).catch(() => {});
    return true;
  }
  if (data === 'menu_broadcast') {
    await sendBroadcastAdminMenu(chatId, botToUse);
    return true;
  }

  if (data === 'get_statement') {
    const target = selectedServerMap.get(String(chatId)) || getServerName();
    const text = await generate24hDailyStatementText(target);
    await botToUse.sendMessage(chatId, text, { parse_mode: 'HTML' }).catch(() => {});
    return true;
  }

  if (data === 'toggle_status') {
    const currentlyPaused = await isShopBotPaused();
    const nextState = !currentlyPaused;
    await setShopBotPaused(nextState);
    const newLabel = nextState ? '🔴 PAUSED (Maintenance Mode)' : '🟢 ACTIVE (Live)';
    await botToUse.sendMessage(chatId, `🔄 <b>[${getServerName()}] Status changed:</b> ${newLabel}`, { parse_mode: 'HTML' }).catch(() => {});
    await sendAdminMenu(chatId, botToUse);
    return true;
  }

  if (data?.startsWith('prod_')) {
    const prodId = parseInt(data.replace('prod_', ''));
    const [prod] = await db.select().from(products).where(eq(products.id, prodId));
    if (prod) {
      const priceUSD = (prod.price / 100).toFixed(2);
      const emojiTag = prod.customEmojiId ? `<tg-emoji emoji-id="${prod.customEmojiId}">📦</tg-emoji>` : `📦`;
      const text = `${emojiTag} <b>${escapeHTML(prod.name)}</b>\n\n` +
        `<b>Price:</b> $${priceUSD} USD\n` +
        `<b>Stock Available:</b> ${prod.stockCount} pcs\n\n` +
        `<b>Description:</b>\n${escapeHTML(prod.description) || 'Instant 24/7 delivery guaranteed.'}`;

      await botToUse.sendMessage(chatId, text, { parse_mode: 'HTML' }).catch(() => {});
    }
    return true;
  }

  // Add Product Trigger
  if (data === 'admin_add_product') {
    adminSessions.set(String(chatId), { step: 'add_prod_name', data: {} });
    await botToUse.sendMessage(chatId, `📦 <b>Adding New Product</b>\n\nPlease enter the <b>Product Name</b>:`, { parse_mode: 'HTML' }).catch(() => {});
    return true;
  }

  // Add Stock Trigger
  if (data === 'admin_add_stock') {
    const allProds = await db.select().from(products);
    if (allProds.length === 0) {
      await botToUse.sendMessage(chatId, `❌ No products available. Please create a product first.`).catch(() => {});
      return true;
    }
    const buttons = allProds.map(p => ([{
      text: `📦 ${p.name} ($${(p.price / 100).toFixed(2)})`,
      callback_data: `sel_prod_stock_${p.id}`
    }]));
    await botToUse.sendMessage(chatId, `📦 <b>Select a product to add Stock Accounts / Keys:</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } }).catch(() => {});
    return true;
  }

  if (data?.startsWith('sel_prod_stock_')) {
    const prodId = parseInt(data.replace('sel_prod_stock_', ''));
    adminSessions.set(String(chatId), { step: 'add_stock_keys', data: { productId: prodId } });
    await botToUse.sendMessage(chatId, `🔑 <b>Paste Accounts / Digital Keys line-by-line:</b>\n\nEach line will be added as 1 available stock account item.`, { parse_mode: 'HTML' }).catch(() => {});
    return true;
  }

  // Edit Product Custom Emoji Trigger
  if (data === 'admin_edit_emoji') {
    const allProds = await db.select().from(products);
    if (allProds.length === 0) {
      await botToUse.sendMessage(chatId, `❌ No products available. Please create a product first.`, { parse_mode: 'HTML' }).catch(() => {});
      return true;
    }
    const buttons = allProds.map(p => ([{
      text: `✨ ${p.name} ($${(p.price / 100).toFixed(2)})`,
      callback_data: `sel_prod_emoji_${p.id}`
    }]));
    await botToUse.sendMessage(chatId, `✨ <b>Select a Product to set/update its Telegram Premium Custom Emoji:</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } }).catch(() => {});
    return true;
  }

  if (data?.startsWith('sel_prod_emoji_')) {
    const prodId = parseInt(data.replace('sel_prod_emoji_', ''));
    adminSessions.set(String(chatId), { step: 'update_prod_emoji', data: { productId: prodId } });
    const [prod] = await db.select().from(products).where(eq(products.id, prodId));
    await botToUse.sendMessage(chatId, `✨ <b>Send / Paste Premium Custom Emoji for "${escapeHTML(prod?.name || 'Product')}":</b>\n\nSend ANY Telegram Premium Custom Emoji from your emoji picker. The system will automatically capture its Custom Emoji ID and update the product in real-time!`, { parse_mode: 'HTML' }).catch(() => {});
    return true;
  }

  // Credit balance trigger
  if (data === 'admin_credit_balance') {
    adminSessions.set(String(chatId), { step: 'credit_user_search' });
    await botToUse.sendMessage(chatId, `🔍 Send the Customer's <b>Telegram Chat ID</b> or <b>Username</b> (e.g. <code>7507799896</code> or <code>@username</code>):`, { parse_mode: 'HTML' }).catch(() => {});
    return true;
  }

  // Create promo code trigger
  if (data === 'admin_create_promo') {
    adminSessions.set(String(chatId), { step: 'promo_code_name' });
    await botToUse.sendMessage(chatId, `🎟️ Enter New <b>Promo Code</b> (e.g. <code>BONUS5</code>):`, { parse_mode: 'HTML' }).catch(() => {});
    return true;
  }

  // Gateway Toggles
  if (data?.startsWith('toggle_gateway_')) {
    const gw = data.replace('toggle_gateway_', '').toUpperCase();
    const key = `PAYMENT_${gw}_ENABLED`;
    const curr = (await storage.getSetting(key))?.value !== 'false';
    await storage.setSetting(key, curr ? 'false' : 'true');
    await botToUse.sendMessage(chatId, `🔄 <b>Gateway ${gw} status updated:</b> ${!curr ? '🟢 Enabled' : '🔴 Disabled'}`, { parse_mode: 'HTML' }).catch(() => {});
    await sendSettingsAdminMenu(chatId, botToUse);
    return true;
  }

  // Broadcast Flow Triggers
  if (data === 'admin_start_broadcast') {
    await setAdminSession(String(chatId), { step: 'broadcast_text', data: {} });
    await botToUse.editMessageText(`📢 <b>NEW MASS BROADCAST</b>\n\nPlease enter or send the Broadcast Message (text or photo caption with Premium Emojis & HTML supported):`, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'HTML'
    }).catch(async () => {
      await botToUse.sendMessage(chatId, `📢 <b>NEW MASS BROADCAST</b>\n\nPlease enter or send the Broadcast Message (text or photo caption with Premium Emojis & HTML supported):`, { parse_mode: 'HTML' }).catch(() => {});
    });
    return true;
  }

  if (data === 'bcast_attach_product') {
    const allProds = await db.select().from(products);
    if (allProds.length === 0) {
      await botToUse.sendMessage(chatId, `❌ No products found in store. Please create a product first.`, { parse_mode: 'HTML' }).catch(() => {});
      return true;
    }
    const buttons = allProds.map(p => ([{
      text: `📦 ${p.name} ($${(p.price / 100).toFixed(2)})`,
      callback_data: `bcast_sel_prod_${p.id}`
    }]));
    await botToUse.sendMessage(chatId, `🛒 <b>Select Product to attach as "Buy Now" button:</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } }).catch(() => {});
    return true;
  }

  if (data?.startsWith('bcast_sel_prod_')) {
    const prodId = parseInt(data.replace('bcast_sel_prod_', ''));
    const session = await getAdminSession(String(chatId));
    const sessionData = { ...(session?.data || {}), targetProductId: prodId };
    await setAdminSession(String(chatId), { ...session, data: sessionData });

    const [prod] = await db.select().from(products).where(eq(products.id, prodId));
    const prodName = prod ? prod.name : `Product #${prodId}`;
    const priceUSD = prod ? (prod.price / 100).toFixed(2) : '0.00';

    const keyboard = {
      inline_keyboard: [
        [{ text: '⚡ CONFIRM & SEND BROADCAST', callback_data: 'bcast_confirm_send' }],
        [{ text: '❌ Cancel Broadcast', callback_data: 'admin_main_menu' }]
      ]
    };

    await botToUse.sendMessage(chatId, `✅ <b>Product Attached:</b> ${escapeHTML(prodName)} ($${priceUSD})\n\n📢 <b>BROADCAST PREVIEW READY</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n${sessionData?.messageText || ''}\n\n<b>Attached Button:</b> [ 🟢 Buy Now ]`, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    }).catch(() => {});
    return true;
  }

  if (data === 'bcast_attach_url') {
    const session = await getAdminSession(String(chatId));
    await setAdminSession(String(chatId), { step: 'broadcast_url_btn_text', data: session?.data || {} });
    await botToUse.sendMessage(chatId, `📝 Enter Button Label Text (e.g. <code>Join Channel</code>):`, { parse_mode: 'HTML' }).catch(() => {});
    return true;
  }

  // CONFIRM AND EXECUTE BROADCAST
  if (data === 'bcast_confirm_send') {
    const session = await getAdminSession(String(chatId));
    if (!session || !session.data || (!session.data.messageText && !session.data.photoFileId && !session.data.photoBuffer)) {
      await botToUse.sendMessage(chatId, `❌ No broadcast content found. Please restart broadcast creation.`).catch(() => {});
      return true;
    }

    const bText = session.data.messageText || '';
    const photoFileId = session.data.photoFileId as string | undefined;
    const photoBuffer = session.data.photoBuffer as Buffer | undefined;
    const photoToSend = photoFileId || photoBuffer;

    const targetProdId = session.data.targetProductId;
    const customBtnText = session.data.customButtonText;
    const customBtnUrl = session.data.customButtonUrl;

    const targetSenderBot = mainBotReference || botToUse || adminBot;
    if (!targetSenderBot) {
      await botToUse.sendMessage(chatId, `❌ Bot instance not ready.`).catch(() => {});
      return true;
    }

    const allUsers = await db.select().from(telegramUsers);
    const totalUsers = allUsers.length;

    if (totalUsers === 0) {
      await botToUse.sendMessage(chatId, `⚠️ No registered customers found in database to send broadcast.`).catch(() => {});
      return true;
    }

    const startTime = Date.now();
    const statusMsg = await botToUse.sendMessage(chatId, 
      `⏳ <b>MASS BROADCAST IN PROGRESS</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🤖 <b>Sender Bot:</b> Main Shop Bot\n` +
      `👥 <b>Total Target Users:</b> <b>${totalUsers}</b>\n` +
      `📊 <b>Progress:</b> 0 / ${totalUsers} (0%)\n` +
      `✅ <b>Delivered:</b> 0\n` +
      `❌ <b>Failed/Blocked:</b> 0\n` +
      `⏱️ <b>Status:</b> Initializing batch delivery...`, 
      { parse_mode: 'HTML' }
    ).catch(() => null);

    const sentMessages: { chatId: string; messageId: number }[] = [];
    let successCount = 0;
    let failedCount = 0;
    let mainBotPhotoFileId: string | undefined = photoFileId;

    const inlineKeyboard: any[][] = [];
    if (targetProdId) {
      inlineKeyboard.push([{
        text: 'Buy Now',
        callback_data: `prod_${targetProdId}`,
        style: 'success',
        icon_custom_emoji_id: '5361781191722699867'
      }]);
    } else if (customBtnText && customBtnUrl) {
      inlineKeyboard.push([{ text: customBtnText, url: customBtnUrl }]);
    }

    const replyMarkup = inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined;

    const BATCH_SIZE = 20;
    let lastProgressUpdate = Date.now();

    for (let i = 0; i < totalUsers; i += BATCH_SIZE) {
      const batch = allUsers.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (user) => {
        let sentMsg = null;
        let retries = 0;

        while (retries < 2) {
          try {
            if (photoToSend) {
              const currentPhoto = mainBotPhotoFileId || photoToSend;
              sentMsg = await targetSenderBot.sendPhoto(user.telegramId, currentPhoto, {
                caption: bText,
                parse_mode: 'HTML',
                reply_markup: replyMarkup
              });
              if (sentMsg && sentMsg.photo && sentMsg.photo.length > 0 && !mainBotPhotoFileId) {
                mainBotPhotoFileId = sentMsg.photo[sentMsg.photo.length - 1].file_id;
              }
            } else {
              sentMsg = await targetSenderBot.sendMessage(user.telegramId, bText, {
                parse_mode: 'HTML',
                reply_markup: replyMarkup
              });
            }
            break;
          } catch (err: any) {
            const errMsg = err?.message || '';
            if (errMsg.includes('429 Too Many Requests') || err?.code === 'ETELEGRAM') {
              const retryAfterMatch = errMsg.match(/retry after (\d+)/i);
              const retrySec = retryAfterMatch ? parseInt(retryAfterMatch[1], 10) : 2;
              await new Promise(r => setTimeout(r, (retrySec + 1) * 1000));
              retries++;
            } else {
              break;
            }
          }
        }

        if (sentMsg) {
          sentMessages.push({ chatId: String(user.telegramId), messageId: sentMsg.message_id });
          successCount++;
        } else {
          failedCount++;
        }
      }));

      const processedCount = Math.min(i + BATCH_SIZE, totalUsers);
      const now = Date.now();
      if (statusMsg && (now - lastProgressUpdate > 2000 || processedCount === totalUsers)) {
        lastProgressUpdate = now;
        const pct = Math.round((processedCount / totalUsers) * 100);
        const elapsedSec = Math.round((now - startTime) / 1000);
        const updateText = 
          `⏳ <b>MASS BROADCAST IN PROGRESS</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🤖 <b>Sender Bot:</b> Main Shop Bot\n` +
          `👥 <b>Total Target Users:</b> <b>${totalUsers}</b>\n` +
          `📊 <b>Progress:</b> <b>${processedCount} / ${totalUsers}</b> (${pct}%)\n` +
          `✅ <b>Delivered:</b> <b>${successCount}</b>\n` +
          `❌ <b>Failed/Blocked:</b> <b>${failedCount}</b>\n` +
          `⏱️ <b>Elapsed Time:</b> <b>${elapsedSec}s</b>`;

        await botToUse.editMessageText(updateText, {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'HTML'
        }).catch(() => {});
      }

      if (i + BATCH_SIZE < totalUsers) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    const durationSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const avgSpeed = (successCount / durationSec).toFixed(1);

    const [bLog] = await db.insert(broadcastLogs).values({
      adminChatId: String(chatId),
      broadcastType: photoToSend ? 'photo' : 'text',
      messageText: bText,
      photoUrl: photoToSend ? (typeof photoToSend === 'string' ? photoToSend : 'photo_buffer') : null,
      targetProductId: targetProdId || null,
      customButtonText: customBtnText || null,
      customButtonUrl: customBtnUrl || null,
      recipientCount: successCount,
      sentMessagesJson: JSON.stringify(sentMessages)
    }).returning();

    await clearAdminSession(String(chatId));

    const summaryMsg = 
      `🎉 <b>MASS BROADCAST COMPLETED!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🆔 <b>Campaign Log ID:</b> <code>#${bLog.id}</code>\n` +
      `🤖 <b>Sender Bot:</b> Main Shop Bot\n` +
      `👥 <b>Total Target Users:</b> <b>${totalUsers}</b>\n` +
      `✅ <b>Successfully Delivered:</b> <b>${successCount}</b>\n` +
      `❌ <b>Failed / Blocked Bot:</b> <b>${failedCount}</b>\n` +
      `⏱️ <b>Total Time Elapsed:</b> <b>${durationSec} seconds</b>\n` +
      `⚡ <b>Delivery Speed:</b> <b>~${avgSpeed} msgs/sec</b>\n\n` +
      `<i>You can recall/delete this broadcast anytime from the Mass Broadcast menu.</i>`;

    await botToUse.sendMessage(chatId, summaryMsg, { parse_mode: 'HTML' }).catch(() => {});
    await sendBroadcastAdminMenu(chatId, botToUse);
    return true;
  }

  // RECALL / DELETE SENT BROADCAST
  if (data === 'admin_recall_broadcast') {
    const pastLogs = await db.select().from(broadcastLogs).orderBy(desc(broadcastLogs.createdAt)).limit(10);
    if (pastLogs.length === 0) {
      await botToUse.sendMessage(chatId, `❌ No active broadcast campaigns found to recall.`).catch(() => {});
      return true;
    }
    const buttons = pastLogs.map(l => ([{
      text: `🗑️ Delete Broadcast #${l.id} (${l.recipientCount} users)`,
      callback_data: `exec_recall_${l.id}`
    }]));
    await botToUse.sendMessage(chatId, `🗑️ <b>Select a Broadcast Campaign to RECALL & DELETE from all users:</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } }).catch(() => {});
    return true;
  }

  if (data?.startsWith('exec_recall_')) {
    const logId = parseInt(data.replace('exec_recall_', ''));
    const [log] = await db.select().from(broadcastLogs).where(eq(broadcastLogs.id, logId));

    if (!log || !log.sentMessagesJson) {
      await botToUse.sendMessage(chatId, `❌ Broadcast log #${logId} not found or has no record.`).catch(() => {});
      return true;
    }

    await botToUse.sendMessage(chatId, `⏳ <b>Recalling and deleting Broadcast #${logId} from ALL recipient chats...</b>`, { parse_mode: 'HTML' }).catch(() => {});

    const sentMessages: { chatId: string; messageId: number }[] = JSON.parse(log.sentMessagesJson);
    let deletedCount = 0;

    const targetSenderBot = mainBotReference || botToUse || adminBot;

    for (const item of sentMessages) {
      try {
        await targetSenderBot?.deleteMessage(item.chatId, item.messageId);
        deletedCount++;
      } catch (e) {}
    }

    await db.delete(broadcastLogs).where(eq(broadcastLogs.id, logId));

    await botToUse.sendMessage(chatId, `🗑️ <b>BROADCAST RECALL COMPLETED!</b>\n━━━━━━━━━━━━━━━━━━━━━\nSuccessfully deleted <b>${deletedCount} / ${sentMessages.length}</b> broadcast messages across all Telegram chats.`, { parse_mode: 'HTML' }).catch(() => {});
    await sendBroadcastAdminMenu(chatId, botToUse);
    return true;
  }

  return false;
}

export async function handleAdminMessage(msg: TelegramBot.Message, overrideBot?: TelegramBot): Promise<boolean> {
  const chatId = String(msg.chat.id);
  const botToUse = getActiveAdminBot(overrideBot);
  if (!botToUse) return false;

  const text = (msg.text || msg.caption || '').trim();

  // Command to get Telegram Chat ID
  if (text === '/id' || text === '/myid') {
    await botToUse.sendMessage(chatId, `🆔 <b>Your Telegram Chat ID:</b> <code>${chatId}</code>`, { parse_mode: 'HTML' }).catch(() => {});
    return true;
  }

  const isAdmin = await isAuthorizedAdmin(chatId);

  // Admin Management Commands
  if (text.startsWith('/addadmin')) {
    if (!isAdmin) {
      await botToUse.sendMessage(chatId, `🔒 <b>Access Denied.</b> Your Chat ID <code>${chatId}</code> is not authorized as Admin.`, { parse_mode: 'HTML' }).catch(() => {});
      return true;
    }
    const parts = text.split(/\s+/);
    const newId = parts[1]?.trim();
    if (!newId || !/^\d+$/.test(newId)) {
      await botToUse.sendMessage(chatId, `❌ Usage: <code>/addadmin &lt;CHAT_ID&gt;</code>\nExample: <code>/addadmin 7507799896</code>`, { parse_mode: 'HTML' }).catch(() => {});
      return true;
    }
    const updated = await addAdminChatId(newId);
    await botToUse.sendMessage(chatId, `✅ <b>Added Admin Chat ID:</b> <code>${newId}</code>\nTotal Authorized Admins: <b>${updated.length}</b>`, { parse_mode: 'HTML' }).catch(() => {});
    return true;
  }

  if (text.startsWith('/deladmin') || text.startsWith('/removeadmin')) {
    if (!isAdmin) {
      await botToUse.sendMessage(chatId, `🔒 <b>Access Denied.</b>`, { parse_mode: 'HTML' }).catch(() => {});
      return true;
    }
    const parts = text.split(/\s+/);
    const idToRemove = parts[1]?.trim();
    if (!idToRemove) {
      await botToUse.sendMessage(chatId, `❌ Usage: <code>/deladmin &lt;CHAT_ID&gt;</code>`, { parse_mode: 'HTML' }).catch(() => {});
      return true;
    }
    const updated = await removeAdminChatId(idToRemove);
    await botToUse.sendMessage(chatId, `✅ <b>Removed Admin Chat ID:</b> <code>${idToRemove}</code>\nTotal Authorized Admins: <b>${updated.length}</b>`, { parse_mode: 'HTML' }).catch(() => {});
    return true;
  }

  if (text === '/listadmins') {
    if (!isAdmin) return false;
    const admins = await getAuthorizedAdminChatIds();
    await botToUse.sendMessage(chatId, `👥 <b>Authorized Admin Chat IDs (${admins.length}):</b>\n\n` + admins.map(id => `▪️ <code>${id}</code>`).join('\n'), { parse_mode: 'HTML' }).catch(() => {});
    return true;
  }

  // If user is NOT an admin:
  if (!isAdmin) {
    if (text.startsWith('/admin') || text.startsWith('/broadcast') || text.startsWith('/massbroadcast')) {
      await botToUse.sendMessage(chatId, 
        `🔒 <b>Access Denied</b>\n\n` +
        `Your Telegram Chat ID <code>${chatId}</code> is not authorized for Admin Panel.\n\n` +
        `To authorize, ask an existing admin to run <code>/addadmin ${chatId}</code> or add <code>${chatId}</code> to environment variable <code>ADMIN_CHAT_ID</code>.`, 
        { parse_mode: 'HTML' }
      ).catch(() => {});
      return true;
    }
    return false; // Pass through to regular user shop handlers!
  }

  // If user IS an authorized admin:
  if (text.startsWith('/broadcast') || text.startsWith('/massbroadcast')) {
    adminSessions.delete(chatId);
    await sendBroadcastAdminMenu(chatId, botToUse);
    return true;
  }

  if (text.startsWith('/admin')) {
    adminSessions.delete(chatId);
    await sendAdminMenu(chatId, botToUse);
    return true;
  }

  if (text.startsWith('/start')) {
    if (isDedicatedAdminBot(botToUse)) {
      adminSessions.delete(chatId);
      await sendAdminMenu(chatId, botToUse);
      return true;
    }
    return false; // In main shop bot, let /start show regular customer welcome banner
  }

  if (text.includes('Products & Stock')) {
    adminSessions.delete(chatId);
    await sendProductsAdminMenu(chatId, botToUse);
    return true;
  }
  if (text.includes('Customer Accounts')) {
    adminSessions.delete(chatId);
    await sendCustomersAdminMenu(chatId, botToUse);
    return true;
  }
  if (text.includes('Mass Broadcast') || text.toLowerCase().includes('broadcast') || text.includes('📢 Broadcast') || text.includes('📢 Mass Broadcast')) {
    adminSessions.delete(chatId);
    await sendBroadcastAdminMenu(chatId, botToUse);
    return true;
  }
  if (text.includes('Promo Codes')) {
    adminSessions.delete(chatId);
    await sendPromoCodesAdminMenu(chatId, botToUse);
    return true;
  }
  if (text.includes('Settings & Gateways')) {
    adminSessions.delete(chatId);
    await sendSettingsAdminMenu(chatId, botToUse);
    return true;
  }
  if (text.includes('Daily Reports')) {
    adminSessions.delete(chatId);
    const report = await generate24hDailyStatementText();
    await botToUse.sendMessage(chatId, report, { parse_mode: 'HTML' }).catch(() => {});
    return true;
  }

  // Handle active step inputs
  const session = adminSessions.get(chatId);
  if (session && session.step) {
    if (session.step === 'input_add_admin_id') {
      const newId = text.trim();
      if (!/^\d+$/.test(newId)) {
        await botToUse.sendMessage(chatId, `❌ Invalid Chat ID. Enter numeric Telegram Chat ID (e.g. <code>7507799896</code>):`, { parse_mode: 'HTML' }).catch(() => {});
        return true;
      }
      const updated = await addAdminChatId(newId);
      adminSessions.delete(chatId);
      await botToUse.sendMessage(chatId, `✅ <b>Successfully Authorized Chat ID ${newId} as Admin!</b>\nTotal Authorized Admins: <b>${updated.length}</b>`, { parse_mode: 'HTML' }).catch(() => {});
      await sendSettingsAdminMenu(chatId, botToUse);
      return true;
    }
    if (session.step === 'add_prod_name') {
      session.data = { name: text };
      session.step = 'add_prod_price';
      await botToUse.sendMessage(chatId, `💰 Enter Product Price in USD (e.g. <code>5.00</code>):`, { parse_mode: 'HTML' }).catch(() => {});
      return true;
    }
    if (session.step === 'add_prod_price') {
      const price = parseFloat(text);
      if (isNaN(price) || price <= 0) {
        await botToUse.sendMessage(chatId, `❌ Invalid price. Enter numeric amount in USD (e.g. 5.00):`).catch(() => {});
        return true;
      }
      session.data.price = Math.round(price * 100);
      session.step = 'add_prod_category';
      await botToUse.sendMessage(chatId, `📁 Enter Category Name (e.g. <code>VPN</code>, <code>Streaming</code>, <code>Accounts</code>):`, { parse_mode: 'HTML' }).catch(() => {});
      return true;
    }
    if (session.step === 'add_prod_category') {
      session.data.category = text;
      session.step = 'add_prod_desc';
      await botToUse.sendMessage(chatId, `📝 Enter Product Description:`, { parse_mode: 'HTML' }).catch(() => {});
      return true;
    }
    if (session.step === 'add_prod_desc') {
      session.data.description = text;
      session.step = 'add_prod_emoji';
      await botToUse.sendMessage(chatId, `✨ <b>Select / Send Premium Custom Emoji for "${escapeHTML(session.data.name)}":</b>\n\nSend or paste ANY Telegram Premium Custom Emoji from your emoji picker. The system will automatically capture its Custom Emoji ID and assign it to this product!\n\n<i>Or type <code>skip</code> to use default product icon.</i>`, { parse_mode: 'HTML' }).catch(() => {});
      return true;
    }

    if (session.step === 'add_prod_emoji') {
      let customEmojiId: string | null = null;
      const entities = msg.caption_entities || msg.entities;

      if (entities && entities.length > 0) {
        const customEmojiEntity = entities.find(e => e.type === 'custom_emoji' && e.custom_emoji_id);
        if (customEmojiEntity && customEmojiEntity.custom_emoji_id) {
          customEmojiId = customEmojiEntity.custom_emoji_id;
        }
      }

      const [newProd] = await db.insert(products).values({
        name: session.data.name,
        price: session.data.price,
        type: session.data.category || 'General',
        category: session.data.category || 'General',
        description: session.data.description,
        customEmojiId: customEmojiId || null,
        stockCount: 0
      }).returning();

      adminSessions.delete(chatId);
      const emojiTag = customEmojiId ? `<tg-emoji emoji-id="${customEmojiId}">✨</tg-emoji>` : `📦`;
      await botToUse.sendMessage(chatId, `${emojiTag} <b>Product Created Successfully!</b>\n\n<b>ID:</b> ${newProd.id}\n<b>Name:</b> ${escapeHTML(newProd.name)}\n<b>Price:</b> $${(newProd.price / 100).toFixed(2)}\n<b>Category:</b> ${escapeHTML(newProd.category || 'General')}\n<b>Custom Emoji ID:</b> <code>${customEmojiId || 'Default'}</code>`, { parse_mode: 'HTML' }).catch(() => {});
      await sendProductsAdminMenu(chatId, botToUse);
      return true;
    }

    if (session.step === 'update_prod_emoji') {
      const productId = session.data.productId;
      let customEmojiId: string | null = null;
      const entities = msg.caption_entities || msg.entities;

      if (entities && entities.length > 0) {
        const customEmojiEntity = entities.find(e => e.type === 'custom_emoji' && e.custom_emoji_id);
        if (customEmojiEntity && customEmojiEntity.custom_emoji_id) {
          customEmojiId = customEmojiEntity.custom_emoji_id;
        }
      }

      if (!customEmojiId) {
        await botToUse.sendMessage(chatId, `⚠️ <b>No Premium Custom Emoji detected in your message!</b>\n\nPlease send or paste a Telegram Premium Custom Emoji from your emoji picker to link it to this product.`, { parse_mode: 'HTML' }).catch(() => {});
        return true;
      }

      await db.update(products).set({ customEmojiId }).where(eq(products.id, productId));
      adminSessions.delete(chatId);

      await botToUse.sendMessage(chatId, `<tg-emoji emoji-id="${customEmojiId}">✨</tg-emoji> <b>Product Premium Custom Emoji Updated!</b>\n\nCustom Emoji ID <code>${customEmojiId}</code> has been captured and linked to Product ID #${productId} across the system!`, { parse_mode: 'HTML' }).catch(() => {});
      await sendProductsAdminMenu(chatId, botToUse);
      return true;
    }

    if (session.step === 'add_stock_keys') {
      const productId = session.data.productId;
      const keys = text.split('\n').map(k => k.trim()).filter(k => k.length > 0);
      if (keys.length === 0) {
        await botToUse.sendMessage(chatId, `❌ No valid stock keys provided. Please paste stock credentials line-by-line.`).catch(() => {});
        return true;
      }
      const { stockAccounts } = await import('@shared/schema');
      let added = 0;
      for (const key of keys) {
        await db.insert(stockAccounts).values({
          productId,
          credentials: key,
          status: 'available'
        });
        added++;
      }
      await db.execute(sql`UPDATE products SET stock_count = stock_count + ${added} WHERE id = ${productId}`);
      adminSessions.delete(chatId);
      await botToUse.sendMessage(chatId, `✅ <b>Successfully added ${added} stock accounts/keys to Product ID ${productId}!</b>`, { parse_mode: 'HTML' }).catch(() => {});
      await sendProductsAdminMenu(chatId, botToUse);
      return true;
    }

    if (session.step === 'credit_user_search') {
      session.data = { target: text };
      session.step = 'credit_user_amount';
      await botToUse.sendMessage(chatId, `💵 Enter amount to <b>CREDIT (+)</b> in USD (e.g. <code>10.00</code>):`, { parse_mode: 'HTML' }).catch(() => {});
      return true;
    }
    if (session.step === 'credit_user_amount') {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        await botToUse.sendMessage(chatId, `❌ Invalid amount. Enter numeric USD amount:`).catch(() => {});
        return true;
      }
      const target = session.data.target;
      const [user] = await db.select().from(telegramUsers).where(or(eq(telegramUsers.telegramId, target), eq(telegramUsers.username, target.replace('@', ''))));
      if (!user) {
        await botToUse.sendMessage(chatId, `❌ Customer user not found for ID/username: <code>${target}</code>`, { parse_mode: 'HTML' }).catch(() => {});
        adminSessions.delete(chatId);
        return true;
      }
      const creditCents = Math.round(amount * 100);
      await db.execute(sql`UPDATE telegram_users SET balance = balance + ${creditCents} WHERE id = ${user.id}`);
      adminSessions.delete(chatId);
      await botToUse.sendMessage(chatId, `✅ <b>Credited +$${amount.toFixed(2)} USD to User ${user.firstName || user.username || user.telegramId}!</b>`, { parse_mode: 'HTML' }).catch(() => {});
      await sendCustomersAdminMenu(chatId, botToUse);
      return true;
    }

    if (session.step === 'broadcast_text') {
      const rawText = msg.caption || msg.text || '';
      const entities = msg.caption_entities || msg.entities;
      const formattedHTML = entitiesToHTML(rawText, entities);

      let photoFileId: string | undefined = undefined;
      if (msg.photo && msg.photo.length > 0) {
        photoFileId = msg.photo[msg.photo.length - 1].file_id;
      }

      const sessionData = {
        ...(session.data || {}),
        messageText: formattedHTML,
        photoFileId: photoFileId
      };

      await setAdminSession(chatId, { step: 'broadcast_button_choice', data: sessionData });

      const keyboard = {
        inline_keyboard: [
          [{ text: '🛒 Attach Buy Now Product Button', callback_data: 'bcast_attach_product' }],
          [{ text: '🔗 Attach Custom URL Button', callback_data: 'bcast_attach_url' }],
          [{ text: '⚡ Send Broadcast (No Extra Buttons)', callback_data: 'bcast_confirm_send' }]
        ]
      };
      await botToUse.sendMessage(chatId, `📝 <b>Broadcast Content Recorded (${photoFileId ? 'Photo &' : ''} Text with Premium Emojis)!</b>\n\nWould you like to attach an interactive button to this broadcast?`, { parse_mode: 'HTML', reply_markup: keyboard }).catch(() => {});
      return true;
    }

    if (session.step === 'broadcast_url_btn_text') {
      const sessionData = { ...(session.data || {}), customButtonText: text };
      await setAdminSession(chatId, { step: 'broadcast_url_btn_url', data: sessionData });
      await botToUse.sendMessage(chatId, `🔗 Enter the Destination URL for the button (e.g. <code>https://t.me/...</code>):`, { parse_mode: 'HTML' }).catch(() => {});
      return true;
    }

    if (session.step === 'broadcast_url_btn_url') {
      const sessionData = { ...(session.data || {}), customButtonUrl: text };
      await setAdminSession(chatId, { step: 'broadcast_confirm', data: sessionData });

      const keyboard = {
        inline_keyboard: [
          [{ text: '⚡ CONFIRM & SEND BROADCAST', callback_data: 'bcast_confirm_send' }],
          [{ text: '❌ Cancel Broadcast', callback_data: 'admin_main_menu' }]
        ]
      };

      await botToUse.sendMessage(chatId, `📢 <b>BROADCAST PREVIEW READY</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n${sessionData.messageText || ''}\n\n<b>Button:</b> [ ${sessionData.customButtonText} ] -> ${sessionData.customButtonUrl}`, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      }).catch(() => {});
      return true;
    }
  }

  return false;
}
