import "dotenv/config";
import { db } from "./server/db.ts";
import { orders, products, credentials, apiKeys, telegramUsers, smmOrders, smmServices, sandromaniaOrders, sandromaniaProducts, cssxOrders, cssxProducts } from "@shared/schema.ts";
import { eq, desc } from "drizzle-orm";

async function run() {
  try {
    const allSandromaniaOrders = await db.select()
      .from(sandromaniaOrders)
      .leftJoin(sandromaniaProducts, eq(sandromaniaOrders.sandromaniaProductId, sandromaniaProducts.id))
      .leftJoin(telegramUsers, eq(sandromaniaOrders.telegramUserId, telegramUsers.id))
      .orderBy(desc(sandromaniaOrders.createdAt));

    console.log("allSandromaniaOrders count:", allSandromaniaOrders.length);
    const lkrRate = 305.5;

    const sandromaniaMapped = allSandromaniaOrders.map(sp => {
      const costUsd = ((sp.sandromania_orders.amountPaid || 0) / 100);
      const costLkr = Math.round(costUsd * lkrRate).toLocaleString();
      const user = sp.telegram_users;
      const buyerUsername = user?.username ? `@${user.username}` : null;
      const buyerEmail = user?.email || null;
      const buyerTgId = user?.telegramId || null;
      const buyerName = buyerEmail 
        ? (buyerUsername ? `${buyerUsername} • ${buyerEmail}` : buyerEmail) 
        : (buyerUsername || (buyerTgId ? `TG:${buyerTgId}` : `User #${sp.sandromania_orders.telegramUserId}`));

      return {
        id: `YOUUHOST-${2000 + sp.sandromania_orders.id}`,
        rawId: sp.sandromania_orders.id,
        isApiOrder: true,
        apiKeyId: null,
        apiKey: null,
        storeType: "sandromania",
        storeName: "Sandromania CDK Shop",
        storeSource: "Sandromania CDK Goods",
        channelId: "sandromania",
        productId: sp.sandromania_orders.sandromaniaProductId || 0,
        productName: sp.sandromania_orders.productTitle || "Partner Digital Good",
        buyer: buyerName,
        customerName: buyerUsername || buyerName,
        customerEmail: buyerEmail,
        buyerUsername,
        buyerEmail,
        buyerId: sp.sandromania_orders.telegramUserId,
        priceCents: sp.sandromania_orders.amountPaid || 0,
        priceUsd: costUsd.toFixed(2),
        priceLkr: costLkr,
        status: sp.sandromania_orders.status || "approved",
        deliveredContent: sp.sandromania_orders.deliveryText || null,
        createdAt: sp.sandromania_orders.createdAt || new Date()
      };
    });

    console.log("Mapped 1st sandromania order:", sandromaniaMapped[0]);
    const totalRevenueCents = sandromaniaMapped.reduce((acc, o) => acc + o.priceCents, 0);
    console.log("Total Sandromania Revenue USD: $" + (totalRevenueCents / 100).toFixed(2));
    console.log("Total Sandromania Revenue LKR: Rs. " + Math.round((totalRevenueCents / 100) * lkrRate).toLocaleString());
  } catch (e) {
    console.error("Test Error:", e);
  } finally {
    process.exit(0);
  }
}
run();
