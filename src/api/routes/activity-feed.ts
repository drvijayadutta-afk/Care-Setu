import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";

export function registerActivityFeedRoutes(fastify: FastifyInstance) {
  const auth = [(fastify as any).authenticate];

  fastify.get("/activity-feed", { preHandler: auth }, async (request) => {
    const query = request.query as { limit?: string; cursor?: string };
    const limit = Math.min(Number(query.limit ?? 50), 100);
    const cursor = query.cursor ? new Date(query.cursor) : undefined;

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    const cursorFilter = cursor ? { lt: cursor } : undefined;

    const [checkins, alerts, messages, documents, appointments] = await Promise.all([
      prisma.checkin.findMany({
        where: { createdAt: { ...(cursorFilter ?? {}), gte: since } },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { patient: { select: { id: true, name: true } } },
      }),
      prisma.alert.findMany({
        where: { createdAt: { ...(cursorFilter ?? {}), gte: since } },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { patient: { select: { id: true, name: true } } },
      }),
      prisma.outboundMessage.findMany({
        where: { sentAt: { ...(cursorFilter ?? {}), gte: since } },
        orderBy: { sentAt: "desc" },
        take: limit,
        include: { patient: { select: { id: true, name: true } } },
      }),
      prisma.patientDocument.findMany({
        where: { isVerified: true, createdAt: { ...(cursorFilter ?? {}), gte: since } },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { patient: { select: { id: true, name: true } } },
      }),
      prisma.appointment.findMany({
        where: { createdAt: { ...(cursorFilter ?? {}), gte: since } },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { patient: { select: { id: true, name: true } } },
      }),
    ]);

    const items = [
      ...checkins.map(c => ({
        id: c.id,
        type: "checkin",
        patientId: c.patient.id,
        patientName: c.patient.name,
        summary: `Score ${c.score}/5${c.symptoms.length ? ` — ${c.symptoms.slice(0, 3).join(", ")}` : ""}`,
        createdAt: c.createdAt.toISOString(),
      })),
      ...alerts.map(a => ({
        id: a.id,
        type: "alert",
        patientId: a.patient.id,
        patientName: a.patient.name,
        summary: a.message,
        severity: a.severity,
        createdAt: a.createdAt.toISOString(),
      })),
      ...messages.map(m => ({
        id: m.id,
        type: "outbound_message",
        patientId: m.patient.id,
        patientName: m.patient.name,
        summary: `${m.messageType}: ${m.content.slice(0, 80)}${m.content.length > 80 ? "…" : ""}`,
        createdAt: m.sentAt.toISOString(),
      })),
      ...documents.map(d => ({
        id: d.id,
        type: "document_uploaded",
        patientId: d.patient.id,
        patientName: d.patient.name,
        summary: `${d.category}: ${d.title}`,
        createdAt: d.createdAt.toISOString(),
      })),
      ...appointments.map(a => ({
        id: a.id,
        type: "appointment",
        patientId: a.patient.id,
        patientName: a.patient.name,
        summary: `${a.type} with ${a.doctorName}`,
        createdAt: a.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return items;
  });
}
