import fs from "node:fs";
import path from "node:path";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

const migrationsFolder = path.join(process.cwd(), "drizzle");

// בפיתוח מקומי (בלי DATABASE_URL) רצים על PGlite: Postgres אמיתי בתוך התהליך, בלי Docker.
// בשרת: DATABASE_URL מצביע ל-Postgres ברשת הפנימית של ה-compose.
async function init(): Promise<Db> {
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzlePg(pool, { schema });
    if (process.env.AUTO_MIGRATE === "1") {
      await migratePg(db, { migrationsFolder });
    }
    return db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzleLite } = await import("drizzle-orm/pglite");
  const { migrate: migrateLite } = await import("drizzle-orm/pglite/migrator");
  const dataDir = path.join(process.cwd(), ".data");
  fs.mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(path.join(dataDir, "pglite"));
  const db = drizzleLite(client, { schema });
  await migrateLite(db, { migrationsFolder });
  // שני הדרייברים חולקים את אותו ממשק שאילתות; ההמרה נחוצה רק לטיפוסים.
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  const g = globalThis as unknown as { __rezefDb?: Promise<Db> };
  if (!g.__rezefDb) {
    g.__rezefDb = init().catch((e) => {
      g.__rezefDb = undefined; // כשל אתחול לא נשמר, כדי שהבקשה הבאה תנסה שוב
      throw e;
    });
  }
  return g.__rezefDb;
}

export * as tables from "./schema";
