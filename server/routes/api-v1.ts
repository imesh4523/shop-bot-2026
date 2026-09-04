import { Router, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { products, orders, credentials, apiKeys, telegramUsers, preorders } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const apiV1Router = Router();

// Middleware to authenticate X-API-Key
interface AuthenticatedApiRequest extends Request {
  apiKey?: typeof apiKeys.$inferSelect;
  telegramUser?: typeof telegramUsers.$inferSelect;
}

async function authenticateApiKey(req: AuthenticatedApiRequest, res: Response, next: NextFunction) {
  const authHeader = req.header("X-API-Key") || (req.query.api_key as string);
  
  if (!authHeader) {
    return res.status(401).json({
      error: "unauthorized",
      message: "Missing API Key. Provide key in 'X-API-Key' header.",
      statusCode: 401
    });
  }

  const apiKeyRecord = await storage.getApiKeyByKey(authHeader.trim());
  if (!apiKeyRecord) {
    return res.status(401).json({
      error: "unauthorized",
      message: "Invalid API Key.",
      statusCode: 401
    });
  }

  if (apiKeyRecord.status === "revoked") {
    return res.status(403).json({
      error: "forbidden",
      message: "This API Key has been revoked.",
      statusCode: 403
    });
  }

  const [tgUser] = await db.select().from(telegramUsers).where(eq(telegramUsers.id, apiKeyRecord.telegramUserId));
  if (!tgUser) {
    return res.status(404).json({
      error: "user_not_found",
      message: "Associated Telegram user not found.",
      statusCode: 404
    });
  }

  if (tgUser.isBanned) {
    return res.status(403).json({
      error: "user_banned",
      message: "User account is suspended.",
      statusCode: 403
    });
  }

  req.apiKey = apiKeyRecord;
  req.telegramUser = tgUser;
  next();
}

// Apply auth middleware to all /api/v1 routes
apiV1Router.use(authenticateApiKey as any);

/**
 * GET /api/v1/me
 * User profile & balance information
 */
apiV1Router.get("/me", async (req: AuthenticatedApiRequest, res: Response) => {
  try {
    const user = req.telegramUser!;
    const balanceUsd = (user.balance / 100).toFixed(2);
    
    return res.json({
      success: true,
      data: {
        id: user.id,
        telegram_id: user.telegramId,
        username: user.username || null,
        first_name: user.firstName || null,
        balance_cents: user.balance,
        balance_usd: balanceUsd,
        currency: user.selectedCurrency || "USD",
        referral_balance_cents: user.referralBalance || 0,
        created_at: user.createdAt
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/products
 * List available products with prices and stock count
 */
apiV1Router.get("/products", async (req: AuthenticatedApiRequest, res: Response) => {
  try {
    const allProducts = await storage.getProducts();
    
    const results = await Promise.all(allProducts.map(async (prod) => {
      const availCreds = await storage.getCredentialsByProduct(prod.id);
      const stockCount = availCreds.filter(c => c.status === "available").length;
      const priceUsd = (prod.price / 100).toFixed(2);

      return {
        id: prod.id,
        name: prod.name,
        description: prod.description || "",
        category: prod.type,
        price_cents: prod.price,
        price_usd: priceUsd,
        status: prod.status,
        stock: stockCount,
        is_in_stock: stockCount > 0,
        is_preorder_enabled: prod.isPreorderEnabled,
        preorder_quota: prod.preorderQuota
      };
    }));

    return res.json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/order
 * Place a single purchase order
 */
apiV1Router.post("/order", async (req: AuthenticatedApiRequest, res: Response) => {
  try {
    const { product_id, quantity = 1 } = req.body;

    if (!product_id || typeof product_id !== "number") {
      return res.status(400).json({
        success: false,
        error: "invalid_params",
        message: "product_id is required and must be a number."
      });
    }

    const prod = await storage.getProduct(product_id);
    if (!prod) {
      return res.status(404).json({
        success: false,
        error: "product_not_found",
        message: `Product with ID ${product_id} does not exist.`
      });
    }

    const qtyInt = Math.max(1, Math.floor(Number(quantity) || 1));
    const totalCost = prod.price * qtyInt;
    const user = req.telegramUser!;

    if (user.balance < totalCost) {
      await storage.updateApiKeyStats(req.apiKey!.id, false, 0);
      return res.status(400).json({
        success: false,
        error: "insufficient_balance",
        message: `Insufficient balance. Required: $${(totalCost / 100).toFixed(2)}, Available: $${(user.balance / 100).toFixed(2)}.`
      });
    }

    // Try instant fulfillment
    const availableCreds = await storage.getCredentialsByProduct(prod.id);
    const inStockCreds = availableCreds.filter(c => c.status === "available");

    if (inStockCreds.length >= qtyInt) {
      // Complete purchase
      const fulfilledCreds: string[] = [];
      const createdOrders: any[] = [];

      for (let i = 0; i < qtyInt; i++) {
        const cred = inStockCreds[i];
        await storage.markCredentialSold(cred.id);
        
        const newOrder = await storage.createOrder({
          productId: prod.id,
          credentialId: cred.id,
          telegramUserId: user.id,
          apiKeyId: req.apiKey!.id,
          status: "completed"
        });

        fulfilledCreds.push(cred.content);
        createdOrders.push(newOrder);
      }

      await storage.deductBalance(user.id, totalCost);
      await storage.updateApiKeyStats(req.apiKey!.id, true, totalCost);

      return res.json({
        success: true,
        type: "instant",
        message: "Order completed successfully.",
        data: {
          order_ids: createdOrders.map(o => o.id),
          product_name: prod.name,
          quantity: qtyInt,
          total_price_usd: (totalCost / 100).toFixed(2),
          delivered_items: fulfilledCreds,
          created_at: new Date()
        }
      });
    } else if (prod.isPreorderEnabled) {
      // Pre-order fulfillment path
      const preorderItem = await storage.createPreorder({
        productId: prod.id,
        telegramUserId: user.id,
        amount: totalCost,
        status: "pending_fulfillment"
      });

      await storage.deductBalance(user.id, totalCost);
      await storage.updateApiKeyStats(req.apiKey!.id, true, totalCost);

      return res.json({
        success: true,
        type: "preorder",
        message: "Product is out of stock. Pre-order placed successfully and queued for admin fulfillment.",
        data: {
          preorder_id: preorderItem.id,
          product_name: prod.name,
          quantity: qtyInt,
          total_price_usd: (totalCost / 100).toFixed(2),
          status: "pending_fulfillment",
          created_at: preorderItem.createdAt
        }
      });
    } else {
      await storage.updateApiKeyStats(req.apiKey!.id, false, 0);
      return res.status(400).json({
        success: false,
        error: "out_of_stock",
        message: `Product is out of stock and pre-orders are disabled.`
      });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/batch-order
 * Place multiple orders in batch
 */
apiV1Router.post("/batch-order", async (req: AuthenticatedApiRequest, res: Response) => {
  try {
    const { orders: orderList } = req.body;

    if (!Array.isArray(orderList) || orderList.length === 0) {
      return res.status(400).json({
        success: false,
        error: "invalid_params",
        message: "orders must be a non-empty array of { product_id, quantity }."
      });
    }

    const results: any[] = [];
    let grandTotalCents = 0;

    for (const item of orderList) {
      const prod = await storage.getProduct(item.product_id);
      if (!prod) {
        results.push({ product_id: item.product_id, success: false, error: "product_not_found" });
        continue;
      }

      const qtyInt = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const cost = prod.price * qtyInt;
      const user = req.telegramUser!;

      // Check balance
      const currentBalance = (await storage.getTelegramUserByChatId(user.telegramId))?.balance || 0;
      if (currentBalance < cost) {
        results.push({ product_id: item.product_id, success: false, error: "insufficient_balance" });
        continue;
      }

      const availableCreds = await storage.getCredentialsByProduct(prod.id);
      const inStockCreds = availableCreds.filter(c => c.status === "available");

      if (inStockCreds.length >= qtyInt) {
        const fulfilled: string[] = [];
        for (let i = 0; i < qtyInt; i++) {
          const cred = inStockCreds[i];
          await storage.markCredentialSold(cred.id);
          await storage.createOrder({
            productId: prod.id,
            credentialId: cred.id,
            telegramUserId: user.id,
            apiKeyId: req.apiKey!.id,
            status: "completed"
          });
          fulfilled.push(cred.content);
        }
        await storage.deductBalance(user.id, cost);
        grandTotalCents += cost;
        results.push({ product_id: prod.id, product_name: prod.name, success: true, delivered_items: fulfilled });
      } else {
        results.push({ product_id: prod.id, success: false, error: "out_of_stock" });
      }
    }

    if (grandTotalCents > 0) {
      await storage.updateApiKeyStats(req.apiKey!.id, true, grandTotalCents);
    } else {
      await storage.updateApiKeyStats(req.apiKey!.id, false, 0);
    }

    return res.json({
      success: true,
      processed_count: results.length,
      data: results
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/orders
 * Order history for this API key
 */
apiV1Router.get("/orders", async (req: AuthenticatedApiRequest, res: Response) => {
  try {
    const keyOrders = await storage.getApiKeyOrders(req.apiKey!.id);

    const formatted = await Promise.all(keyOrders.map(async (ord) => {
      let credContent = null;
      if (ord.credentialId) {
        const [cred] = await db.select().from(credentials).where(eq(credentials.id, ord.credentialId));
        credContent = cred?.content || null;
      }

      return {
        id: ord.id,
        product_id: ord.productId,
        product_name: ord.product?.name || "Unknown Product",
        price_cents: ord.product?.price || 0,
        price_usd: ((ord.product?.price || 0) / 100).toFixed(2),
        status: ord.status,
        delivered_content: credContent,
        created_at: ord.createdAt
      };
    }));

    return res.json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/order/:id
 * Single order details
 */
apiV1Router.get("/order/:id", async (req: AuthenticatedApiRequest, res: Response) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ success: false, error: "invalid_id" });
    }

    const keyOrders = await storage.getApiKeyOrders(req.apiKey!.id);
    const ord = keyOrders.find(o => o.id === orderId);

    if (!ord) {
      return res.status(404).json({ success: false, error: "order_not_found" });
    }

    let credContent = null;
    if (ord.credentialId) {
      const [cred] = await db.select().from(credentials).where(eq(credentials.id, ord.credentialId));
      credContent = cred?.content || null;
    }

    return res.json({
      success: true,
      data: {
        id: ord.id,
        product_id: ord.productId,
        product_name: ord.product?.name || "Unknown Product",
        price_cents: ord.product?.price || 0,
        price_usd: ((ord.product?.price || 0) / 100).toFixed(2),
        status: ord.status,
        delivered_content: credContent,
        created_at: ord.createdAt
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/pending/:id
 * Pre-order status check
 */
apiV1Router.get("/pending/:id", async (req: AuthenticatedApiRequest, res: Response) => {
  try {
    const preorderId = parseInt(req.params.id, 10);
    if (isNaN(preorderId)) {
      return res.status(400).json({ success: false, error: "invalid_id" });
    }

    const [item] = await db.select().from(preorders).where(and(eq(preorders.id, preorderId), eq(preorders.telegramUserId, req.telegramUser!.id)));

    if (!item) {
      return res.status(404).json({ success: false, error: "preorder_not_found" });
    }

    const prod = item.productId ? await storage.getProduct(item.productId) : null;

    return res.json({
      success: true,
      data: {
        id: item.id,
        product_id: item.productId,
        product_name: prod?.name || "Unknown Product",
        amount_usd: (item.amount / 100).toFixed(2),
        status: item.status,
        delivered_content: item.deliveredCredentials || null,
        fulfilled_at: item.fulfilledAt || null,
        created_at: item.createdAt
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/stats
 * API Key Statistics
 */
apiV1Router.get("/stats", async (req: AuthenticatedApiRequest, res: Response) => {
  try {
    const key = req.apiKey!;
    const maskedKey = key.key.substring(0, 16) + "…";
    const revenueUsd = (key.revenue / 100).toFixed(2);

    return res.json({
      success: true,
      data: {
        key: maskedKey,
        full_key: key.key,
        status: key.status,
        total_orders: key.totalOrders,
        success_orders: key.successOrders,
        failed_orders: key.failedOrders,
        revenue_usd: revenueUsd,
        last_used_at: key.lastUsedAt || null,
        created_at: key.createdAt
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});
