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
    const q1 = await client.query(`
      SELECT 
        so.id, so.sandromania_product_id, so.telegram_user_id, so.external_order_id, 
        so.product_title, so.amount_paid, so.status, so.created_at, so.delivery_text,
        sp.category as prod_category, sp.title as prod_title,
        tu.username, tu.email, tu.telegram_id
      FROM sandromania_orders so
      LEFT JOIN sandromania_products sp ON so.sandromania_product_id = sp.id
      LEFT JOIN telegram_users tu ON so.telegram_user_id = tu.id
      ORDER BY so.created_at DESC
    `);
    console.log('Joined sandro orders length:', q1.rows.length);
    console.log('Order 0:', q1.rows[0]);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
