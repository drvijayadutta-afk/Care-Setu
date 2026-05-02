import type { FastifyInstance } from "fastify";
import type { IPatientRepository, IRecordRepository, IConversationRepository } from "../repositories/types";
import { registerPatientRoutes } from "./routes/patients";
import { registerRecordRoutes } from "./routes/records";
import { registerAppointmentRoutes } from "./routes/appointments";
import { registerMessageRoutes } from "./routes/messages";

export async function registerApiRoutes(fastify: FastifyInstance) {
  const auth = [(fastify as any).authenticate];

  // Get injected repositories
  const patientRepo = (fastify as any).patientRepo as IPatientRepository;
  const recordRepo = (fastify as any).recordRepo as IRecordRepository;
  const conversationRepo = (fastify as any).conversationRepo as IConversationRepository;

  // DB diagnostics (public — used by Render health checks)
  fastify.get("/diag/db", async (request, reply) => {
    try {
      const count = await patientRepo.count();
      return { ok: true, count };
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error?.message ?? String(error),
        code: error?.code,
      });
    }
  });

  // Register modularized routes
  registerPatientRoutes(fastify, patientRepo, conversationRepo, recordRepo);
  registerRecordRoutes(fastify, recordRepo);
  registerAppointmentRoutes(fastify, recordRepo);
  registerMessageRoutes(fastify, patientRepo, conversationRepo);
}
