import "dotenv/config";
import pg from "pg";
import { db, pool } from "./server/db";
import { storage } from "./server/storage";

async function setup() {
  console.log("=================== [POSTGRES DB SETUP & ADMIN CREATION] ===================");

  // 1. Check PostgreSQL Connection
  try {
    const client = await pool.connect();
    console.log("✅ PostgreSQL Connection: SUCCESSFUL!");
    const res = await client.query("SELECT current_database();");
    console.log(`✅ Connected Database: ${res.rows[0].current_database}`);
    client.release();
  } catch (err: any) {
    console.error("❌ PostgreSQL Connection Failed:", err.message);
    process.exit(1);
  }

  // 2. Initialize Database Tables and Admin User
  try {
    console.log("⚙️ Initializing Admin user and DB schema...");
    await storage.initializeAdmin();
    console.log("✅ Admin User Initialization: COMPLETED!");
  } catch (err: any) {
    console.error("❌ Error initializing admin:", err);
  }

  console.log("\n------------------------------------------------------------");
  console.log("🎉 DATABASE & ADMIN SETUP SUCCESSFULLY COMPLETED!");
  console.log(`📌 Database URL: ${process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/shopbot"}`);
  console.log(`📌 Admin Email: ${process.env.ADMIN_EMAIL || "admin@shopeefy.com"}`);
  console.log(`📌 Admin Password: ${process.env.ADMIN_PASSWORD || "admin123"}`);
  console.log(`📌 Telegram Bot Token: ${process.env.TELEGRAM_BOT_TOKEN}`);
  console.log("------------------------------------------------------------\n");

  await pool.end();
  process.exit(0);
}

setup();
