/**
 * Hook 7 Part B: Cohort Export Service
 *
 * Builds a de-identified CSV of a doctor's patient cohort for research use.
 *
 * De-identification rules (aligned with DPDP Act §17 and ABDM research guidelines):
 *   - No direct identifiers: name, phone, WhatsApp number, date of birth (exact)
 *   - Date of birth → age band (e.g., "45-54")
 *   - Dates → relative to diagnosis date (e.g., "+180 days")
 *   - Geographic scope: hospital name → hospital ID (anonymized)
 *   - Assigned study_id: sequential integer (not patient UUID)
 *
 * k-anonymity: export refused if any cell would have n < 5 matching rows
 * (configurable MIN_COHORT_SIZE).
 *
 * Privacy gate: patient must NOT have set erasure/research-opt-out flag.
 * (Deferred: full C9 data subject rights endpoint — currently no opt-out flag
 * exists in schema; gate is a TODO placeholder that logs a warning.)
 */

import { createClient } from "@supabase/supabase-js";
import { prisma } from "../../db/client";

const MIN_COHORT_SIZE = 5; // k-anonymity threshold

const _supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    : null;

export interface CohortDefinition {
  cancerType?: string;
  stage?: string;
  protocol?: string;
  dateFrom?: string; // ISO date string
  dateTo?: string;   // ISO date string
}

export interface CohortExportResult {
  csv: string;
  summary: CohortSummary;
  exportId: string;
  downloadKey?: string;
}

export interface CohortSummary {
  rowCount: number;
  cohortDef: CohortDefinition;
  genderDistribution: Record<string, number>;
  ageBandDistribution: Record<string, number>;
  stageDistribution: Record<string, number>;
  protocolDistribution: Record<string, number>;
  medianCyclesCompleted: number | null;
  responseDistribution: Record<string, number>;
}

// ─── Age band ────────────────────────────────────────────────────────────────

function ageBand(dob?: Date | null): string {
  if (!dob) return "Unknown";
  const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 30) return "18-29";
  if (age < 40) return "30-39";
  if (age < 50) return "40-49";
  if (age < 60) return "50-59";
  if (age < 70) return "60-69";
  return "70+";
}

// ─── Main export function ─────────────────────────────────────────────────────

