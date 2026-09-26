import { db } from "./db";
import { sql } from "drizzle-orm";

const DEFAULT_BASE_URL = "https://api.cssx.store";

export interface CssxAccountInfo {
  id?: string | number;
  email?: string;
  username?: string;
  status?: string;
  balance_usdt?: number;
  wallet_usdt?: number;
  created_at?: string;
  [key: string]: any;
}

export interface CssxStats {
  orders: number;
  successful: number;
  failed?: number;
  pending?: number;
  spent_usdt?: number;
  [key: string]: any;
}

export class CssxService {
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

  public static async getCredentials(): Promise<{ apiKey: string; baseUrl: string }> {
    const apiKey = (await this.getSetting("CSSX_API_KEY")) || process.env.CSSX_API_KEY || "";
    const baseUrl = (await this.getSetting("CSSX_BASE_URL")) || process.env.CSSX_BASE_URL || DEFAULT_BASE_URL;
    return { apiKey, baseUrl: baseUrl.replace(/\/$/, "") };
  }

  public static async saveCredentials(apiKey: string, baseUrl?: string): Promise<void> {
    await this.setSetting("CSSX_API_KEY", apiKey.trim());
    if (baseUrl) {
      await this.setSetting("CSSX_BASE_URL", baseUrl.trim().replace(/\/$/, ""));
    }
  }

  public static async apiRequest(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    payload?: any
  ): Promise<any> {
    const { apiKey, baseUrl } = await this.getCredentials();
    if (!apiKey) {
      throw new Error("CSxStore API Key (X-API-Key) is not configured in settings.");
    }

    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${baseUrl}${cleanPath}`;

    const headers: Record<string, string> = {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Shopeefy-Bot-Reseller/2026"
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (payload && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(payload);
    }

    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.message || data?.error || data?.detail || `HTTP Error ${res.status}`;
      throw new Error(errMsg);
    }

    return data;
  }

  // GET /api/v1/me
  public static async getMe(): Promise<CssxAccountInfo> {
    return await this.apiRequest("GET", "/api/v1/me");
  }

  // GET /api/v1/stats
  public static async getStats(): Promise<CssxStats> {
    try {
      const data = await this.apiRequest("GET", "/api/v1/stats");
      return {
        orders: Number(data.orders ?? data.total_orders ?? 0),
        successful: Number(data.successful ?? data.successful_orders ?? data.completed ?? 0),
        failed: Number(data.failed ?? 0),
        pending: Number(data.pending ?? 0),
        spent_usdt: Number(data.spent_usdt ?? data.total_spent ?? 0),
        ...data
      };
    } catch {
      return { orders: 0, successful: 0, spent_usdt: 0 };
    }
  }

  // GET /api/v1/products
  public static async getProducts(): Promise<any[]> {
    const data = await this.apiRequest("GET", "/api/v1/products");
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.products)) return data.products;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }

  // POST /api/v1/order
  public static async createOrder(orderPayload: { product_id: string | number; quantity?: number; custom_data?: any }): Promise<any> {
    return await this.apiRequest("POST", "/api/v1/order", orderPayload);
  }

  // POST /api/v1/batch-order
  public static async createBatchOrder(ordersList: any[]): Promise<any> {
    return await this.apiRequest("POST", "/api/v1/batch-order", { orders: ordersList });
  }

  // GET /api/v1/orders
  public static async getOrders(): Promise<any[]> {
    const data = await this.apiRequest("GET", "/api/v1/orders");
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.orders)) return data.orders;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }

  // GET /api/v1/order/{id}
  public static async getOrderById(orderId: string | number): Promise<any> {
    return await this.apiRequest("GET", `/api/v1/order/${orderId}`);
  }
}
