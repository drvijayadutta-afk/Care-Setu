import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const isProduction = process.env.NODE_ENV === "production";

  // Use a pg Pool with keepAlive to prevent P1017 on Render free tier
  // Render PostgreSQL closes idle connections — keepAlive prevents this
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ...(isProduction && {
      ssl: { rejectUnauthorized: false }
    }),
  });

  // Log pool errors so they appear in Render logs
  pool.on("error", (err) => {
    console.error("⚠️ DB pool error:", err.message);
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: isProduction ? ["error"] : ["error", "warn"],
  });
}

// Singleton with auto-reconnect wrapper
function getPrismaClient() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

export const prisma = getPrismaClient();

// Graceful disconnect on shutdown
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
