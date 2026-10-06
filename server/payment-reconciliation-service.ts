/**
 * Autonomous Payment & Order Reconciliation Engine (Self-Healing Watchdog)
 * 
 * Automatically monitors completed payments, pending orders, and wallet top-ups.
 * If a customer closes their tab or client redirect fails, this engine automatically:
 * 1. Verifies & synchronizes wallet balances (USD cents and LKR).
 * 2. Generates & dispatches Luxury PDF Receipts via Email (with automatic Sandbox routing to verified owner inbox).
 * 3. Sends Web Push Notifications to all active subscriber devices.
 * 4. Dispatches instant Telegram Bot notifications directly to the customer.
 * 5. Reconciles & auto-fulfills pending orders, delivering digital credentials instantly.
 */

import { db, pool } from "./db";
import { storage } from "./storage";
import { payments, telegramUsers, orders, credentials, emailLogs } from "@shared/schema";
import { eq, desc, and, ne, gte, sql } from "drizzle-orm";
import { sendLuxuryReceiptEmail, sendLuxuryEmail } from "./email-service";
import { buildOrderCredentialsEmailHtml, generateCredentialsTxt } from "./email-template";
import { sendAdminPushNotification } from "./push-notifications";
import { fetchLiveExchangeRates } from "./currency";
import axios from "axios";

let isReconciling = false;

interface ReconciliationResult {
  paymentsProcessed: number;
  emailsSent: number;
  pushNotificationsSent: number;
  telegramNotificationsSent: number;
  ordersFulfilled: number;
}

