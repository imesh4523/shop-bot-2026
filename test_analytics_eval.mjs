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

async function main() {
  const client = await pool.connect();
  try {
    const selectedStore = "all";
    const timeRange = "30d";
    const now = new Date();
    let dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    let dateTo = now;

    const directRes = await client.query(`
      SELECT o.id, o.product_id, o.credential_id, o.telegram_user_id, o.status, o.created_at, o.api_key_id,
             p.name as product_name, p.price as price_cents,
             u.username, u.email, u.telegram_id
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN telegram_users u ON o.telegram_user_id = u.id
      ORDER BY o.created_at DESC
    `);

    const sandroRes = await client.query(`
      SELECT so.id, so.sandromania_product_id, so.telegram_user_id, so.external_order_id, so.product_title, so.amount_paid, so.status, so.created_at, so.delivery_text,
             u.username, u.email, u.telegram_id
      FROM sandromania_orders so
      LEFT JOIN telegram_users u ON so.telegram_user_id = u.id
      ORDER BY so.created_at DESC
    `);

    console.log('direct rows:', directRes.rows.length);
    console.log('sandro rows:', sandroRes.rows.length);

    const sandromaniaMapped = sandroRes.rows.map(sp => {
      const costUsd = ((sp.amount_paid || 0) / 100);
      return {
        id: `YOUUHOST-${sp.external_order_id || (2000 + sp.id)}`,
        rawId: sp.id,
        storeType: "sandromania",
        storeName: "Sandromania CDK Shop",
        storeSource: "Sandromania CDK Goods",
        productName: sp.product_title,
        priceCents: sp.amount_paid || 0,
        priceUsd: costUsd.toFixed(2),
        status: sp.status || "approved",
        createdAt: sp.created_at
      };
    });

    console.log('sandromaniaMapped sample:', sandromaniaMapped);

    const combined = [...sandromaniaMapped];
    const dateFiltered = combined.filter(o => {
      const orderDate = o.createdAt ? new Date(o.createdAt) : new Date();
      return orderDate >= dateFrom && orderDate <= dateTo;
    });

    console.log('dateFiltered count:', dateFiltered.length);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
