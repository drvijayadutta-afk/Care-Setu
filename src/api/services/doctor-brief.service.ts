import { prisma } from "../../db/client";
import { detectChangeSinceLastVisit, type Urgency } from "./change-detector.service";

export interface DoctorBriefCard {
  appointmentId: string;
  patientId: string;
  patientInitials: string; // privacy-minimized — full name only on tap
  age?: number;
  cancerType?: string;
  stage?: string;
  protocol?: string;
  cycle?: number;
  scheduledAt: string; // ISO
  appointmentType: string;
  urgency: Urgency;
  changeSummary: string;
}

export interface DoctorBrief {
  date: string; // YYYY-MM-DD
  doctorId: string;
  totals: { critical: number; notable: number; stable: number; total: number };
  cards: DoctorBriefCard[];
}

function initialsOf(name?: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function ageFromDob(dob?: Date | null): number | undefined {
  if (!dob) return undefined;
  const ms = Date.now() - dob.getTime();
  return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
}

/**
 * Build the doctor's pre-clinic brief for a given calendar day (in UTC).
 *
 * Strategy:
 *  1. Find all Appointments(doctorId, day) with status in {scheduled, pending}
 *  2. For each, compute change-since-last-visit
 *  3. Return cards sorted by urgency (critical first), then time
 */
export async function buildDoctorTodayBrief(
  doctorId: string,
  date: Date
): Promise<DoctorBrief> {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      scheduledAt: { gte: dayStart, lt: dayEnd },
      status: { in: ["scheduled", "pending"] },
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          dateOfBirth: true,
          cancerType: true,
          stage: true,
          treatmentProtocol: true,
          currentCycle: true,
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const cards: DoctorBriefCard[] = await Promise.all(
    appointments.map(async (appt) => {
      const change = await detectChangeSinceLastVisit(appt.patientId, appt.scheduledAt);
      return {
        appointmentId: appt.id,
        patientId: appt.patientId,
        patientInitials: initialsOf(appt.patient.name),
        age: ageFromDob(appt.patient.dateOfBirth ?? undefined),
        cancerType: appt.patient.cancerType ?? undefined,
        stage: appt.patient.stage ?? undefined,
        protocol: appt.patient.treatmentProtocol ?? undefined,
        cycle: appt.patient.currentCycle ?? undefined,
        scheduledAt: appt.scheduledAt.toISOString(),
        appointmentType: appt.type,
        urgency: change.urgency,
        changeSummary: change.summary,
      };
    })
  );

  // Sort: critical → notable → stable, then chronological
  const order: Record<Urgency, number> = { critical: 0, notable: 1, stable: 2 };
  cards.sort((a, b) =>
    order[a.urgency] - order[b.urgency] ||
    a.scheduledAt.localeCompare(b.scheduledAt)
  );

  const totals = cards.reduce(
    (acc, c) => {
      acc[c.urgency]++;
      acc.total++;
      return acc;
    },
    { critical: 0, notable: 0, stable: 0, total: 0 }
  );

  return {
    date: dayStart.toISOString().slice(0, 10),
    doctorId,
    totals,
    cards,
  };
}
