"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const globalForPrisma = globalThis;
function createPrismaClient() {
    const dbUrl = process.env.DATABASE_URL || "";
    // Render internal URLs have no domain suffix — no SSL needed
    // External URLs contain .render.com or .supabase.co — need SSL
    const needsSsl = dbUrl.includes(".render.com") ||
        dbUrl.includes(".supabase.co") ||
        dbUrl.includes("supabase");
    console.log(`🔌 DB connecting... SSL: ${needsSsl ? "YES" : "NO (internal)"}`);
    const pool = new pg_1.Pool({
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
    const adapter = new adapter_pg_1.PrismaPg(pool);
    return new client_1.PrismaClient({ adapter, log: ["error"] });
}
exports.prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = exports.prisma;
//# sourceMappingURL=client.js.map