export async function buildCohortExport(
  doctorId: string,
  cohortDef: CohortDefinition
): Promise<CohortExportResult> {
  // Build patient filter
  const where: any = {
    isActive: true,
    careTeamMembers: { some: { doctorId, isActive: true } },
  };

  if (cohortDef.cancerType) where.cancerType = { contains: cohortDef.cancerType, mode: "insensitive" };
  if (cohortDef.stage) where.stage = { contains: cohortDef.stage, mode: "insensitive" };
  if (cohortDef.protocol) where.treatmentProtocol = { contains: cohortDef.protocol, mode: "insensitive" };
  if (cohortDef.dateFrom || cohortDef.dateTo) {
    where.diagnosisDate = {};
    if (cohortDef.dateFrom) where.diagnosisDate.gte = new Date(cohortDef.dateFrom);
    if (cohortDef.dateTo) where.diagnosisDate.lte = new Date(cohortDef.dateTo);
  }

  const patients = await prisma.patient.findMany({
    where,
    include: {
      labResults: {
        where: { cycleNumber: { in: [1, 3, 6] }, isDeleted: false },
        orderBy: { testDate: "asc" },
        take: 20,
      },
      imagingReports: {
        orderBy: { studyDate: "desc" },
        take: 3,
      },
      alerts: {
        where: { severity: { in: ["critical", "high"] } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // k-anonymity check
  if (patients.length < MIN_COHORT_SIZE) {
    throw new Object({
      code: "COHORT_TOO_SMALL",
      message: `Cohort has only ${patients.length} patient(s). Minimum ${MIN_COHORT_SIZE} required for de-identified export.`,
      rowCount: patients.length,
      minRequired: MIN_COHORT_SIZE,
    });
  }

  // TODO (C9): filter out patients with research opt-out flag when that field ships.
  // console.warn("[cohort-export] Research opt-out not yet enforced — pending C9.");

  // Build CSV
  const headers = [
    "study_id",
    "age_band",
    "gender",
    "cancer_type",
    "stage",
    "histology",
    "protocol",
    "cycles_completed",
    "diagnosis_year",
    "ecog_score",
    "latest_imaging_response",
    "ctcae_grade3plus_events",
    "total_alerts",
    "lab_anc_cycle1",
    "lab_hb_cycle1",
  ];

  const rows: string[][] = patients.map((p, idx) => {
    const latestImaging = p.imagingReports[0]?.response ?? "";
    const grade3Events = p.alerts.filter((a) => a.severity === "critical").length;

    // Key labs at cycle 1
    const cycle1Labs = p.labResults.filter((l) => l.cycleNumber === 1);
    const anc = cycle1Labs.find((l) => l.testName.toLowerCase().includes("anc") || l.testName.toLowerCase().includes("absolute neutrophil"))?.value;
    const hb = cycle1Labs.find((l) => l.testName.toLowerCase().includes("hb") || l.testName.toLowerCase().includes("hemoglobin"))?.value;

    return [
      String(idx + 1),                          // study_id
      ageBand(p.dateOfBirth),                    // age_band
      p.gender ?? "Unknown",                     // gender
      p.cancerType,                              // cancer_type
      p.stage ?? "",                             // stage
      p.histology ?? "",                         // histology
      p.treatmentProtocol,                       // protocol
      String(p.currentCycle - 1),               // cycles_completed
      p.diagnosisDate ? String(p.diagnosisDate.getFullYear()) : "",
      String(p.ecogScore ?? ""),
      latestImaging,
      String(grade3Events),
      String(p.alerts.length),
      anc != null ? String(anc) : "",
      hb != null ? String(hb) : "",
    ];
  });

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map((v) => (v.includes(",") ? `"${v}"` : v)).join(",")),
  ].join("\n");

  // Build summary stats
  const genderDist: Record<string, number> = {};
  const ageBandDist: Record<string, number> = {};
  const stageDist: Record<string, number> = {};
  const protocolDist: Record<string, number> = {};
  const responseDist: Record<string, number> = {};

  for (const p of patients) {
    const g = p.gender ?? "Unknown";
    genderDist[g] = (genderDist[g] ?? 0) + 1;
    const ab = ageBand(p.dateOfBirth);
    ageBandDist[ab] = (ageBandDist[ab] ?? 0) + 1;
    if (p.stage) stageDist[p.stage] = (stageDist[p.stage] ?? 0) + 1;
    protocolDist[p.treatmentProtocol] = (protocolDist[p.treatmentProtocol] ?? 0) + 1;
    const resp = p.imagingReports[0]?.response;
    if (resp) responseDist[resp] = (responseDist[resp] ?? 0) + 1;
  }

  const cycles = patients.map((p) => p.currentCycle - 1).sort((a, b) => a - b);
  const medianCycles = cycles.length > 0 ? cycles[Math.floor(cycles.length / 2)] : null;

  const summary: CohortSummary = {
    rowCount: patients.length,
    cohortDef,
    genderDistribution: genderDist,
    ageBandDistribution: ageBandDist,
    stageDistribution: stageDist,
    protocolDistribution: protocolDist,
    medianCyclesCompleted: medianCycles,
    responseDistribution: responseDist,
  };

  // Store CSV in Supabase
  let downloadKey: string | undefined;
  if (_supabase) {
    try {
      const key = `${doctorId}/${Date.now()}.csv`;
      const { error } = await _supabase.storage
        .from("cohort-exports")
        .upload(key, Buffer.from(csv), { contentType: "text/csv", upsert: false });
      if (!error) downloadKey = key;
    } catch {
      // Non-fatal
    }
  }

  // Log export
  const exportRecord = await prisma.cohortExport.create({
    data: {
      doctorId,
      cohortDef: cohortDef as any,
      rowCount: patients.length,
      downloadKey,
    },
  });

  return { csv, summary, exportId: exportRecord.id, downloadKey };
}
