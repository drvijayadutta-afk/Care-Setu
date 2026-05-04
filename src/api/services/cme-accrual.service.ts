/**
 * Hook 7 Part A: CME Accrual Service
 *
 * Awards CME credit hours based on documented clinical activities.
 * Called from other routes/jobs:
 *   - MDT sign-off  → accrueCmeFor('mdt_participation', ...)
 *   - Voice note sign → accrueCmeFor('case_documentation', ...)
 *   - Care record export → accrueCmeFor('defense_mode_export', ...)
 *
 * Hour rules (configurable — matches NMC Competency-Based Medical Education
 * framework for continuing professional development activities):
 *   mdt_participation   → 1.0 hr per meeting signed off
 *   case_documentation  → 0.25 hr per voice note signed
 *   referral_accepted   → 0.5 hr per accepted referral reviewed
 *   defense_mode_export → 0.25 hr per care record generated
 *
 * CME credits are grouped by calendar year for NMC certificate generation.
 * NMC mandate: 30 hours per 5-year cycle (≈6 hours/year).
 */

import { prisma } from "../../db/client";

export type CmeEventType =
  | "mdt_participation"
  | "case_documentation"
  | "referral_accepted"
  | "defense_mode_export";

const CME_HOURS: Record<CmeEventType, number> = {
  mdt_participation: 1.0,
  case_documentation: 0.25,
  referral_accepted: 0.5,
  defense_mode_export: 0.25,
};

export interface CmeEvidence {
  meetingId?: string;
  noteId?: string;
  referralId?: string;
  recordId?: string;
  description?: string;
}

/**
 * Award CME credit to a doctor for a specific clinical event.
 * Fire-and-forget — errors are logged but not propagated.
 */
export function accrueCmeFor(
  eventType: CmeEventType,
  doctorId: string,
  evidence: CmeEvidence
): void {
  const hours = CME_HOURS[eventType] ?? 0.25;
  const year = new Date().getFullYear();

  prisma.cmeCredit
    .create({
      data: {
        doctorId,
        eventType,
        hours,
        evidence: evidence as any,
        year,
      },
    })
    .catch((err) => {
      console.error("[cme-accrual] Failed to create CME credit:", err?.message);
    });
}

/**
 * Get CME summary for a doctor for a specific year.
 */
export async function getCmeSummary(doctorId: string, year?: number) {
  const targetYear = year ?? new Date().getFullYear();

  const credits = await prisma.cmeCredit.findMany({
    where: { doctorId, year: targetYear },
    orderBy: { awardedAt: "asc" },
  });

  const totalHours = credits.reduce((s, c) => s + c.hours, 0);
  const byEventType: Record<string, { count: number; hours: number }> = {};

  for (const credit of credits) {
    if (!byEventType[credit.eventType]) {
      byEventType[credit.eventType] = { count: 0, hours: 0 };
    }
    byEventType[credit.eventType].count++;
    byEventType[credit.eventType].hours += credit.hours;
  }

  return {
    year: targetYear,
    totalHours: Math.round(totalHours * 100) / 100,
    creditCount: credits.length,
    byEventType,
    credits: credits.map((c) => ({
      id: c.id,
      eventType: c.eventType,
      hours: c.hours,
      evidence: c.evidence,
      awardedAt: c.awardedAt,
    })),
    // NMC benchmark: 6 hours per year (30h / 5 years)
    nmcAnnualTarget: 6,
    progressPct: Math.min(Math.round((totalHours / 6) * 100), 100),
  };
}

/**
 * Get CME history across multiple years.
 */
export async function getCmeHistory(doctorId: string, yearsBack = 5) {
  const currentYear = new Date().getFullYear();
  const fromYear = currentYear - yearsBack;

  const credits = await prisma.cmeCredit.findMany({
    where: { doctorId, year: { gte: fromYear } },
    orderBy: { year: "asc" },
  });

  const byYear: Record<number, number> = {};
  for (const credit of credits) {
    byYear[credit.year] = (byYear[credit.year] ?? 0) + credit.hours;
  }

  return Array.from({ length: yearsBack + 1 }, (_, i) => {
    const year = fromYear + i;
    return { year, hours: Math.round((byYear[year] ?? 0) * 100) / 100 };
  });
}
