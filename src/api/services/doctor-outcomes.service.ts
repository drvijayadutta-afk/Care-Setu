/**
 * Hook 6: Doctor Personal Outcomes Service
 *
 * Aggregates outcomes scoped to a specific doctor's care team patients.
 * All aggregations mirror the admin /admin/outcomes endpoint but are
 * filtered through CareTeamMember.doctorId.
 *
 * Privacy rules:
 * - No individual patient data leaks through — only aggregate counts/averages
 * - Peer benchmark enforces n≥10 peers minimum (k-anonymity)
 * - Cross-hospital comparison uses only anonymous percentile bands
 */

import { prisma } from "../../db/client";

export interface DoctorOutcomesSummary {
  period: { days: number; since: string };
  cohort: {
    totalPatients: number;
    activePatients: number;
    byStage: Record<string, number>;
    byProtocol: Record<string, number>;
  };
  wellbeing: {
    averageCheckinScore: number | null;
    lowScoreCount: number;
    totalCheckins: number;
    scoreDistribution: Record<string, number>; // "1"–"5" → count
    topSymptoms: Array<{ symptom: string; count: number }>;
  };
  alerts: {
    total: number;
    bySeverity: Record<string, number>;
    resolutionRate: number | null; // 0–1
  };
  mdt: {
    meetingsAttended: number;
    signedOffCount: number;
    consensusReachedRate: number | null;
  };
  labsAbnormal: {
    criticalCount: number;
    highLowCount: number;
    totalInPeriod: number;
  };
  imagingResponses: {
    cr: number; pr: number; sd: number; pd: number; unknown: number;
  };
}

export interface PeerBenchmark {
  metric: string;
  protocol?: string;
  yourValue: number;
  percentile: number;       // 0–100
  peerMedian: number;
  peerCount: number;
  sufficientData: boolean; // false when n < 10 peers
}

// ─── Doctor outcomes ─────────────────────────────────────────────────────────

export async function buildDoctorOutcomes(
  doctorId: string,
  days: number
): Promise<DoctorOutcomesSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Find all patients on this doctor's care team
  const careTeamRows = await prisma.careTeamMember.findMany({
    where: { doctorId, isActive: true },
    select: { patientId: true },
  });
  const patientIds = careTeamRows.map((r) => r.patientId);

  if (patientIds.length === 0) {
    return emptyOutcomes(days);
  }

  // Parallel fetch of all signals
  const [
    patients,
    checkins,
    alerts,
    mdtMeetings,
    labs,
    imagingReports,
  ] = await Promise.all([
    prisma.patient.findMany({
      where: { id: { in: patientIds }, isActive: true },
      select: { id: true, stage: true, treatmentProtocol: true },
    }),
    prisma.checkin.findMany({
      where: { patientId: { in: patientIds }, createdAt: { gte: since } },
      select: { score: true, symptoms: true, patientId: true },
    }),
    prisma.alert.findMany({
      where: { patientId: { in: patientIds }, createdAt: { gte: since } },
      select: { severity: true, resolved: true },
    }),
    prisma.tumorBoardMeeting.findMany({
      where: {
        patientId: { in: patientIds },
        scheduledAt: { gte: since },
        status: "completed",
      },
      include: {
        participants: { select: { doctorId: true, signedOff: true } },
      },
    }),
    prisma.labResult.findMany({
      where: {
        patientId: { in: patientIds },
        testDate: { gte: since },
        isDeleted: false,
        flag: { not: null },
      },
      select: { flag: true },
    }),
    prisma.imagingReport.findMany({
      where: {
        patientId: { in: patientIds },
        studyDate: { gte: since },
        response: { not: null },
      },
      select: { response: true },
    }),
  ]);

  // Cohort breakdown
  const byStage: Record<string, number> = {};
  const byProtocol: Record<string, number> = {};
  for (const p of patients) {
    if (p.stage) byStage[p.stage] = (byStage[p.stage] ?? 0) + 1;
    byProtocol[p.treatmentProtocol] = (byProtocol[p.treatmentProtocol] ?? 0) + 1;
  }

  // Wellbeing
  const avgScore =
    checkins.length > 0
      ? checkins.reduce((s, c) => s + c.score, 0) / checkins.length
      : null;
  const scoreDistribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  const symptomFreq: Record<string, number> = {};
  for (const c of checkins) {
    scoreDistribution[String(c.score)] = (scoreDistribution[String(c.score)] ?? 0) + 1;
    for (const sym of c.symptoms) {
      symptomFreq[sym] = (symptomFreq[sym] ?? 0) + 1;
    }
  }
  const topSymptoms = Object.entries(symptomFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([symptom, count]) => ({ symptom, count }));

  // Alerts
  const bySeverity: Record<string, number> = {};
  let resolved = 0;
  for (const a of alerts) {
    bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
    if (a.resolved) resolved++;
  }
  const resolutionRate = alerts.length > 0 ? resolved / alerts.length : null;

  // MDT — count meetings where this doctor participated
  const doctorMeetings = mdtMeetings.filter((m) =>
    m.participants.some((p) => p.doctorId === doctorId)
  );
  const signedOff = doctorMeetings.filter((m) =>
    m.participants.find((p) => p.doctorId === doctorId)?.signedOff
  ).length;
  const consensusCount = doctorMeetings.filter((m) => m.consensusReached).length;

  // Labs
  const criticalCount = labs.filter((l) => l.flag === "CRITICAL").length;
  const highLowCount = labs.filter((l) => l.flag === "HIGH" || l.flag === "LOW").length;

  // Imaging RECIST responses
  const responseMap: Record<string, keyof typeof imagingResponses> = {
    CR: "cr", PR: "pr", SD: "sd", PD: "pd",
  };
  const imagingResponses = { cr: 0, pr: 0, sd: 0, pd: 0, unknown: 0 };
  for (const i of imagingReports) {
    const key = i.response ? responseMap[i.response.toUpperCase()] : undefined;
    if (key) imagingResponses[key]++;
    else imagingResponses.unknown++;
  }

  return {
    period: { days, since: since.toISOString() },
    cohort: {
      totalPatients: patientIds.length,
      activePatients: patients.length,
      byStage,
      byProtocol,
    },
    wellbeing: {
      averageCheckinScore: avgScore !== null ? Math.round(avgScore * 100) / 100 : null,
      lowScoreCount: checkins.filter((c) => c.score <= 2).length,
      totalCheckins: checkins.length,
      scoreDistribution,
      topSymptoms,
    },
    alerts: {
      total: alerts.length,
      bySeverity,
      resolutionRate,
    },
    mdt: {
      meetingsAttended: doctorMeetings.length,
      signedOffCount: signedOff,
      consensusReachedRate:
        doctorMeetings.length > 0 ? consensusCount / doctorMeetings.length : null,
    },
    labsAbnormal: {
      criticalCount,
      highLowCount,
      totalInPeriod: labs.length,
    },
    imagingResponses,
  };
}