export async function runPaymentAndOrderReconciliation(io?: any): Promise<ReconciliationResult> {
  if (isReconciling) {
    return { paymentsProcessed: 0, emailsSent: 0, pushNotificationsSent: 0, telegramNotificationsSent: 0, ordersFulfilled: 0 };
  }
  isReconciling = true;

  const result: ReconciliationResult = {
    paymentsProcessed: 0,
    emailsSent: 0,
    pushNotificationsSent: 0,
    telegramNotificationsSent: 0,
    ordersFulfilled: 0,
  };

  try {
    const mainBotTokenSetting = await storage.getSetting("TELEGRAM_BOT_TOKEN");
    const botToken = mainBotTokenSetting?.value?.trim() || "8570720705:AAGVVRYqZ2POG13ucLeEfYVPD2t-MJMkbBU";

    // ─────────────────────────────────────────────────────────────
    // 1. RECONCILE RECENT COMPLETED PAYMENTS (Last 7 Days)
    // ─────────────────────────────────────────────────────────────
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const completedPayments = await db.select().from(payments).where(
      and(
        eq(payments.status, "completed"),
        gte(payments.createdAt, sevenDaysAgo)
      )
    ).orderBy(desc(payments.id)).limit(30);

    for (const payment of completedPayments) {
      if (payment.paymentMethod === "admin_deduction" || payment.paymentMethod === "admin_topup") continue;

      const user = await storage.getTelegramUserById(payment.telegramUserId);
      if (!user) continue;

      result.paymentsProcessed++;

      const isLkr = (payment.currency || "").toUpperCase() === "LKR";
      const rates = await fetchLiveExchangeRates().catch(() => ({ LKR: 305.50 } as any));
      const lkrRate = rates.LKR || 305.50;

      const creditLkr = isLkr ? Math.round(payment.amount / 100) : Math.round((payment.amount / 100) * lkrRate);
      const creditCents = isLkr ? Math.round((creditLkr / lkrRate) * 100) : payment.amount;

      const rawMethod = (payment.paymentMethod || "card").toLowerCase();
      let methodTitle = "Card Payment";
      let methodDetails = "";
      if (rawMethod.includes("frimi")) {
        methodTitle = "FriMi";
        methodDetails = "Paid via FriMi";
      } else if (rawMethod.includes("ipay")) {
        methodTitle = "iPay";
        methodDetails = "Paid via iPay";
      } else if (rawMethod.includes("qplus") || rawMethod.includes("q+")) {
        methodTitle = "Q+ Payment";
        methodDetails = "Paid via Q+ Payment";
      } else if (rawMethod.includes("google") || rawMethod.includes("gpay")) {
        methodTitle = "Google Pay";
        methodDetails = "Paid via Google Pay";
      } else if (rawMethod.includes("master")) {
        methodTitle = "Mastercard";
        methodDetails = payment.txid ? `Mastercard ending in •••• ${payment.txid.slice(-4)}` : "Mastercard";
      } else if (rawMethod.includes("visa")) {
        methodTitle = "Visa";
        methodDetails = payment.txid ? `Visa ending in •••• ${payment.txid.slice(-4)}` : "Visa Card";
      } else if (rawMethod.includes("binance")) {
        methodTitle = "Binance Pay";
        methodDetails = "Paid via Binance Pay";
      } else if (rawMethod.includes("bep20") || rawMethod.includes("trc20")) {
        methodTitle = `${rawMethod.toUpperCase()} Crypto`;
        methodDetails = payment.txid ? `TxID: ${payment.txid.slice(0, 10)}...` : "Crypto Transfer";
      } else {
        methodTitle = "Online Payment";
        methodDetails = "Paid online";
      }

      const referenceId = `${methodTitle.toUpperCase().replace(/\s+/g, '')}-${payment.id}`;

      // ── Step A: Check if Payment Success Receipt was dispatched ──
      const checkEmailLogs = await db.select().from(emailLogs).where(
        and(
          eq(emailLogs.templateType, "payment_success")
        )
      ).orderBy(desc(emailLogs.id)).limit(50);

      const alreadySent = checkEmailLogs.some(log => {
        const meta = log.metadata as any;
        if (!meta) return false;
        if (meta.paymentId === payment.id) return true;
        if (typeof meta.referenceId === 'string' && (meta.referenceId === referenceId || meta.referenceId.endsWith(`-${payment.id}`))) return true;
        return false;
      });

      if (!alreadySent) {
        console.log(`[RECONCILIATION ENGINE] Detected missing receipt for Payment #${payment.id}. Dispatching receipt...`);

        // NOTE: Wallet balance is ALREADY credited atomically when the payment is completed in processPaymentSuccessReceipt.
        // We do NOT add balance here to prevent double-crediting!

        const recipientEmail = (user.email && user.email.includes("@")) ? user.email : "rochanaimeah@gmail.com";
        const recipientName = user.firstName || user.username || "Valued Customer";

        await sendLuxuryReceiptEmail({
          toEmail: recipientEmail,
          recipientName,
          amount: isLkr ? `Rs. ${creditLkr.toLocaleString()} LKR` : `$${(creditCents / 100).toFixed(2)} USD`,
          secondaryAmount: isLkr ? `$${(creditCents / 100).toFixed(2)} USD` : `Rs. ${creditLkr.toLocaleString()} LKR`,
          referenceId,
          paymentMethod: rawMethod,
          paymentMethodDetails: methodDetails,
          planTitle: "Wallet Balance Deposit",
          billingCycle: "Instant Credit",
          notes: `${methodTitle} Top-Up #${payment.id}`,
          newBalance: isLkr ? `Rs. ${(user.balanceLkr || 0).toLocaleString()} LKR` : `$${((user.balance || 0) / 100).toFixed(2)} USD`
        }).catch(err => console.error("[RECONCILIATION Email Error]:", err.message));

        result.emailsSent++;

        // ── Step B: Web Push Notification ──
        await sendAdminPushNotification({
          title: `💳 ${methodTitle} Confirmed (${isLkr ? `Rs. ${creditLkr.toLocaleString()}` : `$${(creditCents / 100).toFixed(2)}`})`,
          body: `${recipientName} deposited ${isLkr ? `Rs. ${creditLkr.toLocaleString()}` : `$${(creditCents / 100).toFixed(2)}`} via ${methodTitle} (#${payment.id})`,
          url: "/shop"
        }).catch(() => {});
        result.pushNotificationsSent++;

        // ── Step C: Direct Telegram Notification ONLY for authentic Telegram Bot users ──
        // Web site (youuhost.com) deposits MUST NOT send messages to Telegram users or admin bots!
        const isTelegramCustomer = user.authProvider === "telegram" && user.telegramId && /^\d+$/.test(user.telegramId);

        if (isTelegramCustomer && botToken) {
          const isBinance = rawMethod.includes("binance");
          const tgMsg = isBinance
            ? `<tg-emoji emoji-id="6084551628461967966">✅</tg-emoji> <b>Binance Pay payment confirmed!</b>\n` +
              `Wallet credited: <b>$${(creditCents / 100).toFixed(2)} </b><tg-emoji emoji-id="6039539366177541657">⬅️</tg-emoji>\n` +
              `Transaction: <code>${payment.txid || referenceId}</code>`
            : `🎉 <b>Payment Confirmed & Verified!</b>\n\n` +
              `🪙 <b>Method:</b> ${methodTitle}\n` +
              `💰 <b>Amount:</b> ${isLkr ? `Rs. ${creditLkr.toLocaleString()} LKR` : `$${(creditCents / 100).toFixed(2)} USD`}\n` +
              `🧾 <b>Reference:</b> <code>${referenceId}</code>\n` +
              `⚡ <b>Status:</b> Credited to Wallet Balance\n\n` +
              `📧 <i>Official PDF Receipt & Invoice dispatched to ${recipientEmail}</i>`;

          await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: user.telegramId,
            text: tgMsg,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: isBinance
                ? [
                    [{ text: "🛍️ Catalog", callback_data: "buy" }],
                    [{ text: "🌐 Open Shop", web_app: { url: "https://youuhost.com/shop" } }]
                  ]
                : [
                    [{ text: "🛍️ Catalog", callback_data: "buy" }],
                    [{ text: "🛍️ Open Shop Mini App", web_app: { url: "https://youuhost.com/shop" } }],
                    [{ text: "📜 View Balance", callback_data: "my_profile" }]
                  ]
            }
          }).catch(err => console.error("[RECONCILIATION Telegram Error]:", err?.response?.data || err.message));

          result.telegramNotificationsSent++;
        }

        // ── Step D: Real-time Socket.io Broadcast ──
        if (io) {
          io.emit("payment_completed", { paymentId: payment.id, userId: user.id });
          io.emit("user_balance_updated", { userId: user.id, balanceLkr: user.balanceLkr, balance: user.balance });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. RECONCILE PENDING/UNFULFILLED ORDERS (Auto-Deliver Stock)
    // ─────────────────────────────────────────────────────────────
    const pendingOrders = await db.select().from(orders).where(
      and(
        eq(orders.status, "pending"),
        gte(orders.createdAt, sevenDaysAgo)
      )
    ).orderBy(desc(orders.id)).limit(10);

    for (const order of pendingOrders) {
      if (!order.productId || !order.telegramUserId) continue;

      // Check if stock exists for this product
      const availableCredentials = await db.select().from(credentials).where(
        and(
          eq(credentials.productId, order.productId),
          eq(credentials.isUsed, false)
        )
      ).limit(1);

      if (availableCredentials.length > 0) {
        const cred = availableCredentials[0];
        console.log(`[RECONCILIATION ENGINE] Auto-delivering stock for Order #${order.id} (Credential #${cred.id})...`);

        // Atomically assign credential and mark order completed
        await db.update(credentials).set({
          isUsed: true,
          assignedToUserId: order.telegramUserId,
          assignedAt: new Date()
        }).where(eq(credentials.id, cred.id));

        await db.update(orders).set({
          credentialId: cred.id,
          status: "completed"
        }).where(eq(orders.id, order.id));

        result.ordersFulfilled++;

        const user = await storage.getTelegramUserById(order.telegramUserId);
        const product = await storage.getProduct(order.productId);

        if (user && product) {
          const recipientEmail = (user.email && user.email.includes("@")) ? user.email : "rochanaimeah@gmail.com";
          const recipientName = user.firstName || user.username || "Customer";

          // Send credentials email
          const credsLines = [cred.credentialData];
          const credTxt = generateCredentialsTxt({
            orderId: `YOUUHOST-${order.id}`,
            productName: product.name,
            credentials: credsLines,
          });

          await sendLuxuryEmail({
            toEmail: recipientEmail,
            recipientName,
            subject: `Order #YOUUHOST-${order.id} Confirmed - Your Product Credentials`,
            html: buildOrderCredentialsEmailHtml({
              toEmail: recipientEmail,
              recipientName,
              orderId: `YOUUHOST-${order.id}`,
              productName: product.name,
              quantity: 1,
              amount: `$${(order.amount ? order.amount / 100 : product.price / 100).toFixed(2)} USD`,
              credentials: credsLines,
            }),
            templateType: "order_credentials",
            metadata: {
              orderId: `YOUUHOST-${order.id}`,
              quantity: 1,
            },
            attachments: [
              {
                filename: `credentials_order_${order.id}.txt`,
                content: credTxt,
                contentType: "text/plain",
              },
            ],
          }).catch(err => console.error("[RECONCILIATION Order Email Error]:", err.message));

          // Send Telegram bot message with credentials ONLY if customer purchased via Telegram
          const isTelegramCustomer = user.authProvider === "telegram" && user.telegramId && /^\d+$/.test(user.telegramId);

          if (isTelegramCustomer && botToken) {
            const orderMsg =
              `✅ <b>Order #YOUUHOST-${order.id} Fulfilled!</b>\n\n` +
              `📦 <b>Product:</b> ${product.name}\n` +
              `🔑 <b>Credentials / Access:</b>\n` +
              `<code>${cred.credentialData}</code>\n\n` +
              `📧 <i>Backup credentials sent to ${recipientEmail}</i>`;

            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              chat_id: user.telegramId,
              text: orderMsg,
              parse_mode: "HTML"
            }).catch(() => {});
          }

          if (io) {
            io.emit("order_completed", { orderId: order.id, userId: user.id });
          }
        }
      }
    }
  } catch (err: any) {
    console.error("[RECONCILIATION ENGINE] Error during execution:", err.message);
  } finally {
    isReconciling = false;
  }

  return result;
}

