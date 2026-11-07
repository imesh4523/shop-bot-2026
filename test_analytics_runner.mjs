import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const isLocalhost = process.env.DATABASE_URL.includes("localhost") || process.env.DATABASE_URL.includes("127.0.0.1");
let connectionString = process.env.DATABASE_URL;
if (!isLocalhost) {
  connectionString = connectionString.replace(/[\?&]sslmode=[^&]*/g, "");
  if (connectionString.endsWith("?") || connectionString.endsWith("&")) {
    connectionString = connectionString.slice(0, -1);
  }
}

const pool = new Pool({
  connectionString,
  ssl: isLocalhost ? false : { rejectUnauthorized: false }
});

async function runAnalytics(selectedStore = "all", timeRange = "30d", startDate, endDate) {
  const client = await pool.connect();
  try {
    const now = new Date();
    let dateFrom = new Date(0);
    if (timeRange === "24h" || timeRange === "today") {
      dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (timeRange === "7d") {
      dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === "30d" || timeRange === "30days") {
      dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeRange === "month" || timeRange === "thismonth") {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timeRange === "custom" && startDate) {
      dateFrom = new Date(String(startDate));
    }
    let dateTo = now;
    if (timeRange === "custom" && endDate) {
      dateTo = new Date(String(endDate));
      dateTo.setHours(23, 59, 59, 999);
    }

    const lkrRate = 305.50;

    // 1. Direct Cloud & Reseller API Orders
    const directRes = await client.query(`
      SELECT o.id, o.product_id, o.credential_id, o.telegram_user_id, o.api_key_id, o.status, o.created_at,
             p.name as product_name, p.price as price_cents, p.type as product_type,
             c.content as cred_content,
             ak.key as api_key,
             u.username, u.email, u.telegram_id
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN credentials c ON o.credential_id = c.id
      LEFT JOIN api_keys ak ON o.api_key_id = ak.id
      LEFT JOIN telegram_users u ON o.telegram_user_id = u.id
      ORDER BY o.created_at DESC
    `);

    // 2. SMM Boost Orders
    const smmRes = await client.query(`
      SELECT s.id, s.smm_service_id, s.telegram_user_id, s.charge, s.status, s.link, s.quantity, s.created_at,
             srv.name as service_name,
             u.username, u.email, u.telegram_id
      FROM smm_orders s
      LEFT JOIN smm_services srv ON s.smm_service_id = srv.id
      LEFT JOIN telegram_users u ON s.telegram_user_id = u.id
      ORDER BY s.created_at DESC
    `);

    // 3. Sandromania Orders
    const sandroRes = await client.query(`
      SELECT so.id, so.sandromania_product_id, so.telegram_user_id, so.external_order_id, so.external_product_id,
             so.product_title, so.quantity, so.cost_price_usd, so.amount_paid, so.status, so.delivery_text, so.created_at,
             sp.category as prod_category, sp.title as prod_title,
             u.username, u.email, u.telegram_id
      FROM sandromania_orders so
      LEFT JOIN sandromania_products sp ON so.sandromania_product_id = sp.id
      LEFT JOIN telegram_users u ON so.telegram_user_id = u.id
      ORDER BY so.created_at DESC
    `);

    // 4. CSxStore Orders
    const cssxRes = await client.query(`
      SELECT co.id, co.cssx_product_id, co.telegram_user_id, co.external_order_id, co.product_title,
             co.quantity, co.amount_paid, co.status, co.delivery_text, co.created_at,
             cp.category as prod_category, cp.title as prod_title,
             u.username, u.email, u.telegram_id
      FROM cssx_orders co
      LEFT JOIN cssx_products cp ON co.cssx_product_id = cp.id
      LEFT JOIN telegram_users u ON co.telegram_user_id = u.id
      ORDER BY co.created_at DESC
    `);

    const directAndApiMapped = directRes.rows.map(o => {
      const isApi = Boolean(o.api_key_id);
      const priceCents = o.price_cents || 0;
      const priceUsd = (priceCents / 100).toFixed(2);
      const priceLkr = Math.round((priceCents / 100) * lkrRate).toLocaleString();
      const buyerUsername = o.username ? `@${o.username}` : null;
      const buyerEmail = o.email || null;
      const buyerTgId = o.telegram_id || null;
      const buyerName = buyerEmail 
        ? (buyerUsername ? `${buyerUsername} • ${buyerEmail}` : buyerEmail) 
        : (buyerUsername || (buyerTgId ? `TG:${buyerTgId}` : `User #${o.telegram_user_id}`));
      
      const storeType = isApi ? "reseller_api" : "direct";
      const storeName = isApi 
        ? `API: ${o.api_key ? o.api_key.substring(0, 10) + '...' : 'Key #' + o.api_key_id}`
        : "Direct Cloud Store";
      const storeSource = isApi 
        ? `API Partner (${o.api_key ? o.api_key.substring(0, 10) + '...' : 'Key #' + o.api_key_id})` 
        : 'Direct Store (Web/MiniApp)';

      return {
        id: isApi ? `YH-API-${o.id}` : `ORD-${o.id}`,
        rawId: o.id,
        isApiOrder: isApi,
        apiKeyId: o.api_key_id,
        apiKey: o.api_key || null,
        storeType,
        storeName,
        storeSource,
        channelId: isApi ? `key_${o.api_key_id}` : "direct",
        productId: o.product_id,
        productName: o.product_name || 'Digital Cloud Product',
        buyer: buyerName,
        customerName: buyerUsername || buyerName,
        customerEmail: buyerEmail,
        buyerUsername,
        buyerEmail,
        buyerId: o.telegram_user_id,
        priceCents,
        priceUsd,
        priceLkr,
        status: o.status || "completed",
        deliveredContent: o.cred_content || null,
        createdAt: o.created_at || new Date()
      };
    });

    const sandromaniaMapped = sandroRes.rows.map(sp => {
      const costUsd = ((sp.amount_paid || 0) / 100);
      const costLkr = Math.round(costUsd * lkrRate).toLocaleString();
      const buyerUsername = sp.username ? `@${sp.username}` : null;
      const buyerEmail = sp.email || null;
      const buyerTgId = sp.telegram_id || null;
      const buyerName = buyerEmail 
        ? (buyerUsername ? `${buyerUsername} • ${buyerEmail}` : buyerEmail) 
        : (buyerUsername || (buyerTgId ? `TG:${buyerTgId}` : `User #${sp.telegram_user_id}`));

      return {
        id: `YOUUHOST-${sp.external_order_id || (2000 + sp.id)}`,
        rawId: sp.id,
        isApiOrder: true,
        apiKeyId: null,
        apiKey: null,
        storeType: "sandromania",
        storeName: "Sandromania CDK Shop",
        storeSource: "Sandromania CDK Goods",
        channelId: "sandromania",
        productId: sp.sandromania_product_id || 0,
        productName: sp.product_title || "Partner Digital Good",
        buyer: buyerName,
        customerName: buyerUsername || buyerName,
        customerEmail: buyerEmail,
        buyerUsername,
        buyerEmail,
        buyerId: sp.telegram_user_id,
        priceCents: sp.amount_paid || 0,
        priceUsd: costUsd.toFixed(2),
        priceLkr: costLkr,
        status: sp.status || "approved",
        deliveredContent: sp.delivery_text || null,
        createdAt: sp.created_at || new Date()
      };
    });

    const combinedAllOrders = [...directAndApiMapped, ...sandromaniaMapped].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const dateFilteredOrders = combinedAllOrders.filter(o => {
      const orderDate = o.createdAt ? new Date(o.createdAt) : new Date();
      return orderDate >= dateFrom && orderDate <= dateTo;
    });

    const finalFilteredOrders = dateFilteredOrders.filter(o => {
      if (!selectedStore || selectedStore === "all") return true;
      if (selectedStore === "direct") return o.channelId === "direct";
      if (selectedStore === "sandromania") return o.storeType === "sandromania";
      return true;
    });

    console.log('Result summary:', {
      totalOrders: finalFilteredOrders.length,
      direct: directAndApiMapped.length,
      sandromania: sandromaniaMapped.length,
      dateFiltered: dateFilteredOrders.length,
      finalFiltered: finalFilteredOrders.length
    });
  } finally {
    client.release();
    await pool.end();
  }
}

runAnalytics().catch(console.error);
