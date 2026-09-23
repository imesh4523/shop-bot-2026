import axios from "axios";
import { storage } from "./storage";

export interface N1PanelServiceItem {
  service: string | number;
  name: string;
  type: string;
  category: string;
  rate: string | number;
  min: string | number;
  max: string | number;
  dripfeed?: boolean;
  refill?: boolean;
  cancel?: boolean;
}

export interface N1PanelOrderStatus {
  charge?: string;
  start_count?: string;
  status: string;
  remains?: string;
  currency?: string;
  error?: string;
}

export class N1PanelService {
  private static async getConfig() {
    const keySetting = await storage.getSetting("N1PANEL_API_KEY");
    const urlSetting = await storage.getSetting("N1PANEL_API_URL");
    const apiKey = keySetting?.value?.trim() || "";
    const apiUrl = urlSetting?.value?.trim() || "https://n1panel.com/api/v2";
    return { apiKey, apiUrl };
  }

  // 1. Check Account Balance
  static async getBalance(): Promise<{ balance: number; currency: string } | { error: string }> {
    const { apiKey, apiUrl } = await this.getConfig();
    if (!apiKey) return { error: "N1Panel API Key is not configured." };

    try {
      const response = await axios.post(apiUrl, null, {
        params: {
          key: apiKey,
          action: "balance",
        },
        timeout: 10000,
      });

      if (response.data && response.data.balance !== undefined) {
        return {
          balance: parseFloat(response.data.balance),
          currency: response.data.currency || "USD",
        };
      }
      return { error: response.data?.error || "Invalid response from N1Panel" };
    } catch (err: any) {
      console.error("[N1Panel] getBalance error:", err.message);
      return { error: err.response?.data?.error || err.message || "Failed to connect to N1Panel" };
    }
  }

  // 2. Fetch All Services from N1Panel
  static async getServices(): Promise<N1PanelServiceItem[]> {
    const { apiKey, apiUrl } = await this.getConfig();
    if (!apiKey) throw new Error("N1Panel API Key is not configured.");

    try {
      const response = await axios.post(apiUrl, null, {
        params: {
          key: apiKey,
          action: "services",
        },
        timeout: 15000,
      });

      if (Array.isArray(response.data)) {
        return response.data;
      }
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      return [];
    } catch (err: any) {
      console.error("[N1Panel] getServices error:", err.message);
      throw new Error(err.response?.data?.error || err.message || "Failed to fetch services from N1Panel");
    }
  }

  // 3. Create / Submit Order to N1Panel
  static async createOrder(
    serviceId: string | number,
    link: string,
    quantity: number
  ): Promise<{ order: number } | { error: string }> {
    const { apiKey, apiUrl } = await this.getConfig();
    if (!apiKey) return { error: "N1Panel API Key is not configured." };

    try {
      const response = await axios.post(apiUrl, null, {
        params: {
          key: apiKey,
          action: "add",
          service: serviceId,
          link: link.trim(),
          quantity: quantity,
        },
        timeout: 15000,
      });

      if (response.data && response.data.order) {
        return { order: Number(response.data.order) };
      }
      return { error: response.data?.error || "Failed to place order on N1Panel." };
    } catch (err: any) {
      console.error("[N1Panel] createOrder error:", err.message);
      return { error: err.response?.data?.error || err.message || "Failed to place order on N1Panel." };
    }
  }

  // 4. Query Single Order Status
  static async getOrderStatus(orderId: string | number): Promise<N1PanelOrderStatus | null> {
    const { apiKey, apiUrl } = await this.getConfig();
    if (!apiKey) return null;

    try {
      const response = await axios.post(apiUrl, null, {
        params: {
          key: apiKey,
          action: "status",
          order: orderId,
        },
        timeout: 10000,
      });

      return response.data;
    } catch (err: any) {
      console.error(`[N1Panel] getOrderStatus #${orderId} error:`, err.message);
      return null;
    }
  }

  // 5. Query Multiple Orders Status
  static async getMultiOrderStatus(orderIds: (string | number)[]): Promise<Record<string, N1PanelOrderStatus>> {
    const { apiKey, apiUrl } = await this.getConfig();
    if (!apiKey || orderIds.length === 0) return {};

    try {
      const response = await axios.post(apiUrl, null, {
        params: {
          key: apiKey,
          action: "status",
          orders: orderIds.join(","),
        },
        timeout: 15000,
      });

      return response.data || {};
    } catch (err: any) {
      console.error("[N1Panel] getMultiOrderStatus error:", err.message);
      return {};
    }
  }
}
