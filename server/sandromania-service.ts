import crypto from "node:crypto";
import { db } from "./db";
import { sql } from "drizzle-orm";

const BASE_URL = "https://api.sandromania.shop";

export class SandromaniaService {
  private static async getSetting(key: string): Promise<string | null> {
    try {
      const res = await db.execute(sql`SELECT value FROM settings WHERE key = ${key} LIMIT 1`);
      if (res.rows && res.rows.length > 0) {
        return (res.rows[0] as any).value || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  private static async setSetting(key: string, value: string): Promise<void> {
    await db.execute(sql`
      INSERT INTO settings (key, value)
      VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `);
  }

  public static async getCredentials(): Promise<{ apiKey: string; apiSecret: string }> {
    const apiKey = (await this.getSetting("SANDROMANIA_API_KEY")) || process.env.SANDROMANIA_API_KEY || "";
    const apiSecret = (await this.getSetting("SANDROMANIA_API_SECRET")) || process.env.SANDROMANIA_API_SECRET || "";
    return { apiKey, apiSecret };
  }

  public static async saveCredentials(apiKey: string, apiSecret: string): Promise<void> {
    await this.setSetting("SANDROMANIA_API_KEY", apiKey.trim());
    await this.setSetting("SANDROMANIA_API_SECRET", apiSecret.trim());
  }

  public static async partnerRequest(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    payload?: any,
    idempotencyKey?: string
  ): Promise<any> {
    const { apiKey, apiSecret } = await this.getCredentials();
    if (!apiKey || !apiSecret) {
      throw new Error("Sandromania API Key and Secret are not configured in settings.");
    }

    const body = payload ? JSON.stringify(payload) : "";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = crypto.randomBytes(18).toString("hex");
    const signed = `${timestamp}.${nonce}.${method.toUpperCase()}.${path}.${body}`;
    const signature = crypto.createHmac("sha256", apiSecret).update(signed, "utf8").digest("hex").toLowerCase();

    const headers: Record<string, string> = {
      "X-Api-Key": apiKey,
      "X-Timestamp": timestamp,
      "X-Nonce": nonce,
      "X-Signature": signature,
      "Content-Type": "application/json",
    };

    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: payload ? body : undefined,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errDetail = data?.message || data?.error || JSON.stringify(data);
      throw new Error(`Sandromania API Error (${res.status}): ${errDetail}`);
    }

    return data;
  }

  public static async getHealth(): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/health`);
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok && data?.ok !== false, message: data?.status || "API Online" };
    } catch (err: any) {
      return { ok: false, message: err.message || "Failed to reach Sandromania API" };
    }
  }

  public static async getBalance(): Promise<{ balance_rub: number; balance_usd: number }> {
    const data = await this.partnerRequest("GET", "/api/v1/balance");
    return {
      balance_rub: Number(data.balance_rub || 0),
      balance_usd: Number(data.balance_usd || 0),
    };
  }

  public static async getProducts(): Promise<any[]> {
    const data = await this.partnerRequest("GET", "/api/v1/products");
    if (data && Array.isArray(data.products)) {
      return data.products;
    }
    return [];
  }

  public static async createOrder(
    productId: number,
    quantity: number,
    idempotencyKey?: string
  ): Promise<any> {
    const key = idempotencyKey || `shop-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    const data = await this.partnerRequest(
      "POST",
      "/api/v1/orders",
      { product_id: productId, quantity },
      key
    );
    return data;
  }

  public static async getOrder(orderId: number): Promise<any> {
    const data = await this.partnerRequest("GET", `/api/v1/orders/${orderId}`);
    return data;
  }
}
