import { db } from "./db";
import { sql } from "drizzle-orm";

const DEFAULT_BASE_URL = "https://api.cssx.store";

export interface CssxAccountInfo {
  id?: string | number;
  chat_id?: string | number;
  email?: string;
  username?: string;
  first_name?: string;
  status?: string;
  wallet_balance?: number;
  balance_usdt?: number;
  wallet_usdt?: number;
  balance?: number;
  api_key_prefix?: string;
  [key: string]: any;
}

export interface CssxStats {
  orders: number;
  successful: number;
  failed?: number;
  pending?: number;
  spent_usdt?: number;
  deposits?: {
    today?: number;
    "7d"?: number;
    "30d"?: number;
    "365d"?: number;
    all_time?: number;
  };
  sales?: {
    today?: number;
    "7d"?: number;
    "30d"?: number;
    "365d"?: number;
    all_time?: number;
  };
  [key: string]: any;
}

export interface CssxProduct {
  id: string | number;
  service_id: string | number;
  title: string;
  name: string;
  price_usdt: number;
  price: number;
  cost: number;
  stock: number | string;
  category: string;
  description: string;
  available: boolean;
  raw?: any;
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
    return { apiKey: apiKey.trim(), baseUrl: baseUrl.trim().replace(/\/+$/, "") };
  }

  public static async saveCredentials(apiKey: string, baseUrl?: string): Promise<void> {
    await this.setSetting("CSSX_API_KEY", apiKey.trim());
    if (baseUrl && baseUrl.trim()) {
      await this.setSetting("CSSX_BASE_URL", baseUrl.trim().replace(/\/+$/, ""));
    }
  }

  /**
   * Official CSxStore API request execution
   * Strict header authentication: X-API-Key
   */
  public static async apiRequest(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    payload?: any
  ): Promise<any> {
    const { apiKey, baseUrl } = await this.getCredentials();
    if (!apiKey) {
      throw new Error("CSxStore API Key is not configured. Please enter your API key in settings.");
    }

    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${baseUrl}${cleanPath}`;

    // CSxStore official header specification
    const headers: Record<string, string> = {
      "X-API-Key": apiKey.trim(),
      "Accept": "application/json",
      "User-Agent": "Shopeefy-Bot-Reseller/2026",
    };

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
          `CSxStore API Error (HTTP ${res.status}): ${typeof data === "string" ? data : JSON.stringify(data)}`;
        throw new Error(errMsg);
      }

      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw new Error(err.message || "Failed to reach CSxStore API");
    }
  }

  /**
   * Extract live USDT wallet balance
   */
  public static extractWalletBalance(data: any): number {
    if (!data || typeof data !== "object") return 0;
    if (data.wallet_balance !== undefined && !isNaN(Number(data.wallet_balance))) {
      return Number(data.wallet_balance);
    }
    if (data.balance_usdt !== undefined && !isNaN(Number(data.balance_usdt))) {
      return Number(data.balance_usdt);
    }
    if (data.wallet_usdt !== undefined && !isNaN(Number(data.wallet_usdt))) {
      return Number(data.wallet_usdt);
    }
    if (data.balance !== undefined && !isNaN(Number(data.balance))) {
      return Number(data.balance);
    }
    return 0;
  }

  /**
   * Extract and normalize catalog product items
   */
  public static extractProductsArray(data: any): CssxProduct[] {
    if (!data) return [];

    let rawList: any[] = [];
    if (Array.isArray(data)) {
      rawList = data;
    } else if (Array.isArray(data.services)) {
      rawList = data.services;
    } else if (Array.isArray(data.products)) {
      rawList = data.products;
    } else if (Array.isArray(data.data)) {
      rawList = data.data;
    } else if (Array.isArray(data.result)) {
      rawList = data.result;
    } else if (Array.isArray(data.items)) {
      rawList = data.items;
    }

    const detectCategory = (title: string = ""): string => {
      const lower = title.toLowerCase();
      if (lower.includes("gemini")) return "Gemini AI";
      if (lower.includes("chat gpt") || lower.includes("chatgpt") || lower.includes("openai")) return "OpenAI";
      if (lower.includes("adobe")) return "Adobe";
      if (lower.includes("amazon") || lower.includes("prime")) return "Streaming";
      if (lower.includes("crunchyroll")) return "Anime";
      if (lower.includes("duolingo")) return "Education";
      if (lower.includes("surfshark") || lower.includes("vpn")) return "VPN";
      if (lower.includes("windows") || lower.includes("office") || lower.includes("microsoft")) return "Software";
      if (lower.includes("linkedin")) return "Social Media";
      if (lower.includes("telegram")) return "Telegram";
      if (lower.includes("muse")) return "AI Tools";
      if (lower.includes("gmail") || lower.includes("edu")) return "Email Accounts";
      if (lower.includes("pdf") || lower.includes("ilovepdf")) return "Productivity";
      return "Digital Services";
    };

    return rawList.map((item, index) => {
      const serviceId = item.service_id ?? item.id ?? item.product_id ?? item.code ?? String(index + 1);
      const name = item.name ?? item.title ?? `Service #${serviceId}`;
      const price = typeof item.price === "number" ? item.price : parseFloat(String(item.price || "0")) || 0;
      
      let stockVal: number | string = 0;
      if (item.stock !== undefined && item.stock !== null) {
        stockVal = typeof item.stock === "number" ? item.stock : parseInt(String(item.stock)) || item.stock;
      }

      const description = item.description || item.desc || "";
      const category = item.category || detectCategory(name);

      const isAvail = typeof stockVal === "number" ? stockVal > 0 : stockVal !== "0";

      return {
        id: serviceId,
        service_id: serviceId,
        title: name,
        name: name,
        price_usdt: price,
        price: price,
        cost: price,
        stock: stockVal,
        category,
        description,
        available: isAvail,
        raw: item,
      };
    });
  }

  // GET /api/v1/me
  public static async getMe(): Promise<CssxAccountInfo> {
    const data = await this.apiRequest("GET", "/api/v1/me");
    const wallet = this.extractWalletBalance(data);

    return {
      id: data.chat_id || "1",
      chat_id: data.chat_id,
      username: data.username || "CSxStore Partner",
      first_name: data.first_name || "",
      wallet_balance: wallet,
      balance_usdt: wallet,
      wallet_usdt: wallet,
      balance: wallet,
      api_key_prefix: data.api_key_prefix || "",
      status: "active",
      raw: data,
    };
  }

  // GET /api/v1/stats
  public static async getStats(): Promise<CssxStats> {
    try {
      const data = await this.apiRequest("GET", "/api/v1/stats");
      const depositsAllTime = data.deposits?.all_time || data.deposits?.["30d"] || 0;
      const salesCount = data.sales?.all_time || 0;

      return {
        orders: Number(salesCount),
        successful: Number(salesCount),
        spent_usdt: Number(depositsAllTime),
        deposits: data.deposits || {},
        sales: data.sales || {},
        raw: data,
      };
    } catch {
      return { orders: 0, successful: 0, spent_usdt: 0 };
    }
  }

  // GET /api/v1/products
  public static async getProducts(): Promise<CssxProduct[]> {
    const data = await this.apiRequest("GET", "/api/v1/products");
    return this.extractProductsArray(data);
  }

  // POST /api/v1/order
  public static async createOrder(orderPayload: {
    service_id?: string | number;
    product_id?: string | number;
    quantity?: number;
    [key: string]: any;
  }): Promise<any> {
    const sId = String(orderPayload.service_id || orderPayload.product_id || "");
    const qty = Number(orderPayload.quantity || 1);

    if (!sId) {
      throw new Error("service_id or product_id is required to create CSxStore order.");
    }

    return await this.apiRequest("POST", "/api/v1/order", {
      service_id: sId,
      quantity: qty,
    });
  }

  // POST /api/v1/batch-order
  public static async createBatchOrder(ordersList: any[]): Promise<any> {
    return await this.apiRequest("POST", "/api/v1/batch-order", { orders: ordersList });
  }

  // GET /api/v1/orders
  public static async getOrders(): Promise<any[]> {
    const data = await this.apiRequest("GET", "/api/v1/orders");
    if (Array.isArray(data.orders)) return data.orders;
    if (Array.isArray(data)) return data;
    return [];
  }

  // GET /api/v1/order/{id}
  public static async getOrderById(orderId: string | number): Promise<any> {
    return await this.apiRequest("GET", `/api/v1/order/${orderId}`);
  }

  // Diagnostic Test Connection
  public static async testConnection(): Promise<{
    connected: boolean;
    latencyMs: number;
    baseUrl: string;
    account: CssxAccountInfo | null;
    walletUsdt: number;
    productCount: number;
    statusMessage: string;
    raw?: any;
    error?: string;
  }> {
    const startTime = Date.now();
    const creds = await this.getCredentials();

    if (!creds.apiKey) {
      return {
        connected: false,
        latencyMs: 0,
        baseUrl: creds.baseUrl,
        account: null,
        walletUsdt: 0,
        productCount: 0,
        statusMessage: "No API key configured",
        error: "Please enter your CSxStore secret API key in settings.",
      };
    }

    try {
      const me = await this.getMe();
      const latencyMs = Date.now() - startTime;

      let productCount = 0;
      try {
        const products = await this.getProducts();
        productCount = products.length;
      } catch (pErr: any) {
        console.warn("[CSSX Test Connection] Products fetch notice:", pErr.message);
      }

      return {
        connected: true,
        latencyMs,
        baseUrl: creds.baseUrl,
        account: me,
        walletUsdt: me.wallet_balance || me.balance_usdt || 0,
        productCount,
        statusMessage: "Connected & Active",
        raw: me.raw,
      };
    } catch (err: any) {
      return {
        connected: false,
        latencyMs: Date.now() - startTime,
        baseUrl: creds.baseUrl,
        account: null,
        walletUsdt: 0,
        productCount: 0,
        statusMessage: "Connection Error",
        error: err.message || "Failed to communicate with CSxStore API",
      };
    }
  }
}
