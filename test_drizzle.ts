import "dotenv/config";
import { db } from "./server/db.ts";
import { sandromaniaOrders, sandromaniaProducts, telegramUsers } from "@shared/schema.ts";
import { eq, desc } from "drizzle-orm";

async function run() {
  try {
    const res = await db.select()
      .from(sandromaniaOrders)
      .leftJoin(sandromaniaProducts, eq(sandromaniaOrders.sandromaniaProductId, sandromaniaProducts.id))
      .leftJoin(telegramUsers, eq(sandromaniaOrders.telegramUserId, telegramUsers.id))
      .orderBy(desc(sandromaniaOrders.createdAt));

    console.log("Joined result keys:", Object.keys(res[0] || {}));
    console.log("Joined first row:", JSON.stringify(res[0], null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
