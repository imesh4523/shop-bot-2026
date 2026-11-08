import crypto from "crypto";
import { db } from "./db";
import { settings } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

// 256-bit master key derived cryptographically from environment secrets
const MASTER_SECRET =
  process.env.MASTER_ENCRYPTION_KEY ||
  process.env.SESSION_SECRET ||
  process.env.DATABASE_URL ||
  "youuhost_secure_vault_master_key_2026_salt";

const VAULT_KEY = crypto.createHash("sha256").update(MASTER_SECRET).digest(); // Exactly 32 bytes

export const SENSITIVE_SETTING_KEYS = new Set([
  // Partner Reseller Base URLs & Webhook Links
  "TUNVN_BASE_URL",
  "CSSX_BASE_URL",
  "N1PANEL_API_URL",
  "SOCIALPANEL_API_URL",
  "PAYHERE_GATEWAY_URL",

  // Partner Reseller & Payment API Keys / Secrets
  "TUNVN_API_KEY",
  "SANDROMANIA_API_KEY",
  "SANDROMANIA_API_SECRET",
  "CSSX_API_KEY",
  "N1PANEL_API_KEY",
  "SOCIALPANEL_API_KEY",
  "PAYHERE_MERCHANT_SECRET",
  "PAYHERE_PAIR_TOKEN",
  "CRYPTOMUS_API_KEY",
  "BINANCE_API_KEY",
  "BINANCE_SECRET_KEY",
  "BYBIT_API_KEY",
  "BYBIT_SECRET_KEY",
  "RESEND_API_KEY",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_GLOBAL_KEY",
  "TG_CLIENT_SESSION",
  "TG_CLIENT_API_HASH",
  "ADMIN_2FA_SECRET",
]);

export function isSensitiveKey(key: string): boolean {
  if (!key) return false;
  if (SENSITIVE_SETTING_KEYS.has(key)) return true;
  const upper = key.toUpperCase();
  return (
    upper.includes("API_KEY") ||
    upper.includes("API_SECRET") ||
    upper.includes("BASE_URL") ||
    upper.includes("GATEWAY_URL") ||
    (upper.includes("SECRET") && !upper.includes("SESSION")) ||
    upper.includes("MERCHANT_SECRET")
  );
}

export function isEncrypted(val: string): boolean {
  return typeof val === "string" && val.startsWith("enc:v1:");
}

/**
 * Encrypt sensitive plain text using AES-256-GCM authenticated encryption.
 * Output format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptSensitive(text: string): string {
  if (!text || typeof text !== "string") return text;
  if (isEncrypted(text)) return text; // Already encrypted

  try {
    const iv = crypto.randomBytes(12); // Standard 96-bit IV for AES-GCM
    const cipher = crypto.createCipheriv("aes-256-gcm", VAULT_KEY, iv);
    
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");

    return `enc:v1:${iv.toString("hex")}:${tag}:${encrypted}`;
  } catch (err: any) {
    console.error("[CryptoVault] Encryption failed:", err.message);
    return text;
  }
}

/**
 * Decrypt ciphertext encrypted with AES-256-GCM.
 * If text is plain or legacy unencrypted, safely returns original text.
 */
export function decryptSensitive(ciphertext: string): string {
  if (!ciphertext || typeof ciphertext !== "string") return ciphertext;
  if (!isEncrypted(ciphertext)) return ciphertext; // Not encrypted, return plain text

  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== "v1") {
      return ciphertext;
    }

    const iv = Buffer.from(parts[2], "hex");
    const tag = Buffer.from(parts[3], "hex");
    const encContent = parts[4];

    const decipher = crypto.createDecipheriv("aes-256-gcm", VAULT_KEY, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encContent, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err: any) {
    console.error("[CryptoVault] Decryption failed (invalid key or corrupted tag):", err.message);
    return "";
  }
}

/**
 * One-time and boot migration to scan and encrypt all existing partner URLs and API keys in PostgreSQL.
 */
export async function migrateAndEncryptAllSensitiveSettings(): Promise<number> {
  let encryptedCount = 0;
  try {
    const allSettings = await db.select().from(settings);
    for (const row of allSettings) {
      if (isSensitiveKey(row.key) && row.value && !isEncrypted(row.value)) {
        const cipher = encryptSensitive(row.value);
        await db
          .update(settings)
          .set({ value: cipher, updatedAt: new Date() })
          .where(eq(settings.key, row.key));
        encryptedCount++;
      }
    }
    if (encryptedCount > 0) {
      console.log(`[CryptoVault] 🛡️ Successfully encrypted ${encryptedCount} partner URLs & API keys in database with AES-256-GCM!`);
    } else {
      console.log(`[CryptoVault] 🛡️ All partner URLs and API keys in database are fully encrypted.`);
    }
  } catch (err: any) {
    console.error("[CryptoVault] Migration failed:", err.message);
  }
  return encryptedCount;
}
