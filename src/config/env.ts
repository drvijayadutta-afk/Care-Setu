import "dotenv/config";
import { z } from "zod";

const DEV_JWT_SECRET_FALLBACK = "dev-secret-change-in-production";
const MIN_JWT_SECRET_LENGTH = 32;

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  JWT_SECRET: z.string().optional(),
  ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((v) =>
      v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [
        "http://localhost:3001",
        "http://localhost:3000",
        "https://coordinator-app-self.vercel.app",
        "https://care-setu-lac.vercel.app",
      ]
    ),
  // Set to "true" to disable patient-scope enforcement (log-only during local dev).
  // Default is ENFORCE (403 on cross-scope access) — opt-out, not opt-in.
  PATIENT_SCOPE_NO_ENFORCE: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .default(false),
  // Database SSL mode: "require" (enforce SSL), "disable" (no SSL), "auto" (detect from URL)
  DATABASE_SSL: z
    .enum(["require", "disable", "auto"])
    .optional()
    .default("auto"),
  // JWT token expiration (e.g., "8h", "7d", "24h")
  JWT_TTL: z.string().optional().default("8h"),
  // Base URL of the coordinator app — used to generate deep-links in WhatsApp messages
  // so PHI is never sent in message bodies (only accessible behind auth).
  COORDINATOR_APP_URL: z.string().url().optional().default("https://care-setu-lac.vercel.app"),
  // Rate limiting for /auth/login (requests per 15 minutes)
  LOGIN_RATE_LIMIT: z.coerce.number().int().positive().optional().default(5),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

function resolveJwtSecret(): string {
  const provided = env.JWT_SECRET?.trim();

  if (env.NODE_ENV === "production") {
    if (!provided) {
      throw new Error("JWT_SECRET must be set in production");
    }
    if (provided === DEV_JWT_SECRET_FALLBACK) {
      throw new Error(
        `JWT_SECRET is set to the development placeholder ("${DEV_JWT_SECRET_FALLBACK}"); refusing to boot`
      );
    }
    if (provided.length < MIN_JWT_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters (got ${provided.length})`
      );
    }
    return provided;
  }

  if (provided && provided.length >= MIN_JWT_SECRET_LENGTH) {
    return provided;
  }

  if (provided) {
    console.warn(
      `⚠️  JWT_SECRET is shorter than ${MIN_JWT_SECRET_LENGTH} chars — accepted in ${env.NODE_ENV} only`
    );
    return provided;
  }

  console.warn(`⚠️  JWT_SECRET not set — using dev fallback (refused in production)`);
  return DEV_JWT_SECRET_FALLBACK;
}

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  jwtSecret: resolveJwtSecret(),
  allowedOrigins: env.ALLOWED_ORIGINS,
  patientScopeNoEnforce: env.PATIENT_SCOPE_NO_ENFORCE,
  databaseSsl: env.DATABASE_SSL,
  jwtTtl: env.JWT_TTL,
  loginRateLimit: env.LOGIN_RATE_LIMIT,
  coordinatorAppUrl: env.COORDINATOR_APP_URL,
} as const;

export type AppConfig = typeof config;
