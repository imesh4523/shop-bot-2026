import axios from "axios";
import { storage } from "./storage";

export interface SocialPanelServiceItem {
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

export interface SocialPanelOrderStatus {
  charge?: string;
  start_count?: string;
  status: string;
  remains?: string;
  currency?: string;
  error?: string;
}

export class SocialPanelService {
  private static async getConfig() {
    const keySetting = await storage.getSetting("SOCIALPANEL_API_KEY");
    const urlSetting = await storage.getSetting("SOCIALPANEL_API_URL");
    const apiKey = keySetting?.value?.trim() || "";
    const apiUrl = urlSetting?.value?.trim() || "https://socialpanel.pro/api/v2";
    return { apiKey, apiUrl };
  }

  // 1. Check Account Balance
  static async getBalance(): Promise<{ balance: number; currency: string } | { error: string }> {
    const { apiKey, apiUrl } = await this.getConfig();
    if (!apiKey) return { error: "SocialPanel.pro API Key is not configured." };

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
      return { error: response.data?.error || "Invalid response from SocialPanel.pro" };
    } catch (err: any) {
      console.error("[SocialPanel] getBalance error:", err.message);
      return { error: err.response?.data?.error || err.message || "Failed to connect to SocialPanel.pro" };
    }
  }

  // 2. Fetch All Services from SocialPanel.pro
  static async getServices(): Promise<SocialPanelServiceItem[]> {
    const { apiKey, apiUrl } = await this.getConfig();
    if (!apiKey) throw new Error("SocialPanel.pro API Key is not configured.");

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
      console.error("[SocialPanel] getServices error:", err.message);
      throw new Error(err.response?.data?.error || err.message || "Failed to fetch services from SocialPanel.pro");
    }
  }

  // 3. Create / Submit Order to SocialPanel.pro
  static async createOrder(
    serviceId: string | number,
    link: string,
    quantity: number,
    extraParams?: Record<string, any>
  ): Promise<{ order: number } | { error: string }> {
    const { apiKey, apiUrl } = await this.getConfig();
    if (!apiKey) return { error: "SocialPanel.pro API Key is not configured." };

    try {
      const params: Record<string, any> = {
        key: apiKey,
        action: "add",
        service: serviceId,
        link: link.trim(),
        quantity: quantity,
        ...extraParams,
      };

      const response = await axios.post(apiUrl, null, {
        params,
        timeout: 15000,
      });

      if (response.data && response.data.order) {
        return { order: Number(response.data.order) };
      }
      return { error: response.data?.error || "Failed to place order on SocialPanel.pro." };
    } catch (err: any) {
      console.error("[SocialPanel] createOrder error:", err.message);
      return { error: err.response?.data?.error || err.message || "Failed to place order on SocialPanel.pro." };
    }
  }

  // 4. Query Single Order Status
  static async getOrderStatus(orderId: string | number): Promise<SocialPanelOrderStatus | null> {
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
      console.error(`[SocialPanel] getOrderStatus #${orderId} error:`, err.message);
      return null;
    }
  }

  // 5. Query Multiple Orders Status
  static async getMultiOrderStatus(orderIds: (string | number)[]): Promise<Record<string, SocialPanelOrderStatus>> {
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

      if (typeof response.data === "object" && !Array.isArray(response.data)) {
        return response.data;
      }
      return {};
    } catch (err: any) {
      console.error("[SocialPanel] getMultiOrderStatus error:", err.message);
      return {};
    }
  }

  // 6. Create Refill
  static async createRefill(orderId: string | number): Promise<{ refill: string } | { error: string }> {
    const { apiKey, apiUrl } = await this.getConfig();
    if (!apiKey) return { error: "SocialPanel.pro API Key is not configured." };

    try {
      const response = await axios.post(apiUrl, null, {
        params: {
          key: apiKey,
          action: "refill",
          order: orderId,
        },
        timeout: 10000,
      });

      if (response.data && response.data.refill) {
        return { refill: String(response.data.refill) };
      }
      return { error: response.data?.error || "Failed to create refill on SocialPanel.pro." };
    } catch (err: any) {
      return { error: err.response?.data?.error || err.message || "Refill request failed." };
    }
  }

  // 7. Test Connection with configured or custom API key
  static async testConnection(customKey?: string, customUrl?: string): Promise<{ success: boolean; balance?: number; currency?: string; error?: string }> {
    const { apiKey: defKey, apiUrl: defUrl } = await this.getConfig();
    const key = customKey?.trim() || defKey;
    const url = customUrl?.trim() || defUrl;

    if (!key) return { success: false, error: "API Key is required to test connection." };

    try {
      const response = await axios.post(url, null, {
        params: {
          key,
          action: "balance",
        },
        timeout: 10000,
      });

      if (response.data && response.data.balance !== undefined) {
        return {
          success: true,
          balance: parseFloat(response.data.balance),
          currency: response.data.currency || "USD",
        };
      }
      return { success: false, error: response.data?.error || "Invalid response format from server." };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || err.message || "Connection failed." };
    }
  }
}
