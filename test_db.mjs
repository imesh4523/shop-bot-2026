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
    const resOrders = await client.query('SELECT count(*) FROM orders');
    console.log('orders count:', resOrders.rows[0].count);

    const resSandro = await client.query('SELECT count(*) FROM sandromania_orders');
    console.log('sandromania_orders count:', resSandro.rows[0].count);

    const resCssx = await client.query('SELECT count(*) FROM cssx_orders');
    console.log('cssx_orders count:', resCssx.rows[0].count);

    const resSmm = await client.query('SELECT count(*) FROM smm_orders');
    console.log('smm_orders count:', resSmm.rows[0].count);

    // Let's check what orders exist in sandromania_orders or orders!
    const recentSandro = await client.query('SELECT * FROM sandromania_orders ORDER BY id DESC LIMIT 5');
    console.log('Recent sandromania orders:', recentSandro.rows);

    const recentOrders = await client.query('SELECT * FROM orders ORDER BY id DESC LIMIT 5');
    console.log('Recent orders:', recentOrders.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
