import type { FastifyInstance } from "fastify";
import { buildDoctorTodayBrief } from "../services/doctor-brief.service";
import { requireDoctorAccess } from "../middleware/doctor-scope";

export function registerDoctorTodayRoutes(fastify: FastifyInstance) {
  const auth = [(fastify as any).authenticate, requireDoctorAccess];

  // GET /doctor/today?date=YYYY-MM-DD (optional, defaults to today UTC)
  fastify.get("/doctor/today", { preHandler: auth }, async (request, reply) => {
    const user = (request as any).user as { doctorId?: string };
    if (!user.doctorId) {
      return reply.status(403).send({ error: "Doctor identity missing in session" });
    }

    const { date } = request.query as { date?: string };
    let target: Date;
    if (date) {
      const parsed = new Date(`${date}T00:00:00Z`);
      if (isNaN(parsed.getTime())) {
        return reply.status(400).send({ error: "Invalid date — expected YYYY-MM-DD" });
      }
      target = parsed;
    } else {
      target = new Date();
    }

    return await buildDoctorTodayBrief(user.doctorId, target);
  });
}
