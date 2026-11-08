import { db } from "./db";
import { sql } from "drizzle-orm";
import { encryptSensitive, decryptSensitive, isEncrypted } from "./crypto-vault";

const DEFAULT_BASE_URL = "https://tunvnmmo.duckdns.org";

export interface TunvnProduct {
  id: number;
  name: string;
  category?: string;
  price_vnd?: number;
  price_usdt?: number;
  stock?: number;
  description?: string;
  [key: string]: any;
}

export interface TunvnBalanceInfo {
  success?: boolean;
  balance_vnd?: number;
  balance_usdt?: number;
  [key: string]: any;
}

export class TunvnService {
  private static async getSetting(key: string): Promise<string | null> {
    try {
      const res = await db.execute(sql`SELECT value FROM settings WHERE key = ${key} LIMIT 1`);
      if (res.rows && res.rows.length > 0) {
        const raw = (res.rows[0] as any).value || null;
        return isEncrypted(raw) ? decryptSensitive(raw) : raw;
      }
      return null;
    } catch {
      return null;
    }
  }

  private static async setSetting(key: string, value: string): Promise<void> {
    const cipherVal = !isEncrypted(value) ? encryptSensitive(value) : value;
    await db.execute(sql`
      INSERT INTO settings (key, value)
      VALUES (${key}, ${cipherVal})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `);
  }

  public static async getCredentials(): Promise<{ apiKey: string; baseUrl: string }> {
    const apiKey = (await this.getSetting("TUNVN_API_KEY")) || process.env.TUNVN_API_KEY || "";
    const baseUrl = (await this.getSetting("TUNVN_BASE_URL")) || process.env.TUNVN_BASE_URL || DEFAULT_BASE_URL;
    return { apiKey: apiKey.trim(), baseUrl: baseUrl.trim().replace(/\/+$/, "") };
  }

  public static async saveCredentials(apiKey: string, baseUrl?: string): Promise<void> {
    await this.setSetting("TUNVN_API_KEY", apiKey.trim());
    if (baseUrl && baseUrl.trim()) {
      await this.setSetting("TUNVN_BASE_URL", baseUrl.trim().replace(/\/+$/, ""));
    }
  }

  public static async apiRequest(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    payload?: any
  ): Promise<any> {
    const { apiKey, baseUrl } = await this.getCredentials();
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${baseUrl}${cleanPath}`;

    const headers: Record<string, string> = {
      "Accept": "application/json",
      "User-Agent": "Shopeefy-Bot-Reseller/2026",
    };

    if (apiKey) {
      headers["X-API-Key"] = apiKey.trim();
    }

    if (payload && (method === "POST" || method === "PUT")) {
      headers["Content-Type"] = "application/json";
    }

    const options: RequestInit = {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    options.signal = controller.signal;

    try {
      const res = await fetch(url, options);
      clearTimeout(timeoutId);

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }

      if (!res.ok) {
        const errMsg =
          data?.error ||
          data?.message ||
          data?.detail ||
          `TunVN API Error (HTTP ${res.status}): ${typeof data === "string" ? data : JSON.stringify(data)}`;
        throw new Error(errMsg);
      }

      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw new Error(err.message || "Failed to reach TunVN API");
    }
  }

  public static async getBalance(): Promise<TunvnBalanceInfo> {
    return await this.apiRequest("GET", "/api/balance");
  }

  public static async getRate(): Promise<any> {
    return await this.apiRequest("GET", "/api/rate");
  }

  public static async fetchProducts(): Promise<TunvnProduct[]> {
    const data = await this.apiRequest("GET", "/api/products");
    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray(data.products)) {
      return data.products;
    }
    if (data && Array.isArray(data.data)) {
      return data.data;
    }
    if (data && Array.isArray(data.items)) {
      return data.items;
    }
    return [];
  }

  public static async buyProduct(
    productId: number | string,
    quantity: number = 1,
    currency: "usdt" | "vnd" = "usdt"
  ): Promise<any> {
    return await this.apiRequest("POST", "/api/buy", {
      product_id: Number(productId),
      quantity: Number(quantity),
      currency: currency.toLowerCase(),
    });
  }

  public static async getOrders(): Promise<any[]> {
    const data = await this.apiRequest("GET", "/api/orders");
    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray(data.orders)) {
      return data.orders;
    }
    return [];
  }

  public static async createDeposit(amount: number, currency: "usdt" = "usdt"): Promise<any> {
    return await this.apiRequest("POST", "/api/deposit", {
      amount: Number(amount),
      currency: "usdt",
    });
  }

  public static async checkDepositStatus(paymentCode: string): Promise<any> {
    return await this.apiRequest("GET", `/api/deposit/status?code=${encodeURIComponent(paymentCode)}`);
  }
}

