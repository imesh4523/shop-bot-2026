import { Router, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { products, orders, credentials, apiKeys, telegramUsers, preorders, promoCodes, promoCodeRedemptions } from "@shared/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { sendAdminPushNotification } from "../push-notifications";

export const apiV1Router = Router();

// Middleware to authenticate X-API-Key
interface AuthenticatedApiRequest extends Request {
  apiKey?: typeof apiKeys.$inferSelect;
  telegramUser?: typeof telegramUsers.$inferSelect;
}

async function authenticateApiKey(req: AuthenticatedApiRequest, res: Response, next: NextFunction) {
  const authHeader = req.header("X-API-Key") || (req.header("Authorization") ? req.header("Authorization")!.replace(/^Bearer\s+/i, "") : null);
  
  if (!authHeader) {
    return res.status(401).json({
      error: "unauthorized",
      message: "Missing API Key. Provide key in 'X-API-Key' or 'Authorization: Bearer <key>' header.",
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

// Global CORS & preflight middleware for API V1
apiV1Router.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, api_key, Accept");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Rate limiter: Max 70 requests per second per user / API key
const apiV1RateLimitMap = new Map<string, { count: number; windowStart: number }>();

// Periodic cleanup of stale rate limiter keys every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of apiV1RateLimitMap.entries()) {
    if (now - val.windowStart > 5000) {
      apiV1RateLimitMap.delete(key);
    }
  }
}, 60000);

function apiV1RateLimiter(req: AuthenticatedApiRequest, res: Response, next: NextFunction) {
  const identifier = req.apiKey?.id ? `key_${req.apiKey.id}` : `user_${req.telegramUser?.id || req.ip}`;
  const now = Date.now();
  const limit = 70; // 70 requests per second per user/key

  const entry = apiV1RateLimitMap.get(identifier);
  if (!entry || now - entry.windowStart >= 1000) {
    apiV1RateLimitMap.set(identifier, { count: 1, windowStart: now });
    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", limit - 1);
    res.setHeader("X-RateLimit-Reset", Math.ceil((now + 1000) / 1000));
    return next();
  }

  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  const resetTime = Math.ceil((entry.windowStart + 1000) / 1000);

  res.setHeader("X-RateLimit-Limit", limit);
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("X-RateLimit-Reset", resetTime);

  if (entry.count > limit) {
    return res.status(429).json({
      error: "rate_limit_exceeded",
      message: `Rate limit exceeded. Maximum ${limit} requests per second allowed per user.`,
      statusCode: 429,
      retryAfter: Math.max(1, Math.ceil((entry.windowStart + 1000 - now) / 1000))
    });
  }

  next();
}

// Pre-authentication IP rate limiter: Prevents database DoS and key brute-forcing
const apiV1IpRateLimitMap = new Map<string, { count: number; windowStart: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of apiV1IpRateLimitMap.entries()) {
    if (now - val.windowStart > 5000) {
      apiV1IpRateLimitMap.delete(key);
    }
  }
}, 60000);

function apiV1IpRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = (req.headers["cf-connecting-ip"] as string) || req.socket.remoteAddress || "unknown_ip";
  const now = Date.now();
  const limit = 40; // Max 40 requests per second per IP
  const entry = apiV1IpRateLimitMap.get(ip);
  if (!entry || now - entry.windowStart >= 1000) {
    apiV1IpRateLimitMap.set(ip, { count: 1, windowStart: now });
    return next();
  }
  entry.count += 1;
  if (entry.count > limit) {
    return res.status(429).json({
      error: "ip_rate_limit_exceeded",
      message: "Too many API requests from this IP. Please slow down.",
      statusCode: 429
    });
  }
  next();
}

