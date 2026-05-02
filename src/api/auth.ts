import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "../db/client";
import { config } from "../config/env";

export async function registerAuthRoutes(fastify: FastifyInstance) {
  // POST /auth/login — rate limited by global Fastify rate-limit plugin (5 attempts per 15 minutes).
  // TODO: override to stricter config via @fastify/rate-limit { store } option once Redis available.
  fastify.post<{ Body: { email?: string; password?: string } }>(
    "/auth/login",
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

      return {
        token,
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
}
