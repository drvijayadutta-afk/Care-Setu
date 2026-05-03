import type { FastifyInstance } from "fastify";
import { issueMagicLink, verifyMagicLink } from "../services/magic-link.service";
import { sendText } from "../../webhook/sender";
import { prisma } from "../../db/client";
import { config } from "../../config/env";

const COOKIE_NAME = "coordinator_token"; // single cookie for both roles
const DOCTOR_TOKEN_TTL = "8h";

function ttlToSeconds(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) return 8 * 60 * 60;
  const n = parseInt(m[1], 10);
  switch (m[2]) {
    case "s": return n;
    case "m": return n * 60;
    case "h": return n * 60 * 60;
    case "d": return n * 24 * 60 * 60;
    default: return 8 * 60 * 60;
  }
}

export async function registerDoctorAuthRoutes(fastify: FastifyInstance) {
  // POST /auth/doctor/request-magic-link
  // Rate-limited per IP to slow down email enumeration probes.
  // Always returns 200 — never reveal whether an email is registered.
  fastify.post<{ Body: { email?: string } }>(
    "/auth/doctor/request-magic-link",
    {
      config: {
        rateLimit: { max: 5, timeWindow: 15 * 60 * 1000 },
      },
    },
    async (request, reply) => {
      const { email } = request.body ?? {};
      if (!email || typeof email !== "string") {
        return reply.status(400).send({ error: "Email is required" });
      }

      const issued = await issueMagicLink(email);
      if (issued) {
        const link = `${config.coordinatorAppUrl}/doctor/login/verify?token=${encodeURIComponent(issued.rawToken)}`;
        const msg = `🔐 Care Setu sign-in link (valid for 15 minutes):\n${link}\n\nIf you did not request this, ignore this message.`;

        // Find doctor's WhatsApp number to send link
        const doctor = await prisma.doctor.findFirst({
          where: { email: email.toLowerCase().trim() },
          select: { whatsappNumber: true },
        });
        if (doctor?.whatsappNumber) {
          await sendText(doctor.whatsappNumber, msg).catch((err) =>
            console.error("[doctor-auth] WhatsApp magic-link send failed:", err)
          );
        }
      }

      // Always 200 — no email enumeration leak
      return { ok: true };
    }
  );

  // POST /auth/doctor/verify { token }
  // Consumes the magic-link token, sets the auth cookie, returns doctor info.
  fastify.post<{ Body: { token?: string } }>(
    "/auth/doctor/verify",
    async (request, reply) => {
      const { token } = request.body ?? {};
      if (!token || typeof token !== "string") {
        return reply.status(400).send({ error: "Token is required" });
      }

      const doctorUser = await verifyMagicLink(token);
      if (!doctorUser) {
        return reply.status(401).send({ error: "Invalid or expired token" });
      }

      const jwt = (fastify as any).jwt.sign(
        {
          sub: doctorUser.id, // DoctorUser.id (NOT Doctor.id) — auth identity
          doctorId: doctorUser.doctorId, // Doctor.id — clinical identity
          email: doctorUser.email,
          name: doctorUser.doctor.name,
          role: "DOCTOR",
          hospitalName: doctorUser.doctor.hospitalName,
        },
        { expiresIn: DOCTOR_TOKEN_TTL }
      );

      reply.setCookie(COOKIE_NAME, jwt, {
        httpOnly: true,
        secure: config.nodeEnv === "production",
        sameSite: "strict",
        path: "/",
        maxAge: ttlToSeconds(DOCTOR_TOKEN_TTL),
      });

      return {
        doctor: {
          id: doctorUser.doctorId,
          name: doctorUser.doctor.name,
          email: doctorUser.email,
          hospitalName: doctorUser.doctor.hospitalName,
          specialization: doctorUser.doctor.specialization,
        },
      };
    }
  );

  // GET /auth/doctor/me — returns the current doctor (cookie auth)
  fastify.get(
    "/auth/doctor/me",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      const user = (request as any).user;
      if (user.role !== "DOCTOR") {
        return reply.status(403).send({ error: "Doctor role required" });
      }
      return {
        id: user.doctorId,
        name: user.name,
        email: user.email,
        hospitalName: user.hospitalName,
      };
    }
  );
}
