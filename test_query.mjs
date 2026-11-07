import pg from "pg";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/shopbot"
});

async function run() {
  try {
    const sOrders = await pool.query('SELECT * FROM sandromania_orders ORDER BY id DESC LIMIT 10');
    console.log("sandromania_orders count:", sOrders.rows.length, sOrders.rows);
    const dOrders = await pool.query('SELECT * FROM orders ORDER BY id DESC LIMIT 10');
    console.log("direct orders count:", dOrders.rows.length, dOrders.rows.slice(0, 3));
    const cOrders = await pool.query('SELECT * FROM cssx_orders ORDER BY id DESC LIMIT 10');
    console.log("cssx_orders count:", cOrders.rows.length, cOrders.rows);
    const sProducts = await pool.query('SELECT * FROM sandromania_products ORDER BY id DESC LIMIT 10');
    console.log("sandromania_products count:", sProducts.rows.length, sProducts.rows.map(p => ({ id: p.id, title: p.title, cat: p.category })));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
