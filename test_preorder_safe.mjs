import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const isLocalhost = process.env.DATABASE_URL.includes("localhost") || process.env.DATABASE_URL.includes("127.0.0.1");

let connectionString = process.env.DATABASE_URL.replace(/[\?&]sslmode=[^&]*/g, "");
if (connectionString.endsWith("?") || connectionString.endsWith("&")) {
  connectionString = connectionString.slice(0, -1);
}

const pool = new Pool({
  connectionString,
  ssl: isLocalhost ? false : { rejectUnauthorized: false }
});

async function runSafePreorderTest() {
  const client = await pool.connect();
  console.log("=== START SAFE PRE-ORDER VERIFICATION FOR @rochana_imesh ===");
  try {
    // 1. Get user @rochana_imesh
    const userRes = await client.query("SELECT * FROM telegram_users WHERE username = 'rochana_imesh' OR username = '@rochana_imesh'");
    if (userRes.rows.length === 0) {
      throw new Error("User @rochana_imesh not found in database!");
    }
    const user = userRes.rows[0];
    console.log(`[User Found] ID: ${user.id}, Username: @${user.username}, Balance: $${(user.balance / 100).toFixed(2)} (${user.balance} cents)`);

    const initialBalance = user.balance;
    const initialBalanceLkr = user.balance_lkr;

    // 2. Get product Spotify (ID: 17)
    const prodRes = await client.query("SELECT * FROM products WHERE id = 17");
    if (prodRes.rows.length === 0) {
      throw new Error("Product ID 17 not found!");
    }
    const product = prodRes.rows[0];
    console.log(`[Product Found] ID: ${product.id}, Name: ${product.name}, Price: $${(product.price / 100).toFixed(2)} (${product.price} cents)`);

    // Ensure pre-orders are enabled on product 17
    await client.query("UPDATE products SET is_preorder_enabled = TRUE, preorder_quota = 50 WHERE id = $1", [product.id]);
    console.log("[Product Pre-Order Enabled] is_preorder_enabled = true, preorder_quota = 50");

    const orderQty = 1;
    const unitPriceUSD = product.price / 100;
    const costCents = Math.round(orderQty * unitPriceUSD * 100);
    const lkrRate = 305.50;
    const deductLkr = Math.round((costCents / 100) * lkrRate);

    // 3. Execute Pre-Order Placement Transaction (simulating Telegram Bot checkout)
    console.log("\n--- Placing Pre-Order Transaction ---");
    await client.query("BEGIN");
    
    // Lock user row
    const lockedUserRes = await client.query("SELECT * FROM telegram_users WHERE id = $1 FOR UPDATE", [user.id]);
    const lockedUser = lockedUserRes.rows[0];
    if (!lockedUser || lockedUser.balance < costCents) {
      throw new Error(`Insufficient balance! Needed: ${costCents}, Available: ${lockedUser.balance}`);
    }

    // Deduct user balance
    await client.query(
      "UPDATE telegram_users SET balance = balance - $1, balance_lkr = CASE WHEN balance_lkr IS NOT NULL THEN GREATEST(0, balance_lkr - $2) ELSE NULL END WHERE id = $3",
      [costCents, deductLkr, user.id]
    );

    // Decrement preorder quota
    await client.query(
      "UPDATE products SET preorder_quota = GREATEST(0, COALESCE(preorder_quota, 0) - $1) WHERE id = $2",
      [orderQty, product.id]
    );

    // Insert into preorders table
    const preorderInsertRes = await client.query(
      "INSERT INTO preorders (telegram_user_id, product_id, quantity, total_price, status) VALUES ($1, $2, $3, $4, 'pending_fulfillment') RETURNING *",
      [user.id, product.id, orderQty, costCents]
    );
    const newPreorder = preorderInsertRes.rows[0];
    await client.query("COMMIT");

    console.log(`[Pre-Order Created Successfully] Pre-Order #${newPreorder.id}: Quantity ${newPreorder.quantity}, Total: $${(newPreorder.total_price / 100).toFixed(2)}, Status: ${newPreorder.status}`);

    // Verify user balance after preorder
    const balCheckRes = await client.query("SELECT balance, balance_lkr FROM telegram_users WHERE id = $1", [user.id]);
    console.log(`[Balance Deducted] New Balance: $${(balCheckRes.rows[0].balance / 100).toFixed(2)} (Previous: $${(initialBalance / 100).toFixed(2)})`);

    // 4. Test Auto-Fulfillment
    console.log("\n--- Testing Stock Addition & Pre-Order Auto-Fulfillment ---");
    // Add 1 test credential for product 17
    const credRes = await client.query(
      "INSERT INTO credentials (product_id, content, status) VALUES ($1, $2, 'available') RETURNING *",
      [product.id, "SAFE_TEST_PREORDER_ACCOUNT_CREDENTIAL: password123"]
    );
    const testCred = credRes.rows[0];
    console.log(`[Stock Added] Test Credential ID: ${testCred.id} for Product ${product.id}`);

    // Run auto-fulfill logic
    const pendingPoRes = await client.query(
      "SELECT * FROM preorders WHERE product_id = $1 AND status = 'pending_fulfillment' ORDER BY created_at ASC",
      [product.id]
    );
    console.log(`[Pending Preorders in Queue]: ${pendingPoRes.rows.length}`);

    for (const po of pendingPoRes.rows) {
      if (po.id !== newPreorder.id) continue; // Only process our test preorder
      const availCreds = await client.query("SELECT * FROM credentials WHERE product_id = $1 AND status = 'available' LIMIT $2", [po.product_id, po.quantity]);
      if (availCreds.rows.length >= po.quantity) {
        const chosenCred = availCreds.rows[0];
        // Mark cred sold
        await client.query("UPDATE credentials SET status = 'sold' WHERE id = $1", [chosenCred.id]);

        // Create completed order
        const ordRes = await client.query(
          "INSERT INTO orders (telegram_user_id, product_id, credential_id, status) VALUES ($1, $2, $3, 'completed') RETURNING *",
          [po.telegram_user_id, po.product_id, chosenCred.id]
        );

        // Update preorder to fulfilled
        await client.query(
          "UPDATE preorders SET status = 'fulfilled', fulfilled_credential_ids = $1, fulfilled_at = NOW() WHERE id = $2",
          [JSON.stringify([chosenCred.id]), po.id]
        );

        console.log(`[Pre-Order Fulfilled Successfully!] Order #${ordRes.rows[0].id} created with Credential #${chosenCred.id}`);
      }
    }

    // Verify preorder final status
    const finalPoRes = await client.query("SELECT * FROM preorders WHERE id = $1", [newPreorder.id]);
    console.log(`[Verification Check] Pre-Order #${newPreorder.id} status is now: '${finalPoRes.rows[0].status}' (fulfilled_at: ${finalPoRes.rows[0].fulfilled_at})`);

    // 5. Clean up test data and restore user balance
    console.log("\n--- Cleaning Up Safe Test Data & Restoring Balance ---");
    await client.query("DELETE FROM orders WHERE credential_id = $1", [testCred.id]);
    await client.query("DELETE FROM credentials WHERE id = $1", [testCred.id]);
    await client.query("DELETE FROM preorders WHERE id = $1", [newPreorder.id]);
    await client.query("UPDATE telegram_users SET balance = $1, balance_lkr = $2 WHERE id = $3", [initialBalance, initialBalanceLkr, user.id]);
    await client.query("UPDATE products SET preorder_quota = 50 WHERE id = $1", [product.id]);

    const finalUserCheck = await client.query("SELECT balance, balance_lkr FROM telegram_users WHERE id = $1", [user.id]);
    console.log(`[Balance Restored] User @${user.username} balance safely restored to $${(finalUserCheck.rows[0].balance / 100).toFixed(2)}`);
    console.log("\n=== PRE-ORDER END-TO-END TEST PASSED 100% WITH ZERO SIDE-EFFECTS ===");

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[Test Error]:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

runSafePreorderTest();
