/**
 * Hook 4: Doctor Inbox routes
 *
 * GET  /doctor/inbox?status=urgent&limit=20&before=<ISO>
 *   → Returns triaged inbound messages for the doctor's patients.
 *     status: urgent | routine | educational | all (default: urgent)
 *
 * POST /doctor/inbox/:messageId/escalate
 *   → Mark message as needing in-person follow-up (sets triageUrgency = 'high',
 *     creates an Alert if not already present).
 *
 * Full reply (POST /doctor/inbox/:messageId/reply) is planned for Hook 4 full —
 * not included in this MVP which is classification-only.
 */

import type { FastifyInstance } from "fastify";
import { requireDoctorAccess } from "../middleware/doctor-scope";
import { prisma } from "../../db/client";

export function registerDoctorInboxRoutes(fastify: FastifyInstance) {
  const auth = [(fastify as any).authenticate, requireDoctorAccess];

  // ─── GET /doctor/inbox ───────────────────────────────────────────────────

  fastify.get("/doctor/inbox", { preHandler: auth }, async (request, reply) => {
    const user = (request as any).user as { doctorId: string };
    const query = request.query as {
      status?: string;
      limit?: string;
      before?: string;
    };

    const category = query.status === "all" ? undefined : (query.status ?? "urgent");
    const limit = Math.min(parseInt(query.limit ?? "20", 10), 50);
    const before = query.before ? new Date(query.before) : undefined;

    // Find all active patients on this doctor's care team
    const careTeamPatientIds = await prisma.careTeamMember.findMany({
      where: { doctorId: user.doctorId, isActive: true },
      select: { patientId: true },
    });
    const patientIds = careTeamPatientIds.map((m) => m.patientId);

    if (patientIds.length === 0) {
      return { messages: [], total: 0 };
    }

    // Fetch triaged inbound messages
    const messages = await prisma.conversation.findMany({
      where: {
        patientId: { in: patientIds },
        role: "user",
        triageCategory: category ? { equals: category } : { not: null },
        repliedAt: null, // only unreplied
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: [
        // urgent/high first, then by recency
        { triageUrgency: "asc" },
        { createdAt: "desc" },
      ],
      take: limit,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            cancerType: true,
            stage: true,
            treatmentProtocol: true,
            currentCycle: true,
            checkins: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { score: true, createdAt: true },
            },
            alerts: {
              where: { resolved: false },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { severity: true, message: true },
            },
          },
        },
      },
    });

    // Shape response — patient name is included here (doctor has care team access,
    // which is a higher trust level than the list-only brief view)
    const shaped = messages.map((m) => ({
      messageId: m.id,
      patientId: m.patientId,
      patientName: m.patient.name,
      cancerType: m.patient.cancerType,
      stage: m.patient.stage,
      treatmentProtocol: m.patient.treatmentProtocol,
      currentCycle: m.patient.currentCycle,
      lastCheckinScore: m.patient.checkins[0]?.score,
      lastCheckinAt: m.patient.checkins[0]?.createdAt,
      activeAlertSeverity: m.patient.alerts[0]?.severity,
      activeAlertMessage: m.patient.alerts[0]?.message,
      // Message data
      content: m.content,
      triageCategory: m.triageCategory,
      triageUrgency: m.triageUrgency,
      suggestedReply: m.suggestedReply,
      triagedAt: m.triagedAt,
      receivedAt: m.createdAt,
    }));

    return { messages: shaped, total: shaped.length };
  });

  // ─── POST /doctor/inbox/:messageId/escalate ──────────────────────────────

  fastify.post(
    "/doctor/inbox/:messageId/escalate",
    { preHandler: auth },
    async (request, reply) => {
      const user = (request as any).user as { doctorId: string };
      const { messageId } = request.params as { messageId: string };

      const message = await prisma.conversation.findUnique({
        where: { id: messageId },
        select: { patientId: true, content: true },
      });
      if (!message) return reply.status(404).send({ error: "Message not found" });

      // Verify doctor has access to this patient
      const isMember = await prisma.careTeamMember.findFirst({
        where: { patientId: message.patientId, doctorId: user.doctorId, isActive: true },
      });
      if (!isMember && process.env.PATIENT_SCOPE_NO_ENFORCE !== "true") {
        return reply.status(403).send({ error: "Not on care team" });
      }

      // Bump urgency to high and create an alert
      await prisma.conversation.update({
        where: { id: messageId },
        data: { triageUrgency: "high", triageCategory: "urgent" },
      });

      await prisma.alert.create({
        data: {
          patientId: message.patientId,
          type: "doctor_escalation",
          severity: "high",
          message: `Doctor escalated patient message for in-person follow-up: "${message.content.slice(0, 100)}"`,
          doctorNotified: true,
        },
      });

      return { ok: true };
    }
  );

  // ─── GET /doctor/inbox/counts ────────────────────────────────────────────
  // Quick badge count for the tab indicator

  fastify.get("/doctor/inbox/counts", { preHandler: auth }, async (request) => {
    const user = (request as any).user as { doctorId: string };

    const careTeamPatientIds = await prisma.careTeamMember.findMany({
      where: { doctorId: user.doctorId, isActive: true },
      select: { patientId: true },
    });
    const patientIds = careTeamPatientIds.map((m) => m.patientId);

    if (patientIds.length === 0) {
      return { urgent: 0, routine: 0, educational: 0, total: 0 };
    }

    const [urgent, routine, educational] = await Promise.all([
      prisma.conversation.count({
        where: { patientId: { in: patientIds }, role: "user", triageCategory: "urgent", repliedAt: null },
      }),
      prisma.conversation.count({
        where: { patientId: { in: patientIds }, role: "user", triageCategory: "routine", repliedAt: null },
      }),
      prisma.conversation.count({
        where: { patientId: { in: patientIds }, role: "user", triageCategory: "educational", repliedAt: null },
      }),
    ]);

    return { urgent, routine, educational, total: urgent + routine + educational };
  });
}
