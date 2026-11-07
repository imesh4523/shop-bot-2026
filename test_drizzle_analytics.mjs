import { db } from './server/db.js';
import { orders, products, credentials, apiKeys, telegramUsers, smmOrders, smmServices, sandromaniaOrders, sandromaniaProducts, cssxOrders, cssxProducts } from './shared/schema.js';
import { eq, desc } from 'drizzle-orm';

async function main() {
  try {
    const allSandromaniaOrders = await db.select()
      .from(sandromaniaOrders)
      .leftJoin(sandromaniaProducts, eq(sandromaniaOrders.sandromaniaProductId, sandromaniaProducts.id))
      .leftJoin(telegramUsers, eq(sandromaniaOrders.telegramUserId, telegramUsers.id))
      .orderBy(desc(sandromaniaOrders.createdAt));

    console.log('allSandromaniaOrders length:', allSandromaniaOrders.length);
    if (allSandromaniaOrders.length > 0) {
      console.log('Keys of item 0:', Object.keys(allSandromaniaOrders[0]));
      console.log('Item 0:', allSandromaniaOrders[0]);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

main().then(() => process.exit(0)).catch(console.error);