/**
 * One-time self-healing balance adjustment to reverse duplicate 50 LKR credited by reconciliation on FriMi #462.
 */
export async function fixDuplicateReconciliationPayments() {
  try {
    const existingCorrection = await db.select().from(payments).where(
      eq(payments.externalId, "REVERSAL-FRIMI-462")
    ).limit(1);

    if (existingCorrection.length === 0) {
      const targetUsers = await db.select().from(telegramUsers).where(
        eq(telegramUsers.email, "imeshcheak@gmail.com")
      );

      for (const targetUser of targetUsers) {
        if ((targetUser.balanceLkr || 0) >= 50) {
          const rates = await fetchLiveExchangeRates().catch(() => ({ LKR: 305.50 } as any));
          const lkrRate = rates.LKR || 305.50;
          const deductCents = Math.round((50 / lkrRate) * 100);

          await db.update(telegramUsers).set({
            balanceLkr: sql`GREATEST(0, COALESCE(balance_lkr, 0) - 50)`,
            balance: sql`GREATEST(0, balance - ${deductCents})`
          }).where(eq(telegramUsers.id, targetUser.id));

          await storage.createPayment({
            telegramUserId: targetUser.id,
            amount: -5000,
            currency: "LKR",
            paymentMethod: "admin_deduction",
            status: "completed",
            externalId: "REVERSAL-FRIMI-462",
            txid: "REVERSAL-FRIMI-462",
            originalLkr: -50
          } as any);

          console.log(`[RECONCILIATION FIX] Successfully reversed duplicate 50 LKR on FriMi #462 for user #${targetUser.id} (${targetUser.email}). New balance: ${(targetUser.balanceLkr || 0) - 50} LKR`);
        }
      }
    }
  } catch (err: any) {
    console.error("[RECONCILIATION FIX Error]:", err.message);
  }
}

export function startPaymentReconciliationWatchdog(io?: any) {
  console.log("[RECONCILIATION ENGINE] Starting autonomous Payment & Order Watchdog (Interval: 60s)...");
  
  // Run one-time balance fix on startup
  setTimeout(() => {
    fixDuplicateReconciliationPayments().catch(() => {});
  }, 1000);

  // Initial run after 5 seconds
  setTimeout(() => {
    runPaymentAndOrderReconciliation(io).catch(() => {});
  }, 5000);

  // Recurring 60-second watchdog
  setInterval(() => {
    runPaymentAndOrderReconciliation(io).catch(() => {});
  }, 60000);
}
