import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || "";

  // Render internal URLs have no domain suffix — no SSL needed
  // External URLs contain .render.com or .supabase.co — need SSL
  const needsSsl = dbUrl.includes(".render.com") ||
                   dbUrl.includes(".supabase.co") ||
                   dbUrl.includes("supabase");

  console.log(`🔌 DB connecting... SSL: ${needsSsl ? "YES" : "NO (internal)"}`);

  const pool = new Pool({
    connectionString: dbUrl,
    max: 3,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 15000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ...(needsSsl && { ssl: { rejectUnauthorized: false } }),
  });

  pool.on("error", (err) => {
    console.error("⚠️  DB pool error:", err.message);
  });

  pool.on("connect", () => {
    console.log("✅ DB pool connected");
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: ["error"] });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
