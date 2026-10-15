import crypto from "node:crypto";
import { db } from "./db";
import { sql } from "drizzle-orm";
import axios from "axios";

const DEFAULT_BASE_URL = "https://canboso.com";

export interface CanbosoBalanceInfo {
  success: boolean;
  walletCurrency?: string;
  balance?: number;
  balanceUsd?: number;
  balanceVnd?: number;
  balanceText?: string;
  usdtBalance?: number;
  usdRate?: number;
  botSource?: string;
  requester?: {
    chatId: number;
    name: string;
  };
  updatedAt?: string;
  error?: string;
}

export interface CanbosoProductItem {
  productId: string;
  name: string;
  description?: string;
  image?: string;
  emoji?: string;
  productType: "account" | "slot" | "upgrade_account" | string;
  price: {
    amount: number;
    currency: string;
    text: string;
  };
  availability?: {
    available?: number | null;
    sold?: number;
  };
  promotions?: any[];
  purchaseRequirements?: {
    customerEmail?: boolean;
    customerAccounts?: boolean;
    slotMonths?: boolean;
    quantityFixed?: number;
    allowedMonths?: number[];
  };
}

export interface CanbosoPurchaseParams {
  productId: string;
  quantity?: number;
  customerEmail?: string;
  customerAccounts?: string[];
  slotMonths?: number;
  idempotencyKey?: string;
}

export class CanbosoService {
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
    const apiKey = (await this.getSetting("CANBOSO_API_KEY")) || process.env.CANBOSO_API_KEY || "";
    const baseUrl = (await this.getSetting("CANBOSO_BASE_URL")) || process.env.CANBOSO_BASE_URL || DEFAULT_BASE_URL;
    return { apiKey: apiKey.trim(), baseUrl: baseUrl.trim().replace(/\/+$/, "") };
  }

  public static async saveCredentials(apiKey: string, baseUrl?: string): Promise<void> {
    await this.setSetting("CANBOSO_API_KEY", apiKey.trim());
    if (baseUrl) {
      await this.setSetting("CANBOSO_BASE_URL", baseUrl.trim().replace(/\/+$/, ""));
    }
  }

  public static async getHealth(): Promise<{ ok: boolean; message: string; balance?: CanbosoBalanceInfo }> {
    try {
      const { apiKey } = await this.getCredentials();
      if (!apiKey) {
        return { ok: false, message: "Canboso Buyer Key is not configured in settings." };
      }
      const balance = await this.getBalance();
      if (balance.success) {
        return { ok: true, message: "Connected to Canboso Buyer API v2", balance };
      }
      return { ok: false, message: balance.error || "Failed to authenticate with Canboso API." };
    } catch (err: any) {
      return { ok: false, message: err.message || "Failed to reach Canboso API." };
    }
  }

  public static async getBalance(): Promise<CanbosoBalanceInfo> {
    const { apiKey, baseUrl } = await this.getCredentials();
    if (!apiKey) {
      return { success: false, error: "Canboso API Key is not configured." };
    }

    try {
      const res = await axios.get(`${baseUrl}/api/v2/telegram-buyer/balance`, {
        params: { key: apiKey },
        headers: {
          "x-buyer-key": apiKey,
          "User-Agent": "ShopBot-Hub/2.0"
        },
        timeout: 10000
      });

      if (res.data?.success) {
        return res.data;
      }
      return {
        success: false,
        error: res.data?.message || "Failed to retrieve Canboso wallet balance."
      };
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || "Canboso balance request failed.";
      return { success: false, error: errMsg };
    }
  }

  public static async getProducts(): Promise<CanbosoProductItem[]> {
    const { apiKey, baseUrl } = await this.getCredentials();
    if (!apiKey) {
      throw new Error("Canboso API Key is not configured in settings.");
    }

    try {
      const res = await axios.get(`${baseUrl}/api/v2/telegram-buyer/products`, {
        params: { key: apiKey },
        headers: {
          "x-buyer-key": apiKey,
          "User-Agent": "ShopBot-Hub/2.0"
        },
        timeout: 15000
      });

      if (res.data?.success && Array.isArray(res.data.products)) {
        return res.data.products;
      }
      throw new Error(res.data?.message || "Failed to fetch Canboso products.");
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || "Canboso products request failed.";
      throw new Error(errMsg);
    }
  }

  public static async purchase(params: CanbosoPurchaseParams): Promise<{
    success: boolean;
    orderCode?: string;
    productName?: string;
    deliveryText?: string;
    accounts?: any[];
    raw?: any;
    error?: string;
  }> {
    const { apiKey, baseUrl } = await this.getCredentials();
    if (!apiKey) {
      throw new Error("Canboso API Key is not configured in settings.");
    }

    const idempotencyKey = params.idempotencyKey || `canboso-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;

    const payload: any = {
      key: apiKey,
      product_id: params.productId,
      quantity: params.quantity || 1
    };

    if (params.customerEmail) {
      payload.customer_email = params.customerEmail;
    }
    if (params.customerAccounts && params.customerAccounts.length > 0) {
      payload.customer_accounts = params.customerAccounts;
    }
    if (params.slotMonths) {
      payload.slot_months = params.slotMonths;
    }

    try {
      const res = await axios.post(`${baseUrl}/api/v2/telegram-buyer/purchase`, payload, {
        headers: {
          "x-buyer-key": apiKey,
          "Idempotency-Key": idempotencyKey,
          "Content-Type": "application/json",
          "User-Agent": "ShopBot-Hub/2.0"
        },
        timeout: 25000
      });

      const data = res.data;
      if (data?.success) {
        let deliveryText = "";
        if (data.delivery?.accounts && Array.isArray(data.delivery.accounts)) {
          deliveryText = data.delivery.accounts
            .map((acc: any) => {
              const lines = [];
              if (acc.user) lines.push(`User/Email: ${acc.user}`);
              if (acc.password) lines.push(`Password: ${acc.password}`);
              if (acc.verifyEmail) lines.push(`Recovery: ${acc.verifyEmail}`);
              return lines.join(" | ");
            })
            .join("\n");
        } else if (data.order?.fulfillmentStatus) {
          deliveryText = `Fulfillment Status: ${data.order.fulfillmentStatus} (Code: ${data.order.orderCode || 'N/A'})`;
        }

        return {
          success: true,
          orderCode: data.order?.orderCode,
          productName: data.order?.productName,
          deliveryText,
          accounts: data.delivery?.accounts || [],
          raw: data
        };
      }

      throw new Error(data?.message || "Canboso purchase was rejected.");
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || "Canboso purchase request failed.";
      throw new Error(errMsg);
    }
  }

  public static async getOrders(orderCode?: string): Promise<any[]> {
    const { apiKey, baseUrl } = await this.getCredentials();
    if (!apiKey) return [];

    try {
      const res = await axios.get(`${baseUrl}/api/v2/telegram-buyer/orders`, {
        params: orderCode ? { key: apiKey, orderCode } : { key: apiKey },
        headers: {
          "x-buyer-key": apiKey,
          "User-Agent": "ShopBot-Hub/2.0"
        },
        timeout: 10000
      });

      if (res.data?.success && Array.isArray(res.data.orders)) {
        return res.data.orders;
      }
      return [];
    } catch {
      return [];
    }
  }
}
