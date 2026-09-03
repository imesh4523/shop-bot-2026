// @ts-ignore
import webpush from 'web-push';
import { storage } from './storage';
import axios from 'axios';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { getAuthorizedAdminChatIds, getAuthorizedBotTokens, getServerName } from './admin-bot-controller';

const _dec = (s: string) => Buffer.from(s, 'base64').toString('utf-8');

export async function sendTelegramAdminNotification(text: string) {
  const botTokens = await getAuthorizedBotTokens();
  const chatIds = await getAuthorizedAdminChatIds();
  const serverTag = getServerName();

  const formattedText = `🌐 [<b>${serverTag}</b>]\n${text}`;

  for (const token of botTokens) {
    for (const id of chatIds) {
      try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
          chat_id: id,
          text: formattedText,
          parse_mode: 'HTML'
        });
        console.log(`[TELEGRAM NOTIFY] Sent notification successfully to ${id}`);
      } catch (err: any) {
        console.error(`[TELEGRAM NOTIFY] Error sending notification to ${id}:`, err?.response?.data || err?.message);
      }
    }
  }
}



export async function initPushNotifications() {
  // Ensure table exists (Fallback)
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        subscription JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[PUSH] push_subscriptions table verified');
  } catch (err) {
    console.error('[PUSH] Table creation error:', err);
  }

  let publicKey = process.env.VAPID_PUBLIC_KEY || (await storage.getSetting('VAPID_PUBLIC_KEY'))?.value;
  let privateKey = process.env.VAPID_PRIVATE_KEY || (await storage.getSetting('VAPID_PRIVATE_KEY'))?.value;
  let subject = process.env.VAPID_SUBJECT || (await storage.getSetting('VAPID_SUBJECT'))?.value;

  if (!publicKey || !privateKey || !subject) {
    if (!publicKey) publicKey = "BNihA4onN0-3ByoQHRax9sPMew-UfO5ReCR8kgS7zDNlaRxqBfxBKtzR8yVuEwBt0cVXl42YoKTCDzjoFlokNRE";
    if (!privateKey) privateKey = "CNCFXRkJSwIbuRODXnrkfp3505c0dyksjMJ_Xzf5sUk";
    if (!subject) subject = "mailto:admin@shopeefy.com";

    await storage.setSetting('VAPID_PUBLIC_KEY', publicKey);
    await storage.setSetting('VAPID_PRIVATE_KEY', privateKey);
    await storage.setSetting('VAPID_SUBJECT', subject);
  }

  try {
    webpush.setVapidDetails(
      subject,
      publicKey,
      privateKey
    );
    console.log('[PUSH] Initialized with user-configured VAPID keys');
  } catch (err: any) {
    console.error('[PUSH] Failed to set VAPID details with current keys:', err?.message);
    const fallbackPublic = "BNihA4onN0-3ByoQHRax9sPMew-UfO5ReCR8kgS7zDNlaRxqBfxBKtzR8yVuEwBt0cVXl42YoKTCDzjoFlokNRE";
    const fallbackPrivate = "CNCFXRkJSwIbuRODXnrkfp3505c0dyksjMJ_Xzf5sUk";
    try {
      webpush.setVapidDetails(
        "mailto:admin@shopeefy.com",
        fallbackPublic,
        fallbackPrivate
      );
      publicKey = fallbackPublic;
      console.log('[PUSH] Initialized with default fallback VAPID keys after error.');
    } catch (fallbackErr) {
      console.error('[PUSH] Critical VAPID initialization error:', fallbackErr);
    }
  }

  return { publicKey };
}

export async function sendAdminPushNotification(titleOrOpts: string | { title: string; body: string; url?: string }, bodyStr?: string, urlStr?: string) {
  try {
    let title = typeof titleOrOpts === 'string' ? titleOrOpts : titleOrOpts.title;
    let body = typeof titleOrOpts === 'string' ? (bodyStr || '') : titleOrOpts.body;
    let url = typeof titleOrOpts === 'string' ? urlStr : titleOrOpts.url;

    const subscriptions = await storage.getPushSubscriptions();
    console.log(`[PUSH] Sending push notification to ${subscriptions.length} subscribers: ${title} - ${body}`);
    
    const payload = JSON.stringify({
      title,
      body,
      url: url || '/orders',
    });

    const promises = subscriptions.map(sub => 
      webpush.sendNotification(sub.subscription, payload)
        .catch((err: any) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`[PUSH] Removing invalid subscription (Status: ${err.statusCode})`);
          } else {
            console.error('[PUSH] Error sending to subscriber:', err.endpoint, err.message);
          }
        })
    );

    await Promise.all(promises);
    await sendTelegramAdminNotification(`<b>${title}</b>\n${body}`);
  } catch (err) {
    console.error('[PUSH] Failed to send notifications:', err);
  }
}
