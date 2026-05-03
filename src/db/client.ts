import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "../config/env";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function validateDataResidency(dbUrl: string) {
  const isSupabase = dbUrl.includes("supabase.co") || dbUrl.includes("supabase");
  if (isSupabase) {
    // SPDI Rule 7 / DPDP data localisation: PHI must stay in India (ap-south-1 / Mumbai).
    const isIndia = dbUrl.includes("aws-ap-south-1") || dbUrl.includes("ap-south-1");
    if (!isIndia) {
      console.error(
        "[COMPLIANCE] ⚠️  Supabase connection does not appear to be in ap-south-1 (Mumbai). " +
        "Health data must be stored in India to comply with SPDI Rule 7. Verify your project region."
      );
    }
  }
}

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || "";
  validateDataResidency(dbUrl);

  // Determine SSL requirement based on DATABASE_SSL config
  let needsSsl = false;
  if (config.databaseSsl === "require") {
    needsSsl = true;
  } else if (config.databaseSsl === "disable") {
    needsSsl = false;
  } else {
    // auto-detect: Render internal URLs have no domain suffix — no SSL needed
    // External URLs contain .render.com or .supabase.co — need SSL
    needsSsl = dbUrl.includes(".render.com") ||
               dbUrl.includes(".supabase.co") ||
               dbUrl.includes("supabase");
  }

  console.log(`🔌 DB connecting... SSL: ${needsSsl ? "YES" : "NO"} (${config.databaseSsl})`);

  const pool = new Pool({
    connectionString: dbUrl,
    max: 3,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 15000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    // Always verify the server TLS certificate in production (SPDI Rule 8).
    // Set DATABASE_SSL=disable only for local Postgres with self-signed certs.
    ...(needsSsl && { ssl: { rejectUnauthorized: config.nodeEnv === "production" } }),
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
