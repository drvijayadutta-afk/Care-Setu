import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";

export function registerOutcomesRoutes(fastify: FastifyInstance) {
  const auth = [(fastify as any).authenticate];
  const adminOnly = [...auth, requireAdmin(fastify)];

  fastify.get("/admin/outcomes", { preHandler: adminOnly }, async (request) => {
    const query = request.query as { days?: string };
    const days = Math.min(Number(query.days ?? 30), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalPatients,
      activePatients,
      checkins,
      alerts,
      meetings,
      documents,
      medications,
    ] = await Promise.all([
      prisma.patient.count({ where: { isActive: true } }),
      prisma.patient.count({ where: { isActive: true, onboardingStep: { gte: 9 } } }),
      prisma.checkin.findMany({
        where: { createdAt: { gte: since } },
        select: { score: true, symptoms: true, cycleDay: true, createdAt: true, patientId: true },
      }),
      prisma.alert.findMany({
        where: { createdAt: { gte: since } },
        select: { severity: true, type: true, resolved: true, resolvedAt: true, createdAt: true },
      }),
      prisma.tumorBoardMeeting.findMany({
        where: { createdAt: { gte: since } },
        select: {
          status: true,
          consensusReached: true,
          createdAt: true,
          participants: { select: { signedOff: true } },
        },
      }),
      prisma.patientDocument.count({ where: { createdAt: { gte: since } } }),
      prisma.medicationLog.count({ where: { createdAt: { gte: since } } }),
    ]);

    // ─── Checkin aggregations ────────────────────────────────
    const avgScore =
      checkins.length > 0
        ? checkins.reduce((s, c) => s + c.score, 0) / checkins.length
        : null;

    const lowScoreCount = checkins.filter((c) => c.score <= 2).length;

    // Symptom frequency across all check-ins
    const symptomFreq: Record<string, number> = {};
    for (const c of checkins) {
      for (const s of c.symptoms) {
        symptomFreq[s] = (symptomFreq[s] ?? 0) + 1;
      }
    }
    const topSymptoms = Object.entries(symptomFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([symptom, count]) => ({ symptom, count }));

    // Daily average scores for trend
    const dailyScores: Record<string, { sum: number; count: number }> = {};
    for (const c of checkins) {
      const day = c.createdAt.toISOString().slice(0, 10);
      if (!dailyScores[day]) dailyScores[day] = { sum: 0, count: 0 };
      dailyScores[day].sum += c.score;
      dailyScores[day].count += 1;
    }
    const scoreByDay = Object.entries(dailyScores)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, { sum, count }]) => ({ date, avg: parseFloat((sum / count).toFixed(2)) }));

    // Check-in completion rate (patients with ≥1 check-in / total active)
    const checkinPatientIds = new Set(checkins.map((c) => c.patientId));
    const checkinCompletionRate =
      activePatients > 0 ? Math.round((checkinPatientIds.size / activePatients) * 100) : 0;

    // ─── Alert aggregations ──────────────────────────────────
    const alertsBySeverity = alerts.reduce<Record<string, number>>((acc, a) => {
      acc[a.severity] = (acc[a.severity] ?? 0) + 1;
      return acc;
    }, {});

    const resolvedAlerts = alerts.filter((a) => a.resolved);
    const avgResolutionHours =
      resolvedAlerts.length > 0
        ? resolvedAlerts.reduce((sum, a) => {
            if (!a.resolvedAt) return sum;
            return sum + (new Date(a.resolvedAt).getTime() - new Date(a.createdAt).getTime()) / 3600000;
          }, 0) / resolvedAlerts.length
        : null;

    // ─── MDT meeting aggregations ────────────────────────────
    const completedMeetings = meetings.filter((m) => m.status === "completed");
    const decisionsRecorded = meetings.filter((m) => m.consensusReached).length;
    const totalSignOffs = meetings.reduce((sum, m) => sum + m.participants.filter((p) => p.signedOff).length, 0);
    const totalParticipantSlots = meetings.reduce((sum, m) => sum + m.participants.length, 0);
    const signOffRate =
      totalParticipantSlots > 0 ? Math.round((totalSignOffs / totalParticipantSlots) * 100) : 0;

    // ─── Cancer type breakdown ────────────────────────────────
    const allPatients = await prisma.patient.findMany({
      where: { isActive: true },
      select: { cancerType: true, stage: true, treatmentProtocol: true },
    });

    const byType: Record<string, number> = {};
    for (const p of allPatients) {
      const key = p.cancerType || "Unknown";
      byType[key] = (byType[key] ?? 0) + 1;
    }
    const cancerTypeBreakdown = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));

    const byProtocol: Record<string, number> = {};
    for (const p of allPatients) {
      const key = p.treatmentProtocol || "Not specified";
      byProtocol[key] = (byProtocol[key] ?? 0) + 1;
    }
    const protocolBreakdown = Object.entries(byProtocol)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([protocol, count]) => ({ protocol, count }));

    return {
      periodDays: days,
      patients: { total: totalPatients, active: activePatients, checkinCompletion: checkinCompletionRate },
      checkins: {
        total: checkins.length,
        avgScore: avgScore != null ? parseFloat(avgScore.toFixed(2)) : null,
        lowScoreCount,
        topSymptoms,
        scoreByDay,
      },
      alerts: {
        total: alerts.length,
        bySeverity: alertsBySeverity,
        resolvedCount: resolvedAlerts.length,
        avgResolutionHours: avgResolutionHours != null ? parseFloat(avgResolutionHours.toFixed(1)) : null,
      },
      meetings: {
        total: meetings.length,
        completed: completedMeetings.length,
        decisionsRecorded,
        signOffRate,
      },
      documents: { uploaded: documents },
      medications: { logEntries: medications },
      cancerTypeBreakdown,
      protocolBreakdown,
    };
  });
}

function requireAdmin(fastify: FastifyInstance) {
  return async (request: any, reply: any) => {
    const user = (request as any).user;
    if (!user || user.role !== "ADMIN") {
      return reply.status(403).send({ error: "Admin access required" });
    }
  };
}
