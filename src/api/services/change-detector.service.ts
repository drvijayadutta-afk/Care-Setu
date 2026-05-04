import { prisma } from "../../db/client";

export type Urgency = "critical" | "notable" | "stable";

export interface PatientChange {
  urgency: Urgency;
  summary: string; // single-line "what changed" — shown on the doctor's card
}

/**
 * For one patient, compute "what changed since the last visit".
 *
 * Window: from the patient's last completed appointment (or 14 days ago if none)
 * up to now.
 *
 * Urgency rules (first match wins):
 *   critical  → any active alert with severity in {critical, high}, OR
 *                any lab in window with flag CRITICAL
 *   notable   → any lab in window with flag HIGH/LOW, OR
 *                ≥2 check-ins in window with score ≤ 2, OR
 *                ≥3 missed medication doses in window
 *   stable    → none of the above
 */
export async function detectChangeSinceLastVisit(
  patientId: string,
  appointmentDate: Date
): Promise<PatientChange> {
  // Find the last completed appointment before this one — fall back to 14 days
  const lastVisit = await prisma.appointment.findFirst({
    where: {
      patientId,
      status: "completed",
      scheduledAt: { lt: appointmentDate },
    },
    orderBy: { scheduledAt: "desc" },
    select: { scheduledAt: true },
  });
  const since = lastVisit?.scheduledAt ?? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Query all the relevant signals in parallel
  const [activeAlerts, labsInWindow, recentCheckins, missedDoses] = await Promise.all([
    prisma.alert.findMany({
      where: { patientId, resolved: false },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.labResult.findMany({
      where: {
        patientId,
        testDate: { gte: since },
        OR: [{ flag: "CRITICAL" }, { flag: "HIGH" }, { flag: "LOW" }],
      },
      orderBy: { testDate: "desc" },
      take: 5,
    }),
    prisma.checkin.findMany({
      where: { patientId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 7,
    }),
    prisma.medicationLog.count({
      where: {
        medication: { patientId },
        createdAt: { gte: since },
        taken: false,
      },
    }),
  ]);

  // Critical
  const criticalAlert = activeAlerts.find(
    (a) => a.severity === "critical" || a.severity === "high"
  );
  if (criticalAlert) {
    return {
      urgency: "critical",
      summary: `Active ${criticalAlert.severity.toUpperCase()} alert: ${criticalAlert.message.slice(0, 80)}`,
    };
  }
  const criticalLab = labsInWindow.find((l) => l.flag === "CRITICAL");
  if (criticalLab) {
    return {
      urgency: "critical",
      summary: `${criticalLab.testName} CRITICAL: ${criticalLab.value ?? "—"}${criticalLab.unit ?? ""}`,
    };
  }

  // Notable
  const abnormalLab = labsInWindow.find((l) => l.flag === "HIGH" || l.flag === "LOW");
  const lowCheckins = recentCheckins.filter((c) => c.score <= 2);
  if (abnormalLab) {
    return {
      urgency: "notable",
      summary: `${abnormalLab.testName} ${abnormalLab.flag}: ${abnormalLab.value ?? "—"}${abnormalLab.unit ?? ""}`,
    };
  }
  if (lowCheckins.length >= 2) {
    return {
      urgency: "notable",
      summary: `${lowCheckins.length} low wellbeing check-ins (score ≤2)`,
    };
  }
  if (missedDoses >= 3) {
    return {
      urgency: "notable",
      summary: `${missedDoses} missed medication doses since last visit`,
    };
  }

  // Stable
  const lastCheckin = recentCheckins[0];
  if (lastCheckin) {
    return {
      urgency: "stable",
      summary: `Wellbeing trend stable (last check-in ${lastCheckin.score}/5)`,
    };
  }
  return { urgency: "stable", summary: "No new alerts since last visit" };
}
