import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}


const isLocalhost = process.env.DATABASE_URL.includes("localhost") || process.env.DATABASE_URL.includes("127.0.0.1");

let connectionString = process.env.DATABASE_URL;
if (!isLocalhost) {
  connectionString = connectionString.replace(/[\?&]sslmode=[^&]*/g, "");
  if (connectionString.endsWith("?") || connectionString.endsWith("&")) {
    connectionString = connectionString.slice(0, -1);
  }
}

export const pool = new Pool({ 
  connectionString,
  ssl: isLocalhost ? false : {
    rejectUnauthorized: false
  }
});

// Test connection & ensure session table
pool.connect()
  .then(async client => {
    console.log('Successfully connected to database');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "session" (
          "sid" varchar NOT NULL COLLATE "default",
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL,
          CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
        ) WITH (OIDS=FALSE);
        CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
      `);
    } catch (e) {
      console.error('Error ensuring session table:', e);
    }
    client.release();
  })
  .catch(err => {
    console.error('Error acquiring client', err.stack);
  });

export const db = drizzle(pool, { schema });
