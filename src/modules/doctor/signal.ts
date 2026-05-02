import { prisma } from "../../db/client";
import { messagingRouter } from "../../messaging/router";
import { askClaudeJSON } from "../../integrations/claude";
import { WEEKLY_SIGNAL_PROMPT } from "../../ai/prompts";

interface PatientSignal {
  trend: "improving" | "stable" | "declining";
  isSignalWorthy: boolean;
  avgScore: number;
  topSymptoms: string[];
  nightDistressCount: number;
  doctorNote: string | null;
}

// BullMQ job: runs every Sunday at 7 PM
export async function sendDoctorWeeklySignals() {
  const doctors = await prisma.doctor.findMany({ where: { isOptedIn: true } });

  for (const doctor of doctors) {
    await sendSignalForDoctor(doctor.id, doctor.whatsappNumber, doctor.name);
  }
}

async function sendSignalForDoctor(
  doctorId: string,
  whatsappNumber: string,
  doctorName: string
) {
  const patients = await prisma.patient.findMany({
    where: { doctorId, isActive: true },
    include: {
      appointments: {
        where: { scheduledAt: { gte: new Date() }, status: "confirmed" },
        orderBy: { scheduledAt: "asc" },
        take: 1,
      },
    },
  });

  if (patients.length === 0) return;

  const signalLines: string[] = [];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const patient of patients) {
    const checkins = await prisma.checkin.findMany({
      where: { patientId: patient.id, createdAt: { gte: weekAgo } },
      select: { score: true, symptoms: true, createdAt: true, cycleDay: true },
    });

    if (checkins.length === 0) continue;

    const nightMessages = await prisma.conversation.count({
      where: {
        patientId: patient.id,
        isNightMode: true,
        role: "patient",
        createdAt: { gte: weekAgo },
      },
    });

    const nextAppt = patient.appointments[0];
    const upcomingVisit = nextAppt
      ? nextAppt.scheduledAt.toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "short",
        })
      : null;

    let signal: PatientSignal;
    try {
      signal = await askClaudeJSON<PatientSignal>(
        WEEKLY_SIGNAL_PROMPT(
          patient.name,
          patient.cancerType,
          patient.currentCycle,
          checkins.map((c) => ({
            date: c.createdAt.toLocaleDateString("en-IN"),
            score: c.score,
            symptoms: c.symptoms,
            cycleDay: c.cycleDay,
          })),
          upcomingVisit
        ),
        "Analyze and generate signal.",
        200
      );
    } catch {
      continue;
    }

    if (!signal.isSignalWorthy) {
      signalLines.push(
        `✅ ${patient.name} (${patient.cancerType}, C${patient.currentCycle}) — Stable\n   Avg: ${signal.avgScore}/5${upcomingVisit ? ` | Visit: ${upcomingVisit}` : ""}`
      );
    } else {
      const trendSymbol = signal.trend === "declining" ? "▼" : signal.trend === "improving" ? "▲" : "→";
      signalLines.push(
        `${trendSymbol} ${patient.name} (${patient.cancerType}, C${patient.currentCycle}) — ${signal.trend === "declining" ? "⚠️ Declining" : "Needs attention"}\n   Avg: ${signal.avgScore}/5 | Top: ${signal.topSymptoms.slice(0, 2).join(", ")}${signal.nightDistressCount >= 3 ? ` | Night distress: ${signal.nightDistressCount}x` : ""}${upcomingVisit ? ` | Visit: ${upcomingVisit}` : ""}\n   💡 ${signal.doctorNote || "Review at next visit"}`
      );
    }
  }

  const signalPatients = signalLines.filter((l) => l.startsWith("▼") || l.startsWith("→"));

  // Only send message if there are flagged patients
  if (signalPatients.length === 0) return;

  const header = `Dr. ${doctorName} — Weekly Patient Signal`;
  const body = signalLines.join("\n\n");
  const footer = `\nReply with patient name to see full check-in log.`;

  await messagingRouter.sendText(whatsappNumber, `${header}\n\n${body}${footer}`, true);
}
