import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const isProduction = process.env.NODE_ENV === "production";
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Accept Supabase's self-signed certificate chain in production
    // IPv4 is forced via NODE_OPTIONS=--dns-result-order=ipv4first on Render
    ...(isProduction && { ssl: { rejectUnauthorized: false } }),
  });
  return new PrismaClient({
    adapter,
    log: isProduction ? ["error"] : ["error", "warn"],
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
