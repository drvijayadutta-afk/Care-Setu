import type { FastifyInstance } from "fastify";
import type { IPatientRepository, IRecordRepository, IConversationRepository } from "../repositories/types";
import type { AiPort } from "../ports/ai";
import type { StoragePort } from "../ports/storage";
import { ClaudeAiImplementation } from "../ports/implementations/claude-ai.impl";
import { SupabaseStorageImplementation } from "../ports/implementations/supabase-storage.impl";
import { registerPatientRoutes } from "./routes/patients";
import { registerRecordRoutes } from "./routes/records";
import { registerAppointmentRoutes } from "./routes/appointments";
import { registerMessageRoutes } from "./routes/messages";
import { registerTumorBoardRoutes } from "./routes/tumor-board";
import { registerActivityFeedRoutes } from "./routes/activity-feed";
import { registerDoctorRoutes } from "./routes/doctors";
import { registerReferralRoutes } from "./routes/referrals";
import { registerAuditRoutes } from "./routes/audit";
import { registerOutcomesRoutes } from "./routes/outcomes";
import { registerDoctorTodayRoutes } from "./routes/doctor-today";
import { registerDoctorCareRecordRoutes } from "./routes/doctor-care-record";

export async function registerApiRoutes(fastify: FastifyInstance) {
  const auth = [(fastify as any).authenticate];

  // Get injected repositories
  const patientRepo = (fastify as any).patientRepo as IPatientRepository;
  const recordRepo = (fastify as any).recordRepo as IRecordRepository;
  const conversationRepo = (fastify as any).conversationRepo as IConversationRepository;

  // Instantiate ports
  const aiPort: AiPort = new ClaudeAiImplementation();
  const storagePort: StoragePort = new SupabaseStorageImplementation();

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
  registerPatientRoutes(fastify, patientRepo, conversationRepo, recordRepo, aiPort);
  registerRecordRoutes(fastify, recordRepo, aiPort, storagePort);
  registerAppointmentRoutes(fastify, recordRepo);
  registerMessageRoutes(fastify, patientRepo, conversationRepo);
  registerTumorBoardRoutes(fastify, aiPort);
  registerActivityFeedRoutes(fastify);
  registerDoctorRoutes(fastify);
  registerReferralRoutes(fastify);
  registerAuditRoutes(fastify);
  registerOutcomesRoutes(fastify);
  registerDoctorTodayRoutes(fastify);
  registerDoctorCareRecordRoutes(fastify);
}
