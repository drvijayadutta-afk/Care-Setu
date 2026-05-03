import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";
import { sendText } from "../../webhook/sender";
import { logOutbound } from "../services/outbound-logger.service";
import { wsManager } from "../../websocket/manager";

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["accepted", "declined"],
  accepted: ["seen"],
  seen: ["completed"],
  completed: [],
  declined: [],
};

export function registerReferralRoutes(fastify: FastifyInstance) {
  const auth = [(fastify as any).authenticate];
  const authScope = [...auth, (fastify as any).requirePatientAccess];

  // Create referral for a patient
  fastify.post("/patients/:id/referrals", { preHandler: authScope }, async (request, reply) => {
    const { id: patientId } = request.params as { id: string };
    const user = (request as any).user as { sub: string; name: string; hospitalName?: string };
    const body = request.body as {
      toDoctorId: string;
      reason: string;
      urgency?: string;
      clinicalContext?: string;
    };

    if (!body.toDoctorId || !body.reason) {
      return reply.status(400).send({ error: "toDoctorId and reason are required" });
    }

    const [patient, toDoctor] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId } }),
      prisma.doctor.findUnique({ where: { id: body.toDoctorId } }),
    ]);
    if (!patient) return reply.status(404).send({ error: "Patient not found" });
    if (!toDoctor) return reply.status(404).send({ error: "Target doctor not found" });

    const referral = await prisma.referral.create({
      data: {
        patientId,
        fromCoordinatorId: user.sub,
        toDoctorId: body.toDoctorId,
        reason: body.reason,
        urgency: body.urgency ?? "routine",
        clinicalContext: body.clinicalContext ?? null,
      },
      include: { toDoctor: true, fromCoordinator: { select: { name: true } } },
    });

    // Notify referred doctor via WhatsApp if opted in
    if (toDoctor.isOptedIn && toDoctor.whatsappNumber) {
      const urgencyEmoji = body.urgency === "emergency" ? "🚨" : body.urgency === "urgent" ? "⚠️" : "📋";
      const msg = `${urgencyEmoji} Referral — ${patient.name} (${patient.cancerType}${patient.stage ? `, Stage ${patient.stage}` : ""})\nFrom: ${user.name}\nUrgency: ${body.urgency ?? "routine"}\nReason: ${body.reason}\n\nLog in to Care Setu to view and accept.`;

      try {
        const externalId = await sendText(toDoctor.whatsappNumber, msg);
        logOutbound({
          patientId,
          channel: "whatsapp",
          recipientRef: toDoctor.whatsappNumber,
          messageType: "referral_notification",
          content: msg,
          externalId,
        });
        await prisma.referral.update({ where: { id: referral.id }, data: { notificationSent: true } });
      } catch (err) {
        console.error("[referral] WhatsApp notification failed:", err);
      }
    }

    // Broadcast to global feed
    wsManager.broadcastGlobal({
      type: "activity",
      patientId,
      patientName: patient.name ?? "Patient",
      eventKind: "referral",
      summary: `Referred to Dr. ${toDoctor.name} (${body.urgency ?? "routine"})`,
      timestamp: new Date().toISOString(),
    });

    return reply.status(201).send(referral);
  });

  // List referrals for a patient
  fastify.get("/patients/:id/referrals", { preHandler: authScope }, async (request) => {
    const { id: patientId } = request.params as { id: string };
    return prisma.referral.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      include: {
        toDoctor: { select: { id: true, name: true, specialization: true, department: true } },
        fromCoordinator: { select: { name: true } },
        fromDoctor: { select: { id: true, name: true } },
      },
    });
  });

  // All referrals (coordinator-scoped)
  fastify.get("/referrals", { preHandler: auth }, async (request) => {
    const user = (request as any).user as { role: string; hospitalName?: string };
    const { status, urgency, toDoctorId } = request.query as { status?: string; urgency?: string; toDoctorId?: string };

    const where: any = {};
    if (status) where.status = status;
    if (urgency) where.urgency = urgency;
    if (toDoctorId) where.toDoctorId = toDoctorId;
    // Non-admin coordinators scoped to their hospital's patients
    if (user.role !== "ADMIN" && user.hospitalName) {
      where.patient = { hospitalName: user.hospitalName };
    }

    return prisma.referral.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        patient: { select: { id: true, name: true, cancerType: true } },
        toDoctor: { select: { id: true, name: true, specialization: true } },
        fromCoordinator: { select: { name: true } },
      },
    });
  });

  // Single referral
  fastify.get("/referrals/:referralId", { preHandler: auth }, async (request, reply) => {
    const { referralId } = request.params as { referralId: string };
    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      include: {
        patient: true,
        toDoctor: true,
        fromCoordinator: { select: { name: true } },
        fromDoctor: { select: { name: true } },
      },
    });
    if (!referral) return reply.status(404).send({ error: "Referral not found" });
    return referral;
  });

  // Update referral status (state machine enforced)
  fastify.patch("/referrals/:referralId/status", { preHandler: auth }, async (request, reply) => {
    const { referralId } = request.params as { referralId: string };
    const { status, declineReason } = request.body as { status: string; declineReason?: string };

    const referral = await prisma.referral.findUnique({ where: { id: referralId } });
    if (!referral) return reply.status(404).send({ error: "Referral not found" });

    const allowed = VALID_TRANSITIONS[referral.status] ?? [];
    if (!allowed.includes(status)) {
      return reply.status(400).send({
        error: `Cannot transition from '${referral.status}' to '${status}'. Allowed: [${allowed.join(", ") || "none"}]`,
      });
    }

    const now = new Date();
    const update: any = { status };
    if (status === "accepted")  update.acceptedAt  = now;
    if (status === "seen")      update.seenAt       = now;
    if (status === "completed") update.completedAt  = now;
    if (status === "declined")  { update.declinedAt = now; update.declineReason = declineReason ?? null; }

    const updated = await prisma.referral.update({
      where: { id: referralId },
      data: update,
      include: { toDoctor: true, fromCoordinator: { select: { name: true } } },
    });

    return updated;
  });
}
