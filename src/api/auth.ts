import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "../db/client";
import { config } from "../config/env";

// Convert "8h", "30m", "7d" strings to seconds for cookie Max-Age.
// Mirrors @fastify/jwt's expiresIn parsing for the cookie counterpart.
function ttlToSeconds(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) return 8 * 60 * 60; // default 8h
  const n = parseInt(m[1], 10);
  switch (m[2]) {
    case "s": return n;
    case "m": return n * 60;
    case "h": return n * 60 * 60;
    case "d": return n * 24 * 60 * 60;
    default: return 8 * 60 * 60;
  }
}

const COOKIE_NAME = "coordinator_token";

function setAuthCookie(reply: any, token: string) {
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ttlToSeconds(config.jwtTtl),
  });
}

function clearAuthCookie(reply: any) {
  reply.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "strict",
    path: "/",
  });
}

export async function registerAuthRoutes(fastify: FastifyInstance) {
  // POST /auth/login — rate limited to configured attempts per 15 minutes (default 5, keyed by IP)
  fastify.post<{ Body: { email?: string; password?: string } }>(
    "/auth/login",
    {
      config: {
        rateLimit: {
          max: config.loginRateLimit,
          timeWindow: 15 * 60 * 1000, // 15 minutes, same as global window
        },
      },
    },
    async (request, reply) => {
    const { email, password } = request.body as { email?: string; password?: string };

    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

    const coordinator = await prisma.coordinator.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!coordinator || !coordinator.isActive) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, coordinator.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    await prisma.coordinator.update({
      where: { id: coordinator.id },
      data: { lastLoginAt: new Date() },
    });

      const token = (fastify as any).jwt.sign(
        {
          sub: coordinator.id,
          email: coordinator.email,
          name: coordinator.name,
          role: coordinator.role,
          hospitalName: coordinator.hospitalName,
        },
        { expiresIn: config.jwtTtl }
      );

      // Set the JWT as an HttpOnly cookie so it cannot be read by JS (XSS defense).
      setAuthCookie(reply, token);

      // Token no longer returned in body — frontend must rely on the cookie.
      return {
        coordinator: {
          id: coordinator.id,
          email: coordinator.email,
          name: coordinator.name,
          role: coordinator.role,
          hospitalName: coordinator.hospitalName,
        },
      };
    }
  );

  // POST /auth/logout — clears the HttpOnly auth cookie. Idempotent.
  fastify.post("/auth/logout", async (_request, reply) => {
    clearAuthCookie(reply);
    return { ok: true };
  });

  // GET /auth/me — verify token + return coordinator info
  fastify.get("/auth/me", {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const user = (request as any).user;
    return {
      id: user.sub,
      email: user.email,
      name: user.name,
      role: user.role,
      hospitalName: user.hospitalName,
    };
  });

  // POST /auth/ws-ticket — issues a short-lived (60s) JWT for WebSocket connections.
  // Browsers don't send cookies with cross-origin WebSocket handshakes, so the
  // frontend must fetch this ticket (via the auth cookie) and pass it as ?token=
  // on the ws:// URL.
  fastify.post("/auth/ws-ticket", {
    preHandler: [(fastify as any).authenticate],
  }, async (request) => {
    const user = (request as any).user;
    const token = (fastify as any).jwt.sign(
      {
        sub: user.sub,
        email: user.email,
        name: user.name,
        role: user.role,
        hospitalName: user.hospitalName,
      },
      { expiresIn: "60s" }
    );
    return { token };
  });
}