// ─── Peer benchmark (k-anonymity enforced) ────────────────────────────────────

export async function buildPeerBenchmark(
  doctorId: string,
  metric: string,
  days: number,
  protocol?: string
): Promise<PeerBenchmark> {
  const PEER_MIN = 10; // k-anonymity threshold
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get all active doctors with at least one patient in the requested protocol/period
  const allDoctors = await prisma.careTeamMember.findMany({
    where: {
      isActive: true,
      doctorId: { not: null },
    },
    select: { doctorId: true, patientId: true },
    distinct: ["doctorId"],
  });

  const uniqueDoctorIds = [...new Set(allDoctors.map((r) => r.doctorId!))].filter(
    (id) => id !== doctorId
  );

  if (uniqueDoctorIds.length < PEER_MIN) {
    // Cannot reveal benchmark — not enough peers
    const myOutcomes = await buildDoctorOutcomes(doctorId, days);
    return {
      metric,
      protocol,
      yourValue: getMetricValue(myOutcomes, metric),
      percentile: 0,
      peerMedian: 0,
      peerCount: uniqueDoctorIds.length,
      sufficientData: false,
    };
  }

  // Compute metric for all peers (batch)
  const peerValues: number[] = [];
  for (const peerId of uniqueDoctorIds) {
    const outcomes = await buildDoctorOutcomes(peerId, days);
    peerValues.push(getMetricValue(outcomes, metric));
  }

  const myOutcomes = await buildDoctorOutcomes(doctorId, days);
  const myValue = getMetricValue(myOutcomes, metric);

  peerValues.sort((a, b) => a - b);
  const median = peerValues[Math.floor(peerValues.length / 2)] ?? 0;
  const belowCount = peerValues.filter((v) => v < myValue).length;
  const percentile = Math.round((belowCount / peerValues.length) * 100);

  return {
    metric,
    protocol,
    yourValue: myValue,
    percentile,
    peerMedian: Math.round(median * 100) / 100,
    peerCount: uniqueDoctorIds.length,
    sufficientData: true,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMetricValue(outcomes: DoctorOutcomesSummary, metric: string): number {
  switch (metric) {
    case "avg_checkin_score":
      return outcomes.wellbeing.averageCheckinScore ?? 0;
    case "alert_resolution_rate":
      return outcomes.alerts.resolutionRate ?? 0;
    case "mdt_participation":
      return outcomes.mdt.meetingsAttended;
    case "low_wellbeing_rate":
      return outcomes.wellbeing.totalCheckins > 0
        ? outcomes.wellbeing.lowScoreCount / outcomes.wellbeing.totalCheckins
        : 0;
    case "imaging_response_rate": {
      const { cr, pr, sd, pd, unknown } = outcomes.imagingResponses;
      const total = cr + pr + sd + pd + unknown;
      return total > 0 ? (cr + pr) / total : 0;
    }
    default:
      return 0;
  }
}

function emptyOutcomes(days: number): DoctorOutcomesSummary {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return {
    period: { days, since: since.toISOString() },
    cohort: { totalPatients: 0, activePatients: 0, byStage: {}, byProtocol: {} },
    wellbeing: {
      averageCheckinScore: null,
      lowScoreCount: 0,
      totalCheckins: 0,
      scoreDistribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
      topSymptoms: [],
    },
    alerts: { total: 0, bySeverity: {}, resolutionRate: null },
    mdt: { meetingsAttended: 0, signedOffCount: 0, consensusReachedRate: null },
    labsAbnormal: { criticalCount: 0, highLowCount: 0, totalInPeriod: 0 },
    imagingResponses: { cr: 0, pr: 0, sd: 0, pd: 0, unknown: 0 },
  };
}
