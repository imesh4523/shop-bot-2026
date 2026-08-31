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

let inMemoryPausedState = false;
let inMemoryAdminChatIds = new Set<string>(HARDCODED_ADMIN_CHAT_IDS);
let inMemoryBotTokens = new Set<string>([HARDCODED_ADMIN_BOT_TOKEN]);
let selectedServerMap: Map<string, string> = new Map();

export function setMainBotReferenceForAdmin(bot: TelegramBot) {
  mainBotReference = bot;
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
  const authorized = await getAuthorizedAdminChatIds();
  return authorized.includes(String(chatId));
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
  inMemoryAdminChatIds.add(newChatId);
  const current = await getAuthorizedAdminChatIds();
  if (!current.includes(newChatId)) {
    current.push(newChatId);
    try {
      await storage.setSetting('ADMIN_CHAT_IDS', current.join(','));
    } catch (err) {
      console.error('[ADMIN BOT] DB setting error:', err);
    }
  }
  return current;
}

// PERSISTENT ADMIN REPLY KEYBOARD (Always Available with 100% Premium Emoji IDs)
export function getAdminReplyKeyboard() {
  return {
    keyboard: [
      [
        { text: 'Products & Stock', icon_custom_emoji_id: '5465416081105492147' },
        { text: 'Customer Accounts', icon_custom_emoji_id: '5260399854500191689' }
      ],
      [
        { text: 'Mass Broadcast', icon_custom_emoji_id: '5334982154868783692' },
        { text: 'Promo Codes', icon_custom_emoji_id: '5814427657609153890' }
      ],
      [
        { text: 'Settings & Gateways', icon_custom_emoji_id: '6235482598924095547' },
        { text: 'Daily Reports', icon_custom_emoji_id: '5377620962390857342' }
      ]
    ] as any,
    resize_keyboard: true,
    persistent: true
  };
}

export async function sendAdminMenu(chatId: string | number) {
  if (!adminBot) return;

  const isPaused = await isShopBotPaused();
  const statusLabel = isPaused ? 'Status: PAUSED (Maintenance Mode)' : 'Status: ACTIVE (Live)';
  const adminIds = await getAuthorizedAdminChatIds();
  const currentServer = selectedServerMap.get(String(chatId)) || getServerName();

  const text = `<tg-emoji emoji-id="5465416081105492147">⚡</tg-emoji> <b>FULL A-Z ADMIN CONTROL PANEL</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<tg-emoji emoji-id="5377620962390857342">🌐</tg-emoji> <b>Server Node:</b> <code>${currentServer}</code>\n` +
    `<tg-emoji emoji-id="6235482598924095547">🤖</tg-emoji> <b>Shop Bot Status:</b> ${isPaused ? '<tg-emoji emoji-id="6298544405435387645">🔴</tg-emoji> PAUSED' : '<tg-emoji emoji-id="5404617696589390973">🟢</tg-emoji> ACTIVE'}\n` +
    `<tg-emoji emoji-id="5260399854500191689">👥</tg-emoji> <b>Authorized Admins:</b> ${adminIds.length}\n\n` +
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

  await adminBot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: getAdminReplyKeyboard()
  }).catch(err => console.error('[ADMIN BOT] sendMessage error:', err?.message || err));

  await adminBot.sendMessage(chatId, `<tg-emoji emoji-id="5370919202796348364">👇</tg-emoji> <b>Control Dashboard Quick Actions:</b>`, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  }).catch(err => console.error('[ADMIN BOT] sendMessage error:', err?.message || err));
}

// ----------------------------------------------------
// 1. PRODUCTS & STOCK MANAGEMENT SUB-MENU
// ----------------------------------------------------
export async function sendProductsAdminMenu(chatId: string | number) {
  if (!adminBot) return;
  const allProducts = await db.select().from(products);

  let msg = `<tg-emoji emoji-id="5465416081105492147">📦</tg-emoji> <b>PRODUCTS & STOCK MANAGEMENT</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Total Products: <b>${allProducts.length}</b>\n\n`;

  for (const p of allProducts.slice(0, 15)) {
    const priceUSD = (p.price / 100).toFixed(2);
    msg += `<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> <b>ID ${p.id}:</b> ${p.name} — <b>$${priceUSD}</b> (${p.category || 'General'})\n`;
  }
  if (allProducts.length > 15) {
    msg += `\n<i>...and ${allProducts.length - 15} more products.</i>\n`;
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ Add New Product', callback_data: 'admin_add_product' }],
      [{ text: '🔑 Add Stock / Accounts', callback_data: 'admin_add_stock' }],
      [{ text: '✏️ Edit Product Price', callback_data: 'admin_edit_price' }],
      [{ text: '🗑️ Delete Product', callback_data: 'admin_delete_product' }],
      [{ text: '⏪ Back to Main Admin Menu', callback_data: 'admin_main_menu' }]
    ]
  };

  await adminBot.sendMessage(chatId, msg, { parse_mode: 'HTML', reply_markup: keyboard }).catch(err => console.error('[ADMIN BOT] sendMessage error:', err?.message || err));
}