// Apply auth middleware to all /api/v1 routes (IP limiter runs FIRST before database access)
apiV1Router.use(apiV1IpRateLimiter as any);
apiV1Router.use(authenticateApiKey as any);
apiV1Router.use(apiV1RateLimiter as any);

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
    const { product_id, quantity = 1, coupon_code, couponCode } = req.body;

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

    const rawCoupon = coupon_code || couponCode;
    let discountCents = 0;
    let appliedPromo: any = null;
    if (rawCoupon && typeof rawCoupon === "string" && rawCoupon.trim()) {
      const promo = await storage.getPromoCodeByCode(rawCoupon.trim().toUpperCase());
      if (promo && promo.status === "active" && promo.usesCount < promo.maxUses) {
        appliedPromo = promo;
        if (promo.discountType === "percentage") {
          const pct = Math.min(100, Math.max(1, promo.discountValue || 10));
          discountCents = Math.round((totalCost * pct) / 100);
        } else {
          discountCents = Math.min(totalCost, promo.discountValue || promo.reward || 0);
        }
      }
    }
    const finalCost = Math.max(0, totalCost - discountCents);

    // Atomic transaction: Row lock user, check balance, lock credentials, deduct balance, create order
    const txResult: any = await db.transaction(async (tx) => {
      // 1. Lock user row
      const [lockedUser] = await tx.select().from(telegramUsers).where(eq(telegramUsers.id, user.id)).for('update');
      if (!lockedUser) {
        throw new Error("user_not_found");
      }

      const approxLkrRate = 305.50;
      const deductLkr = Math.round((finalCost / 100) * approxLkrRate);

      // Support dual-currency balance verification (USD cents or LKR)
      const hasEnough = (lockedUser.balance >= finalCost) || (lockedUser.balanceLkr != null && lockedUser.balanceLkr >= deductLkr);
      if (!hasEnough) {
        throw new Error("insufficient_balance");
      }

      // Record promo redemption and increment usesCount atomically inside transaction
      if (appliedPromo) {
        const [alreadyRedeemed] = await tx.select({ id: promoCodeRedemptions.id })
          .from(promoCodeRedemptions)
          .where(and(
            eq(promoCodeRedemptions.telegramUserId, lockedUser.id),
            eq(promoCodeRedemptions.promoCodeId, appliedPromo.id)
          )).limit(1);

        if (alreadyRedeemed) {
          throw new Error("coupon_already_used");
        }

        await tx.insert(promoCodeRedemptions).values({
          telegramUserId: lockedUser.id,
          promoCodeId: appliedPromo.id,
        });

        await tx.update(promoCodes)
          .set({ usesCount: sql`${promoCodes.usesCount} + 1` })
          .where(eq(promoCodes.id, appliedPromo.id));
      }

      // 2. Try instant fulfillment with row-locked credentials
      const lockedCreds = await tx.select()
        .from(credentials)
        .where(and(eq(credentials.productId, prod.id), eq(credentials.status, 'available')))
        .limit(qtyInt)
        .for('update', { skipLocked: true });

      if (lockedCreds.length >= qtyInt) {
        const deductLkr = Math.round((finalCost / 100) * approxLkrRate);
        const [updatedUser] = await tx.update(telegramUsers).set({
          balance: sql`${telegramUsers.balance} - ${finalCost}`,
          balanceLkr: sql`CASE WHEN ${telegramUsers.balanceLkr} IS NOT NULL THEN GREATEST(0, ${telegramUsers.balanceLkr} - ${deductLkr}) ELSE NULL END`
        }).where(and(eq(telegramUsers.id, lockedUser.id), gte(telegramUsers.balance, finalCost))).returning();

        if (!updatedUser) {
          throw new Error("insufficient_balance");
        }

        const fulfilledCreds: string[] = [];
        const createdOrders: any[] = [];

        for (let i = 0; i < qtyInt; i++) {
          const cred = lockedCreds[i];
          await tx.update(credentials).set({ status: 'sold' }).where(eq(credentials.id, cred.id));
          const [newOrder] = await tx.insert(orders).values({
            productId: prod.id,
            credentialId: cred.id,
            telegramUserId: lockedUser.id,
            apiKeyId: req.apiKey!.id,
            status: "completed"
          }).returning();

          fulfilledCreds.push(cred.content);
          createdOrders.push(newOrder);
        }

        return {
          type: "instant",
          createdOrders,
          fulfilledCreds,
          finalCost
        };
      } else if (prod.isPreorderEnabled) {
        const deductLkr = Math.round((finalCost / 100) * approxLkrRate);
        const [updatedUser] = await tx.update(telegramUsers).set({
          balance: sql`GREATEST(0, ${telegramUsers.balance} - ${finalCost})`,
          balanceLkr: sql`CASE WHEN ${telegramUsers.balanceLkr} IS NOT NULL THEN GREATEST(0, ${telegramUsers.balanceLkr} - ${deductLkr}) ELSE NULL END`
        }).where(and(eq(telegramUsers.id, lockedUser.id), or(gte(telegramUsers.balance, finalCost), gte(telegramUsers.balanceLkr, deductLkr)))).returning();

        if (!updatedUser) {
          throw new Error("insufficient_balance");
        }

        const [preorderItem] = await tx.insert(preorders).values({
          productId: prod.id,
          telegramUserId: lockedUser.id,
          quantity: qtyInt,
          totalPrice: finalCost,
          status: "pending_fulfillment"
        }).returning();

        return {
          type: "preorder",
          preorderItem,
          totalCost: finalCost
        };
      } else {
        throw new Error("out_of_stock");
      }
    }).catch(err => ({ error: err.message }));

    if (txResult.error === "insufficient_balance") {
      await storage.updateApiKeyStats(req.apiKey!.id, false, 0);
      try {
        await storage.createOrder({
          productId: prod.id,
          telegramUserId: user.id,
          apiKeyId: req.apiKey!.id,
          status: "failed"
        });
      } catch (e) {}
      return res.status(400).json({
        success: false,
        error: "insufficient_balance",
        message: `Insufficient balance. Required: $${(finalCost / 100).toFixed(2)}, Available: $${(user.balance / 100).toFixed(2)}.`
      });
    }

    if (txResult.error === "out_of_stock") {
      await storage.updateApiKeyStats(req.apiKey!.id, false, 0);
      try {
        await storage.createOrder({
          productId: prod.id,
          telegramUserId: user.id,
          apiKeyId: req.apiKey!.id,
          status: "failed"
        });
      } catch (e) {}
      return res.status(400).json({
        success: false,
        error: "out_of_stock",
        message: `Product is out of stock and pre-orders are disabled.`
      });
    }

    if (txResult.error) {
      return res.status(400).json({ success: false, error: txResult.error });
    }

    if (txResult.type === "instant") {
      await storage.updateApiKeyStats(req.apiKey!.id, true, txResult.finalCost);

      const userDisplay = user.username ? `@${user.username}` : (user.firstName || `User #${user.id}`);
      sendAdminPushNotification({
        title: `⚡ [API RESELLER ORDER] ${prod.name}`,
        body: `Order placed via Developer API (Key #${req.apiKey!.id})\nReseller: ${userDisplay}\nQty: ${qtyInt}x | Total: $${(txResult.finalCost / 100).toFixed(2)}\nSource: Through API`,
        url: "/orders"
      }).catch(console.error);

      return res.json({
        success: true,
        type: "instant",
        message: "Order completed successfully.",
        data: {
          order_ids: txResult.createdOrders.map((o: any) => o.id),
          product_name: prod.name,
          quantity: qtyInt,
          original_price_usd: (totalCost / 100).toFixed(2),
          discount_usd: (discountCents / 100).toFixed(2),
          total_price_usd: (txResult.finalCost / 100).toFixed(2),
          delivered_items: txResult.fulfilledCreds,
          created_at: new Date()
        }
      });
    }

    if (txResult.type === "preorder") {
      await storage.updateApiKeyStats(req.apiKey!.id, true, txResult.totalCost);

      const userDisplay = user.username ? `@${user.username}` : (user.firstName || `User #${user.id}`);
      sendAdminPushNotification({
        title: `📦 [API RESELLER PRE-ORDER] ${prod.name}`,
        body: `Pre-order placed via Developer API (Key #${req.apiKey!.id})\nReseller: ${userDisplay}\nQty: ${qtyInt}x | Total: $${(txResult.totalCost / 100).toFixed(2)}\nSource: Through API`,
        url: "/preorders"
      }).catch(console.error);

      return res.json({
        success: true,
        type: "preorder",
        message: "Product is out of stock. Pre-order placed successfully and queued for admin fulfillment.",
        data: {
          preorder_id: txResult.preorderItem.id,
          product_name: prod.name,
          quantity: qtyInt,
          total_price_usd: (txResult.totalCost / 100).toFixed(2),
          status: "pending_fulfillment",
          created_at: txResult.preorderItem.createdAt
        }
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

    if (orderList.length > 50) {
      return res.status(400).json({
        success: false,
        error: "batch_limit_exceeded",
        message: "Maximum 50 items allowed per batch order request."
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

      const itemTxResult: any = await db.transaction(async (tx) => {
        // 1. Lock user row
        const [lockedUser] = await tx.select().from(telegramUsers).where(eq(telegramUsers.id, user.id)).for('update');
        if (!lockedUser || lockedUser.balance < cost) {
          throw new Error("insufficient_balance");
        }

        // 2. Lock credentials
        const lockedCreds = await tx.select()
          .from(credentials)
          .where(and(eq(credentials.productId, prod.id), eq(credentials.status, 'available')))
          .limit(qtyInt)
          .for('update', { skipLocked: true });

        if (lockedCreds.length < qtyInt) {
          throw new Error("out_of_stock");
        }

        // 3. Deduct balance atomically
        const approxLkrRate = 305.50;
        const deductLkr = Math.round((cost / 100) * approxLkrRate);
        const [updatedUser] = await tx.update(telegramUsers).set({
          balance: sql`${telegramUsers.balance} - ${cost}`,
          balanceLkr: sql`CASE WHEN ${telegramUsers.balanceLkr} IS NOT NULL THEN GREATEST(0, ${telegramUsers.balanceLkr} - ${deductLkr}) ELSE NULL END`
        }).where(and(eq(telegramUsers.id, lockedUser.id), gte(telegramUsers.balance, cost))).returning();

        if (!updatedUser) {
          throw new Error("insufficient_balance");
        }

        const fulfilled: string[] = [];
        for (let i = 0; i < qtyInt; i++) {
          const cred = lockedCreds[i];
          await tx.update(credentials).set({ status: 'sold' }).where(eq(credentials.id, cred.id));
          await tx.insert(orders).values({
            productId: prod.id,
            credentialId: cred.id,
            telegramUserId: lockedUser.id,
            apiKeyId: req.apiKey!.id,
            status: "completed"
          });
          fulfilled.push(cred.content);
        }

        return { success: true, fulfilled };
      }).catch(err => ({ success: false, error: err.message }));

      if (itemTxResult.success) {
        grandTotalCents += cost;
        results.push({ product_id: prod.id, product_name: prod.name, success: true, delivered_items: itemTxResult.fulfilled });
      } else {
        try {
          await storage.createOrder({
            productId: prod.id,
            telegramUserId: user.id,
            apiKeyId: req.apiKey!.id,
            status: "failed"
          });
        } catch (e) {}
        results.push({ product_id: item.product_id, success: false, error: itemTxResult.error || "order_failed" });
      }
    }

    if (grandTotalCents > 0) {
      await storage.updateApiKeyStats(req.apiKey!.id, true, grandTotalCents);
      const successfulCount = results.filter(r => r.success).length;
      const userDisplay = req.telegramUser?.username ? `@${req.telegramUser.username}` : (req.telegramUser?.firstName || `User #${req.telegramUser?.id}`);
      sendAdminPushNotification({
        title: `⚡ [API RESELLER BATCH ORDER]`,
        body: `Batch order completed via Developer API (Key #${req.apiKey!.id})\nReseller: ${userDisplay}\nProcessed: ${successfulCount} items | Total: $${(grandTotalCents / 100).toFixed(2)}\nSource: Through API`,
        url: "/orders"
      }).catch(console.error);
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
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const offset = (page - 1) * limit;

    const allKeyOrders = await storage.getApiKeyOrders(req.apiKey!.id);
    const totalCount = allKeyOrders.length;
    const paginatedOrders = allKeyOrders.slice(offset, offset + limit);

    const formatted = await Promise.all(paginatedOrders.map(async (ord) => {
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
      total_count: totalCount,
      page,
      limit,
      total_pages: Math.ceil(totalCount / limit),
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
        quantity: item.quantity,
        amount_usd: (item.totalPrice / 100).toFixed(2),
        status: item.status,
        delivered_content: item.fulfilledCredentialIds || null,
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
        full_key: maskedKey,
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
