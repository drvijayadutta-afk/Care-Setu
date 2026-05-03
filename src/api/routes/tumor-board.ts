import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";
import type { AiPort } from "../../ports/ai";
import { getMdtSummary } from "../services/mdt-summary.service";

export function registerTumorBoardRoutes(fastify: FastifyInstance, aiPort: AiPort) {
  const auth = [(fastify as any).authenticate];
  const authScope = [...auth, (fastify as any).requirePatientAccess];

  // List meetings for a patient
  fastify.get("/patients/:id/tumor-board-meetings", { preHandler: authScope }, async (request) => {
    const { id } = request.params as { id: string };
    return await prisma.tumorBoardMeeting.findMany({
      where: { patientId: id },
      orderBy: { scheduledAt: "desc" },
      include: { participants: true },
    });
  });

  // Create a meeting — auto-populates participants from active care team members
  fastify.post("/patients/:id/tumor-board-meetings", { preHandler: authScope }, async (request, reply) => {
    const { id: patientId } = request.params as { id: string };
    const user = (request as any).user as { sub: string };
    const body = request.body as {
      title: string;
      scheduledAt: string;
      mode?: string;
      agenda?: string;
    };

    if (!body.title || !body.scheduledAt) {
      return reply.status(400).send({ error: "title and scheduledAt are required" });
    }

    const careTeam = await prisma.careTeamMember.findMany({
      where: { patientId, isActive: true },
    });

    const meeting = await prisma.tumorBoardMeeting.create({
      data: {
        patientId,
        title: body.title,
        scheduledAt: new Date(body.scheduledAt),
        mode: body.mode || "sync",
        agenda: body.agenda || null,
        createdBy: user.sub,
        participants: {
          create: careTeam.map(m => ({
            name: m.name,
            role: m.role,
            email: m.email,
            phone: m.phone,
          })),
        },
      },
      include: { participants: true },
    });

    return reply.status(201).send(meeting);
  });

  // Single meeting detail
  fastify.get("/tumor-board-meetings/:mid", { preHandler: auth }, async (request, reply) => {
    const { mid } = request.params as { mid: string };
    const meeting = await prisma.tumorBoardMeeting.findUnique({
      where: { id: mid },
      include: { participants: true, patient: true },
    });
    if (!meeting) return reply.status(404).send({ error: "Meeting not found" });
    return meeting;
  });

  // Update meeting (status, decision, notes, consensus)
  fastify.patch("/tumor-board-meetings/:mid", { preHandler: auth }, async (request, reply) => {
    const { mid } = request.params as { mid: string };
    const body = request.body as Partial<{
      title: string;
      status: string;
      mode: string;
      agenda: string;
      decision: any;
      consensusReached: boolean;
      meetingNotes: string;
      scheduledAt: string;
    }>;

    const data: any = { ...body };
    if (body.scheduledAt) data.scheduledAt = new Date(body.scheduledAt);

    const meeting = await prisma.tumorBoardMeeting.update({
      where: { id: mid },
      data,
      include: { participants: true },
    });
    return meeting;
  });

  // Cancel meeting
  fastify.delete("/tumor-board-meetings/:mid", { preHandler: auth }, async (request, reply) => {
    const { mid } = request.params as { mid: string };
    await prisma.tumorBoardMeeting.update({
      where: { id: mid },
      data: { status: "cancelled" },
    });
    return reply.status(204).send();
  });

  // Doctor sign-off
  fastify.patch("/tumor-board-meetings/:mid/participants/:pid/sign-off", { preHandler: auth }, async (request, reply) => {
    const { pid } = request.params as { mid: string; pid: string };
    const body = request.body as { signedOff: boolean; comments?: string };

    const participant = await prisma.tumorBoardParticipant.update({
      where: { id: pid },
      data: {
        signedOff: body.signedOff,
        signedOffAt: body.signedOff ? new Date() : null,
        comments: body.comments,
        attendanceStatus: body.signedOff ? "attended" : "invited",
      },
    });
    return participant;
  });

  // Generate AI brief and snapshot it into the meeting record
  fastify.post("/tumor-board-meetings/:mid/brief", { preHandler: auth }, async (request, reply) => {
    const { mid } = request.params as { mid: string };
    const meeting = await prisma.tumorBoardMeeting.findUnique({ where: { id: mid } });
    if (!meeting) return reply.status(404).send({ error: "Meeting not found" });

    try {
      const briefText = await getMdtSummary(meeting.patientId, aiPort);
      const updated = await prisma.tumorBoardMeeting.update({
        where: { id: mid },
        data: { briefText },
      });
      return { briefText: updated.briefText };
    } catch (error: any) {
      if (error.message?.startsWith("AI service error")) {
        return reply.status(503).send({ error: error.message });
      }
      throw error;
    }
  });
}