// ----------------------------------------------------
// 2. CUSTOMER ACCOUNTS SUB-MENU
// ----------------------------------------------------
export async function sendCustomersAdminMenu(chatId: string | number) {
  if (!adminBot) return;
  const usersCount = (await db.select().from(telegramUsers)).length;

  const msg = `<tg-emoji emoji-id="5260399854500191689">👥</tg-emoji> <b>CUSTOMER ACCOUNTS MANAGEMENT</b>\n` +
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

  await adminBot.sendMessage(chatId, msg, { parse_mode: 'HTML', reply_markup: keyboard }).catch(err => console.error('[ADMIN BOT] sendMessage error:', err?.message || err));
}

// ----------------------------------------------------
// 3. PROMO CODES SUB-MENU
// ----------------------------------------------------
export async function sendPromoCodesAdminMenu(chatId: string | number) {
  if (!adminBot) return;
  const codes = await db.select().from(promoCodes);

  let msg = `<tg-emoji emoji-id="5814427657609153890">🎟️</tg-emoji> <b>PROMO CODES & DISCOUNTS</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Total Active Codes: <b>${codes.length}</b>\n\n`;

  for (const c of codes) {
    const rewardUSD = (c.reward / 100).toFixed(2);
    msg += `<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> <code>${c.code}</code>: <b>+$${rewardUSD}</b> (${c.usesCount}/${c.maxUses} used) [${c.status}]\n`;
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

  await adminBot.sendMessage(chatId, msg, { parse_mode: 'HTML', reply_markup: keyboard }).catch(err => console.error('[ADMIN BOT] sendMessage error:', err?.message || err));
}

// ----------------------------------------------------
// 4. SETTINGS & GATEWAYS SUB-MENU
// ----------------------------------------------------
export async function sendSettingsAdminMenu(chatId: string | number) {
  if (!adminBot) return;

  const bep20On = (await storage.getSetting('PAYMENT_BEP20_ENABLED'))?.value !== 'false';
  const trc20On = (await storage.getSetting('PAYMENT_TRC20_ENABLED'))?.value !== 'false';
  const binanceOn = (await storage.getSetting('PAYMENT_BINANCE_ENABLED'))?.value !== 'false';
  const cryptomusOn = (await storage.getSetting('PAYMENT_CRYPTOMUS_ENABLED'))?.value !== 'false';

  const msg = `<tg-emoji emoji-id="6235482598924095547">⚙️</tg-emoji> <b>SETTINGS & PAYMENT GATEWAYS</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> BEP20 USDT: <b>${bep20On ? '<tg-emoji emoji-id="5404617696589390973">🟢</tg-emoji> Enabled' : '<tg-emoji emoji-id="6298544405435387645">🔴</tg-emoji> Disabled'}</b>\n` +
    `<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> TRC20 USDT: <b>${trc20On ? '<tg-emoji emoji-id="5404617696589390973">🟢</tg-emoji> Enabled' : '<tg-emoji emoji-id="6298544405435387645">🔴</tg-emoji> Disabled'}</b>\n` +
    `<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> Binance Pay: <b>${binanceOn ? '<tg-emoji emoji-id="5404617696589390973">🟢</tg-emoji> Enabled' : '<tg-emoji emoji-id="6298544405435387645">🔴</tg-emoji> Disabled'}</b>\n` +
    `<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> Cryptomus: <b>${cryptomusOn ? '<tg-emoji emoji-id="5404617696589390973">🟢</tg-emoji> Enabled' : '<tg-emoji emoji-id="6298544405435387645">🔴</tg-emoji> Disabled'}</b>\n`;

  const keyboard = {
    inline_keyboard: [
      [{ text: `BEP20: ${bep20On ? 'Disable' : 'Enable'}`, callback_data: 'toggle_gateway_bep20' }, { text: `TRC20: ${trc20On ? 'Disable' : 'Enable'}`, callback_data: 'toggle_gateway_trc20' }],
      [{ text: `Binance: ${binanceOn ? 'Disable' : 'Enable'}`, callback_data: 'toggle_gateway_binance' }, { text: `Cryptomus: ${cryptomusOn ? 'Disable' : 'Enable'}`, callback_data: 'toggle_gateway_cryptomus' }],
      [{ text: '✏️ Update Wallet Address / Pay ID', callback_data: 'admin_edit_wallet_settings' }],
      [{ text: '🔑 Change Admin Bot Token', callback_data: 'prompt_add_bot_token' }],
      [{ text: '⏪ Back to Main Admin Menu', callback_data: 'admin_main_menu' }]
    ]
  };

  await adminBot.sendMessage(chatId, msg, { parse_mode: 'HTML', reply_markup: keyboard }).catch(err => console.error('[ADMIN BOT] sendMessage error:', err?.message || err));
}

// ----------------------------------------------------
// 5. RICH MASS BROADCAST SUB-MENU & ENGINE
// ----------------------------------------------------
export async function sendBroadcastAdminMenu(chatId: string | number) {
  if (!adminBot) return;

  const pastLogs = await db.select().from(broadcastLogs).orderBy(desc(broadcastLogs.createdAt)).limit(5);

  let msg = `<tg-emoji emoji-id="5334982154868783692">📢</tg-emoji> <b>MASS BROADCAST ENGINE</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Send rich announcement broadcasts to ALL registered main bot users.\n\n` +
    `<b>Recent Broadcasts & Recalls:</b>\n`;

  if (pastLogs.length === 0) {
    msg += `<i>No broadcast logs recorded yet.</i>\n`;
  } else {
    for (const log of pastLogs) {
      msg += `<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> <b>Broadcast #${log.id}:</b> ${log.recipientCount} recipients [${log.broadcastType}] — ${log.createdAt ? new Date(log.createdAt).toISOString().split('T')[0] : ''}\n`;
    }
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ Create New Broadcast', callback_data: 'admin_start_broadcast' }],
      [{ text: '🗑️ Delete / Recall Sent Broadcast', callback_data: 'admin_recall_broadcast' }],
      [{ text: '⏪ Back to Main Admin Menu', callback_data: 'admin_main_menu' }]
    ]
  };

  await adminBot.sendMessage(chatId, msg, { parse_mode: 'HTML', reply_markup: keyboard }).catch(err => console.error('[ADMIN BOT] sendMessage error:', err?.message || err));
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

  try {
    const allUsers = await db.select().from(telegramUsers);
    totalUserCount = allUsers.length;
  } catch (err) { }

  const isPaused = await isShopBotPaused();
  const statusStr = isPaused ? '<tg-emoji emoji-id="6298544405435387645">🔴</tg-emoji> PAUSED (Maintenance Mode)' : '<tg-emoji emoji-id="5404617696589390973">🟢</tg-emoji> ACTIVE (Live)';

  const statementText = `
<tg-emoji emoji-id="5377620962390857342">🌐</tg-emoji> <b>MULTI-SERVER DAILY STATEMENT REPORT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5377620962390857342">🖥️</tg-emoji> <b>Server Node:</b> <code>${serverTag}</code>
<tg-emoji emoji-id="6010111371251815589">📅</tg-emoji> <b>Date:</b> ${now.toISOString().split('T')[0]}
<tg-emoji emoji-id="5361543877599724417">🤖</tg-emoji> <b>Node Status:</b> ${statusStr}

<tg-emoji emoji-id="5280907155107506256">💰</tg-emoji> <b>DEPOSITS (Past 24h)</b>
<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> Successful Deposits: <b>${depositCount}</b>
<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> Total Deposited: <b>$${(totalDepositAmount / 100).toFixed(2)}</b>

<tg-emoji emoji-id="5465416081105492147">🛒</tg-emoji> <b>ORDERS & SALES (Past 24h)</b>
<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> Products Sold: <b>${orderCount}</b>
<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> Total Sales Revenue: <b>$${(totalOrderRevenue / 100).toFixed(2)}</b>

<tg-emoji emoji-id="5260399854500191689">👥</tg-emoji> <b>CUSTOMER STATS</b>
<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> Total Registered Customers: <b>${totalUserCount}</b>

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

  try {
    console.log(`[ADMIN BOT] Initializing Multi-Server Admin Controller (${getServerName()})...`);
    await registerServerHeartbeat();
    adminBot = new TelegramBot(targetToken, { polling: true });

    adminBot.on('polling_error', (err: any) => {
      console.warn('[ADMIN BOT] Polling error:', err?.message || err);
    });
    adminBot.on('error', (err: any) => {
      console.warn('[ADMIN BOT] General error:', err?.message || err);
    });

    // Handle commands
    adminBot.onText(/\/(start|admin|menu|status|help)/, async (msg) => {
      const chatId = msg.chat.id;
      if (!(await isAuthorizedAdmin(chatId))) {
        await adminBot?.sendMessage(chatId, '<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> Access Denied. You are not an authorized admin.').catch(() => {});
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
      if (text.includes('Mass Broadcast')) {
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
          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5280907155107506256">💰</tg-emoji> Enter Product Price in USD (e.g. <code>5.00</code>):`, { parse_mode: 'HTML' }).catch(() => {});
          return;
        }
        if (session.step === 'add_prod_price') {
          const price = parseFloat(text);
          if (isNaN(price) || price <= 0) {
            await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> Invalid price. Enter numeric amount in USD (e.g. 5.00):`).catch(() => {});
            return;
          }
          session.data.price = Math.round(price * 100);
          session.step = 'add_prod_category';
          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5465416081105492147">📁</tg-emoji> Enter Category Name (e.g. <code>VPN</code>, <code>Streaming</code>, <code>Accounts</code>):`, { parse_mode: 'HTML' }).catch(() => {});
          return;
        }
        if (session.step === 'add_prod_category') {
          session.data.category = text;
          session.step = 'add_prod_desc';
          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5334982154868783692">📝</tg-emoji> Enter Product Description:`, { parse_mode: 'HTML' }).catch(() => {});
          return;
        }
        if (session.step === 'add_prod_desc') {
          session.data.description = text;
          const [newProd] = await db.insert(products).values({
            name: session.data.name,
            price: session.data.price,
            category: session.data.category,
            description: session.data.description,
            stockCount: 0
          }).returning();

          adminSessions.delete(chatId);
          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5404617696589390973">✅</tg-emoji> <b>Product Created Successfully!</b>\n\n<b>ID:</b> ${newProd.id}\n<b>Name:</b> ${newProd.name}\n<b>Price:</b> $${(newProd.price / 100).toFixed(2)}\n<b>Category:</b> ${newProd.category}`, { parse_mode: 'HTML' }).catch(() => {});
          await sendProductsAdminMenu(chatId);
          return;
        }

        // Add Stock step
        if (session.step === 'add_stock_keys') {
          const productId = session.data.productId;
          const keys = text.split('\n').map(k => k.trim()).filter(k => k.length > 0);
          if (keys.length === 0) {
            await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> No valid stock keys provided. Please paste stock credentials line-by-line.`).catch(() => {});
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
          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5404617696589390973">✅</tg-emoji> <b>Successfully added ${added} stock accounts/keys to Product ID ${productId}!</b>`, { parse_mode: 'HTML' }).catch(() => {});
          await sendProductsAdminMenu(chatId);
          return;
        }

        // Credit Balance Step
        if (session.step === 'credit_user_search') {
          session.data = { target: text };
          session.step = 'credit_user_amount';
          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5201692367437974073">💵</tg-emoji> Enter amount to <b>CREDIT (+)</b> in USD (e.g. <code>10.00</code>):`, { parse_mode: 'HTML' }).catch(() => {});
          return;
        }
        if (session.step === 'credit_user_amount') {
          const amount = parseFloat(text);
          if (isNaN(amount) || amount <= 0) {
            await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> Invalid amount. Enter numeric USD amount:`).catch(() => {});
            return;
          }
          const target = session.data.target;
          const [user] = await db.select().from(telegramUsers).where(or(eq(telegramUsers.telegramId, target), eq(telegramUsers.username, target.replace('@', ''))));
          if (!user) {
            await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> Customer user not found for ID/username: <code>${target}</code>`, { parse_mode: 'HTML' }).catch(() => {});
            adminSessions.delete(chatId);
            return;
          }
          const creditCents = Math.round(amount * 100);
          await db.execute(sql`UPDATE telegram_users SET balance = balance + ${creditCents} WHERE id = ${user.id}`);
          adminSessions.delete(chatId);
          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5404617696589390973">✅</tg-emoji> <b>Credited +$${amount.toFixed(2)} USD to User ${user.firstName || user.username || user.telegramId}!</b>`, { parse_mode: 'HTML' }).catch(() => {});
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
          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5334982154868783692">📝</tg-emoji> <b>Broadcast Content Recorded (${photoBuffer ? 'Photo &' : ''} Text with Premium Emojis)!</b>\n\nWould you like to attach an interactive button to this broadcast?`, { parse_mode: 'HTML', reply_markup: keyboard }).catch(() => {});
          return;
        }

        if (session.step === 'broadcast_url_btn_text') {
          session.data.customButtonText = text;
          session.step = 'broadcast_url_btn_url';
          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5334982154868783692">🔗</tg-emoji> Enter the Destination URL for the button (e.g. <code>https://t.me/...</code>):`, { parse_mode: 'HTML' }).catch(() => {});
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

          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5334982154868783692">📢</tg-emoji> <b>BROADCAST PREVIEW READY</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n${session.data.messageText}\n\n<b>Button:</b> [ ${session.data.customButtonText} ] -> ${session.data.customButtonUrl}`, {
            parse_mode: 'HTML',
            reply_markup: keyboard
          }).catch(() => {});
          return;
        }

        // Promo Code step
        if (session.step === 'promo_code_name') {
          session.data = { code: text.toUpperCase().trim() };
          session.step = 'promo_code_reward';
          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5280907155107506256">💰</tg-emoji> Enter Discount Reward Amount in USD (e.g. <code>5.00</code>):`, { parse_mode: 'HTML' }).catch(() => {});
          return;
        }
        if (session.step === 'promo_code_reward') {
          const reward = parseFloat(text);
          if (isNaN(reward) || reward <= 0) {
            await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> Invalid reward. Enter numeric amount in USD (e.g. 5.00):`).catch(() => {});
            return;
          }
          session.data.reward = Math.round(reward * 100);
          session.step = 'promo_code_uses';
          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="6276090299232031662">🔢</tg-emoji> Enter Maximum Uses Limit (e.g. <code>100</code>):`, { parse_mode: 'HTML' }).catch(() => {});
          return;
        }
        if (session.step === 'promo_code_uses') {
          const uses = parseInt(text);
          if (isNaN(uses) || uses <= 0) {
            await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> Invalid limit. Enter integer limit:`).catch(() => {});
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
          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5404617696589390973">✅</tg-emoji> <b>Promo Code <code>${session.data.code}</code> Created Successfully! (+$${(session.data.reward / 100).toFixed(2)})</b>`, { parse_mode: 'HTML' }).catch(() => {});
          await sendPromoCodesAdminMenu(chatId);
          return;
        }
      }
    });

    // Handle Callback Queries (Buttons)
    adminBot.on('callback_query', async (query) => {
      if (!query.message) return;
      const chatId = query.message.chat.id;
      const data = query.data;

      if (!(await isAuthorizedAdmin(chatId))) {
        await adminBot?.answerCallbackQuery(query.id, { text: 'Access Denied', show_alert: true }).catch(() => {});
        return;
      }

      await adminBot?.answerCallbackQuery(query.id).catch(() => {});

      if (data === 'admin_main_menu') {
        adminSessions.delete(String(chatId));
        await sendAdminMenu(chatId);
        return;
      }
      if (data === 'menu_products') {
        await sendProductsAdminMenu(chatId);
        return;
      }
      if (data === 'menu_customers') {
        await sendCustomersAdminMenu(chatId);
        return;
      }
      if (data === 'menu_promocodes') {
        await sendPromoCodesAdminMenu(chatId);
        return;
      }
      if (data === 'menu_settings') {
        await sendSettingsAdminMenu(chatId);
        return;
      }
      if (data === 'menu_broadcast') {
        await sendBroadcastAdminMenu(chatId);
        return;
      }

      if (data === 'get_statement') {
        const target = selectedServerMap.get(String(chatId)) || getServerName();
        const text = await generate24hDailyStatementText(target);
        await adminBot?.sendMessage(chatId, text, { parse_mode: 'HTML' }).catch(() => {});
        return;
      }

      if (data === 'toggle_status') {
        const currentlyPaused = await isShopBotPaused();
        const nextState = !currentlyPaused;
        await setShopBotPaused(nextState);
        const newLabel = nextState ? '<tg-emoji emoji-id="6298544405435387645">🔴</tg-emoji> PAUSED (Maintenance Mode)' : '<tg-emoji emoji-id="5404617696589390973">🟢</tg-emoji> ACTIVE (Live)';
        await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5377620962390857342">🔄</tg-emoji> <b>[${getServerName()}] Status changed:</b> ${newLabel}`, { parse_mode: 'HTML' }).catch(() => {});
        await sendAdminMenu(chatId);
        return;
      }

      // Add Product Trigger
      if (data === 'admin_add_product') {
        adminSessions.set(String(chatId), { step: 'add_prod_name', data: {} });
        await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5465416081105492147">📦</tg-emoji> <b>Adding New Product</b>\n\nPlease enter the <b>Product Name</b>:`, { parse_mode: 'HTML' }).catch(() => {});
        return;
      }

      // Add Stock Trigger
      if (data === 'admin_add_stock') {
        const allProds = await db.select().from(products);
        if (allProds.length === 0) {
          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> No products available. Please create a product first.`).catch(() => {});
          return;
        }
        const buttons = allProds.map(p => ([{
          text: `📦 ${p.name} ($${(p.price / 100).toFixed(2)})`,
          callback_data: `sel_prod_stock_${p.id}`
        }]));
        await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5465416081105492147">📦</tg-emoji> <b>Select a product to add Stock Accounts / Keys:</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } }).catch(() => {});
        return;
      }

      if (data?.startsWith('sel_prod_stock_')) {
        const prodId = parseInt(data.replace('sel_prod_stock_', ''));
        adminSessions.set(String(chatId), { step: 'add_stock_keys', data: { productId: prodId } });
        await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="6276090299232031662">🔑</tg-emoji> <b>Paste Accounts / Digital Keys line-by-line:</b>\n\nEach line will be added as 1 available stock account item.`, { parse_mode: 'HTML' }).catch(() => {});
        return;
      }

      // Credit balance trigger
      if (data === 'admin_credit_balance') {
        adminSessions.set(String(chatId), { step: 'credit_user_search' });
        await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5260399854500191689">🔍</tg-emoji> Send the Customer's <b>Telegram Chat ID</b> or <b>Username</b> (e.g. <code>7507799896</code> or <code>@username</code>):`, { parse_mode: 'HTML' }).catch(() => {});
        return;
      }

      // Create promo code trigger
      if (data === 'admin_create_promo') {
        adminSessions.set(String(chatId), { step: 'promo_code_name' });
        await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5814427657609153890">🎟️</tg-emoji> Enter New <b>Promo Code</b> (e.g. <code>BONUS5</code>):`, { parse_mode: 'HTML' }).catch(() => {});
        return;
      }

      // Gateway Toggles
      if (data?.startsWith('toggle_gateway_')) {
        const gw = data.replace('toggle_gateway_', '').toUpperCase();
        const key = `PAYMENT_${gw}_ENABLED`;
        const curr = (await storage.getSetting(key))?.value !== 'false';
        await storage.setSetting(key, curr ? 'false' : 'true');
        await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5377620962390857342">🔄</tg-emoji> <b>Gateway ${gw} status updated:</b> ${!curr ? '<tg-emoji emoji-id="5404617696589390973">🟢</tg-emoji> Enabled' : '<tg-emoji emoji-id="6298544405435387645">🔴</tg-emoji> Disabled'}`, { parse_mode: 'HTML' }).catch(() => {});
        await sendSettingsAdminMenu(chatId);
        return;
      }

      // Broadcast Flow Triggers
      if (data === 'admin_start_broadcast') {
        adminSessions.set(String(chatId), { step: 'broadcast_text', data: {} });
        await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5334982154868783692">📢</tg-emoji> <b>NEW MASS BROADCAST</b>\n\nPlease enter or send the Broadcast Message (text or photo caption with Premium Emojis & HTML supported):`, { parse_mode: 'HTML' }).catch(() => {});
        return;
      }

      if (data === 'bcast_attach_product') {
        const allProds = await db.select().from(products);
        if (allProds.length === 0) {
          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> No products found in store. Please create a product first.`, { parse_mode: 'HTML' }).catch(() => {});
          return;
        }
        const buttons = allProds.map(p => ([{
          text: `🛒 Buy Now: ${p.name} ($${(p.price / 100).toFixed(2)})`,
          callback_data: `bcast_sel_prod_${p.id}`
        }]));
        await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5465416081105492147">🛒</tg-emoji> <b>Select Product to attach as "Buy Now" button:</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } }).catch(() => {});
        return;
      }

      if (data?.startsWith('bcast_sel_prod_')) {
        const prodId = parseInt(data.replace('bcast_sel_prod_', ''));
        const session = adminSessions.get(String(chatId));
        if (session) {
          session.data = session.data || {};
          session.data.targetProductId = prodId;
        }

        const [prod] = await db.select().from(products).where(eq(products.id, prodId));
        const prodName = prod ? prod.name : `Product #${prodId}`;
        const priceUSD = prod ? (prod.price / 100).toFixed(2) : '0.00';

        const keyboard = {
          inline_keyboard: [
            [{ text: '⚡ CONFIRM & SEND BROADCAST', callback_data: 'bcast_confirm_send' }],
            [{ text: '❌ Cancel Broadcast', callback_data: 'admin_main_menu' }]
          ]
        };

        await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5404617696589390973">✅</tg-emoji> <b>Product Attached:</b> ${prodName} ($${priceUSD})\n\n<tg-emoji emoji-id="5334982154868783692">📢</tg-emoji> <b>BROADCAST PREVIEW READY</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n${session?.data?.messageText || ''}\n\n<b>Attached Button:</b> [ 🛒 Buy Now: ${prodName} ($${priceUSD}) ]`, {
          parse_mode: 'HTML',
          reply_markup: keyboard
        }).catch(() => {});
        return;
      }

      if (data === 'bcast_attach_url') {
        adminSessions.set(String(chatId), { step: 'broadcast_url_btn_text', data: adminSessions.get(String(chatId))?.data || {} });
        await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5334982154868783692">📝</tg-emoji> Enter Button Label Text (e.g. <code>Join Channel</code>):`, { parse_mode: 'HTML' }).catch(() => {});
        return;
      }

      // CONFIRM AND EXECUTE BROADCAST
      if (data === 'bcast_confirm_send') {
        const session = adminSessions.get(String(chatId));
        if (!session || !session.data || (!session.data.messageText && !session.data.photoBuffer)) {
          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> No broadcast content found. Please restart broadcast creation.`).catch(() => {});
          return;
        }

        const bText = session.data.messageText || '';
        const photoBuffer = session.data.photoBuffer as Buffer | undefined;
        const targetProdId = session.data.targetProductId;
        const customBtnText = session.data.customButtonText;
        const customBtnUrl = session.data.customButtonUrl;

        await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="6010111371251815589">⏳</tg-emoji> <b>Sending Mass Broadcast with Premium Emojis, Photos & Buttons to ALL users...</b> Please wait.`, { parse_mode: 'HTML' }).catch(() => {});

        const allUsers = await db.select().from(telegramUsers);
        const sentMessages: { chatId: string; messageId: number }[] = [];
        let successCount = 0;

        // Build 100% valid Telegram Bot API inline keyboard for broadcast
        const inlineKeyboard: any[][] = [];
        if (targetProdId) {
          const [prod] = await db.select().from(products).where(eq(products.id, targetProdId));
          const btnLabel = prod ? `🛒 Buy Now: ${prod.name} ($${(prod.price / 100).toFixed(2)})` : `🛒 Buy Now`;
          inlineKeyboard.push([{ text: btnLabel, callback_data: `prod_${targetProdId}` }]);
        } else if (customBtnText && customBtnUrl) {
          inlineKeyboard.push([{ text: customBtnText, url: customBtnUrl }]);
        }

        const targetSenderBot = mainBotReference || adminBot;
        let mainBotPhotoFileId: string | undefined = undefined;

        for (const user of allUsers) {
          try {
            let sentMsg;
            if (photoBuffer) {
              const photoToSend = mainBotPhotoFileId || photoBuffer;
              sentMsg = await targetSenderBot?.sendPhoto(user.telegramId, photoToSend, {
                caption: bText,
                parse_mode: 'HTML',
                reply_markup: inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined
              });
              if (sentMsg && sentMsg.photo && sentMsg.photo.length > 0 && !mainBotPhotoFileId) {
                mainBotPhotoFileId = sentMsg.photo[sentMsg.photo.length - 1].file_id;
              }
            } else {
              sentMsg = await targetSenderBot?.sendMessage(user.telegramId, bText, {
                parse_mode: 'HTML',
                reply_markup: inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined
              });
            }

            if (sentMsg) {
              sentMessages.push({ chatId: String(user.telegramId), messageId: sentMsg.message_id });
              successCount++;
            }
          } catch (err: any) {
            console.error(`[BROADCAST] Error sending to user ${user.telegramId}:`, err?.message || err);
          }
        }

        // Log broadcast for recall/deletion capability
        const [bLog] = await db.insert(broadcastLogs).values({
          adminChatId: String(chatId),
          broadcastType: photoBuffer ? 'photo' : 'text',
          messageText: bText,
          photoUrl: photoBuffer ? 'photo_buffer' : null,
          targetProductId: targetProdId || null,
          customButtonText: customBtnText || null,
          customButtonUrl: customBtnUrl || null,
          recipientCount: successCount,
          sentMessagesJson: JSON.stringify(sentMessages)
        }).returning();

        adminSessions.delete(String(chatId));

        await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="5803393311100113792">🎉</tg-emoji> <b>MASS BROADCAST COMPLETED!</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> Successful Deliveries: <b>${successCount} / ${allUsers.length}</b>\n<tg-emoji emoji-id="5370919202796348364">▪️</tg-emoji> Campaign Log ID: <code>#${bLog.id}</code>\n\n<i>You can recall/delete this broadcast anytime from the Mass Broadcast menu.</i>`, { parse_mode: 'HTML' }).catch(() => {});
        await sendBroadcastAdminMenu(chatId);
        return;
      }

      // RECALL / DELETE SENT BROADCAST
      if (data === 'admin_recall_broadcast') {
        const pastLogs = await db.select().from(broadcastLogs).orderBy(desc(broadcastLogs.createdAt)).limit(10);
        if (pastLogs.length === 0) {
          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> No active broadcast campaigns found to recall.`).catch(() => {});
          return;
        }
        const buttons = pastLogs.map(l => ([{
          text: `🗑️ Delete Broadcast #${l.id} (${l.recipientCount} users)`,
          callback_data: `exec_recall_${l.id}`
        }]));
        await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">🗑️</tg-emoji> <b>Select a Broadcast Campaign to RECALL & DELETE from all users:</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } }).catch(() => {});
        return;
      }

      if (data?.startsWith('exec_recall_')) {
        const logId = parseInt(data.replace('exec_recall_', ''));
        const [log] = await db.select().from(broadcastLogs).where(eq(broadcastLogs.id, logId));

        if (!log || !log.sentMessagesJson) {
          await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">❌</tg-emoji> Broadcast log #${logId} not found or has no record.`).catch(() => {});
          return;
        }

        await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="6010111371251815589">⏳</tg-emoji> <b>Recalling and deleting Broadcast #${logId} from ALL recipient chats...</b>`, { parse_mode: 'HTML' }).catch(() => {});

        const sentMessages: { chatId: string; messageId: number }[] = JSON.parse(log.sentMessagesJson);
        let deletedCount = 0;

        const targetSenderBot = mainBotReference || adminBot;

        for (const item of sentMessages) {
          try {
            await targetSenderBot?.deleteMessage(item.chatId, item.messageId);
            deletedCount++;
          } catch (e) {}
        }

        await db.delete(broadcastLogs).where(eq(broadcastLogs.id, logId));

        await adminBot?.sendMessage(chatId, `<tg-emoji emoji-id="6298544405435387645">🗑️</tg-emoji> <b>BROADCAST RECALL COMPLETED!</b>\n━━━━━━━━━━━━━━━━━━━━━\nSuccessfully deleted <b>${deletedCount} / ${sentMessages.length}</b> broadcast messages across all Telegram chats.`, { parse_mode: 'HTML' }).catch(() => {});
        await sendBroadcastAdminMenu(chatId);
        return;
      }
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

// Auto-run if executed directly as a script
if (process.argv[1]?.includes('admin-bot-controller')) {
  initAdminBotController().catch(err => console.error('[ADMIN BOT] Direct startup error:', err));
}
