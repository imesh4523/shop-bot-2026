import "dotenv/config";
import { db } from "./server/db.js";
import { settings } from "./shared/schema.js";

async function checkSettings() {
  const allSettings = await db.select().from(settings);
  console.log("ALL SETTINGS IN DB:", JSON.stringify(allSettings, null, 2));
  process.exit(0);
}

checkSettings().catch(err => {
  console.error(err);
  process.exit(1);
});
