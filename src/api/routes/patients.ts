import type { FastifyInstance } from "fastify";
import type { IPatientRepository, IConversationRepository, IRecordRepository } from "../../repositories/types";
import type { AiPort } from "../../ports/ai";
import { getMdtSummary } from "../services/mdt-summary.service";

export function registerPatientRoutes(
  fastify: FastifyInstance,
  patientRepo: IPatientRepository,
  conversationRepo: IConversationRepository,
  recordRepo: IRecordRepository,
  aiPort: AiPort
) {
  const auth = [(fastify as any).authenticate];
  const authScope = [...auth, (fastify as any).requirePatientAccess];

  fastify.get("/patients", { preHandler: auth }, async (request, reply) => {
    const user = (request as any).user as { sub: string; role: string };
    // ADMIN sees all patients; COORDINATORs see their assigned patients plus
    // unassigned patients (null assignedCoordinatorId) during the backfill window.
    if (user.role === "ADMIN") {
      return await patientRepo.findMany();
    }
    return await patientRepo.findMany({ coordinatorId: user.sub });
  });

  fastify.get("/patients/:id", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const patient = await patientRepo.findUnique(id);
    if (!patient) return reply.status(404).send({ error: "Patient not found" });
    return patient;
  });

  fastify.get("/patients/:id/conversations", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return await conversationRepo.findMany(id);
  });

  fastify.get("/patients/:id/checkins", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return await recordRepo.checkins.findMany(id);
  });

  fastify.get("/patients/:id/complete", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const patient = await patientRepo.findUnique(id);
    if (!patient) return reply.status(404).send({ error: "Patient not found" });

    const hasWhatsApp = !!patient.whatsappNumber;
    const hasTelegram = !!patient.telegramChatId;
    const hasPreferredChannel = !!patient.preferredMessagingChannel;
    const step = patient.onboardingStep ?? 0;

    return {
      whatsappConnected: hasWhatsApp,
      telegramConnected: hasTelegram,
      preferredChannelSet: hasPreferredChannel,
      onboardingStep: step,
      isComplete: hasWhatsApp && hasTelegram && hasPreferredChannel && step >= 9,
    };
  });

  fastify.get("/patients/:id/mdt-summary", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const summary = await getMdtSummary(id, aiPort);
      return { summary };
    } catch (error: any) {
      if (error.message === "Patient not found") {
        return reply.status(404).send({ error: "Patient not found" });
      }
      throw error;
    }
  });
}
