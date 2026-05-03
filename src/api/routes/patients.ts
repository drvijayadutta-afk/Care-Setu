import type { FastifyInstance } from "fastify";
import type { IPatientRepository, IConversationRepository, IRecordRepository } from "../../repositories/types";
import type { AiPort } from "../../ports/ai";
import { getMdtSummary } from "../services/mdt-summary.service";
import { logAccess } from "../services/audit-logger.service";
import { prisma } from "../../db/client";

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

  // Manual patient creation — ADMIN only. Used for clinic walk-ins, referrals,
  // and patients without smartphones who can't onboard via WhatsApp.
  fastify.post("/admin/patients", { preHandler: auth }, async (request, reply) => {
    const user = (request as any).user as { sub: string; role: string };
    if (user.role !== "ADMIN") {
      return reply.status(403).send({ error: "ADMIN role required" });
    }

    const body = request.body as {
      name: string;
      whatsappNumber?: string;
      cancerType: string;
      treatmentProtocol?: string;
      stage?: string;
      hospitalName: string;
      doctorName?: string;
      gender?: string;
      dateOfBirth?: string;
      assignedCoordinatorId?: string;
    };

    if (!body.name || !body.cancerType || !body.hospitalName) {
      return reply.status(400).send({
        error: "name, cancerType, and hospitalName are required",
      });
    }

    // Generate a placeholder unique number for patients without WhatsApp;
    // they can be linked later when they message in.
    const whatsappNumber = body.whatsappNumber?.trim()
      || `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const patient = await patientRepo.create({
      whatsappNumber,
      name: body.name,
      cancerType: body.cancerType,
      treatmentProtocol: body.treatmentProtocol || "Manual",
      cycleStartDate: new Date(),
      hospitalName: body.hospitalName,
      doctorName: body.doctorName || "TBD",
      stage: body.stage || null,
      gender: body.gender || null,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      assignedCoordinatorId: body.assignedCoordinatorId || user.sub,
      onboardingStep: 9, // Skip chat onboarding — admin filled this in
      isActive: true,
    });

    return reply.status(201).send(patient);
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

  fastify.get("/patients/:id/outbound-messages", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string; cursor?: string; messageType?: string };
    const limit = Math.min(Number(query.limit ?? 50), 100);
    const where: any = { patientId: id };
    if (query.messageType) where.messageType = query.messageType;
    if (query.cursor) where.sentAt = { lt: new Date(query.cursor) };
    return await prisma.outboundMessage.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: limit,
    });
  });

  fastify.get("/patients/:id/alerts", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { resolved?: string; limit?: string };
    const where: any = { patientId: id };
    if (query.resolved !== undefined) where.resolved = query.resolved === "true";
    return await prisma.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(query.limit ?? 50), 100),
    });
  });

  fastify.get("/patients/:id/medications", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return await prisma.medication.findMany({
      where: { patientId: id },
      orderBy: { createdAt: "desc" },
    });
  });

  fastify.delete("/patients/:id", { preHandler: auth }, async (request, reply) => {
    const user = (request as any).user as { role: string };
    if (user.role !== "ADMIN") return reply.status(403).send({ error: "ADMIN role required" });
    const { id } = request.params as { id: string };
    const patient = await patientRepo.findUnique(id);
    if (!patient) return reply.status(404).send({ error: "Patient not found" });
    await prisma.patient.update({ where: { id }, data: { isActive: false } });
    return reply.status(204).send();
  });

  fastify.get("/patients/:id/mdt-summary", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user as { sub: string; role: string; hospitalName?: string };
    try {
      const summary = await getMdtSummary(id, aiPort);
      logAccess({
        coordinatorId: user.sub,
        patientId: id,
        action: "mdt_brief_generated",
        resourceType: "patient_summary",
        resourceId: id,
        isOutOfScope: false,
        isCrossHospital: false,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
      return { summary };
    } catch (error: any) {
      if (error.message === "Patient not found") {
        return reply.status(404).send({ error: "Patient not found" });
      }
      if (error.message?.startsWith("AI service error")) {
        return reply.status(503).send({ error: error.message });
      }
      throw error;
    }
  });
}
