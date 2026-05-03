/**
 * Care Record Export — Hook 3 "Defense Mode"
 *
 * Builds a complete, time-stamped, tamper-evident care record for a patient.
 * The record aggregates all clinical data from Care Setu and produces:
 *   1. A structured JSON payload (the source of truth)
 *   2. A SHA-256 hash of that JSON (tamper-evidence — printed on the last page)
 *   3. A print-ready HTML document that can be rendered as a PDF
 *   4. Storage of the JSON in Supabase (10-year retention)
 *
 * Tamper-evidence model:
 *   hash = SHA-256( JSON.stringify(payload, null, 0) )
 *   The hash is embedded in the HTML footer and stored in CareRecordGeneration.jsonHash.
 *   Any third party can verify integrity by re-computing the hash from the stored JSON.
 */

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../../db/client";

// Supabase client for care-record archive storage
const _supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    : null;
const CARE_RECORDS_BUCKET = "care-records";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CareRecordPayload {
  meta: {
    generatedAt: string;
    generatedByDoctorId: string;
    patientId: string;
    hospitalName: string;
    schemaVersion: "1.0";
  };
  patient: {
    name: string;
    dateOfBirth?: string;
    gender?: string;
    cancerType: string;
    stage?: string;
    histology?: string;
    diagnosisDate?: string;
    primarySite?: string;
    treatmentProtocol: string;
    currentCycle: number;
    ecogScore?: number;
    bloodGroup?: string;
    allergies: string[];
    comorbidities: string[];
    hospitalName: string;
    doctorName: string;
  };
  careTeam: Array<{
    name: string;
    role: string;
    isPrimary: boolean;
    hospitalName?: string;
    department?: string;
  }>;
  appointments: Array<{
    scheduledAt: string;
    type: string;
    status: string;
    doctorName?: string;
    notes?: string;
  }>;
  checkins: Array<{
    createdAt: string;
    score: number;
    symptoms: string[];
    emotionalState?: string;
    notes?: string;
    cycleDay: number;
    ecogScore?: number;
  }>;
  medications: Array<{
    name: string;
    genericName?: string;
    purpose: string;
    frequency: string;
    timing: string;
    isActive: boolean;
  }>;
  medicationLogs: Array<{
    medicationName: string;
    taken: boolean;
    takenAt?: string;
    createdAt: string;
  }>;
  labResults: Array<{
    testDate: string;
    category: string;
    testName: string;
    value?: number;
    unit?: string;
    flag?: string;
    refMin?: number;
    refMax?: number;
    cycleNumber?: number;
    orderedBy?: string;
  }>;
  imagingReports: Array<{
    studyDate: string;
    modality: string;
    bodyPart: string;
    indication?: string;
    findings?: string;
    impression?: string;
    response?: string;
    radiologist?: string;
  }>;
  pathologyReports: Array<{
    reportDate: string;
    specimenType: string;
    site: string;
    diagnosis: string;
    grade?: string;
    stage?: string;
    margins?: string;
    ihcFindings?: Record<string, unknown>;
    molecularTests?: Record<string, unknown>;
    pathologist?: string;
  }>;
  clinicalNotes: Array<{
    noteDate: string;
    noteType: string;
    title: string;
    content: string;
    authorName: string;
    authorRole: string;
    cycleNumber?: number;
  }>;
  alerts: Array<{
    type: string;
    severity: string;
    message: string;
    resolved: boolean;
    resolvedAt?: string;
    createdAt: string;
  }>;
  tumorBoardMeetings: Array<{
    scheduledAt: string;
    title: string;
    status: string;
    decision?: Record<string, unknown>;
    consensusReached: boolean;
    meetingNotes?: string;
    participants: Array<{ name: string; role: string }>;
  }>;
  outboundMessages: Array<{
    sentAt: string;
    messageType: string;
    channel: string;
    status: string;
  }>;
  conversations: Array<{
    createdAt: string;
    role: string;
    messageType: string;
    content: string;
  }>;
}

export interface CareRecordResult {
  payload: CareRecordPayload;
  hash: string;
  html: string;
  rowCount: Record<string, number>;
  recordId: string;
}

// ─── Main function ───────────────────────────────────────────────────────────

export async function buildCareRecord(
  patientId: string,
  requestedByDoctorId: string
): Promise<CareRecordResult> {
  // Fetch everything in parallel — no patient data is left out
  const [
    patient,
    careTeam,
    appointments,
    checkins,
    medications,
    labResults,
    imagingReports,
    pathologyReports,
    clinicalNotes,
    alerts,
    tumorBoardMeetings,
    outboundMessages,
    conversations,
  ] = await Promise.all([
    prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      include: { medications: { include: { adherenceLogs: { orderBy: { createdAt: "desc" } } } } },
    }),
    prisma.careTeamMember.findMany({
      where: { patientId, isActive: true },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    }),
    prisma.appointment.findMany({
      where: { patientId },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.checkin.findMany({
      where: { patientId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.medication.findMany({
      where: { patientId },
      include: { adherenceLogs: { orderBy: { createdAt: "desc" }, take: 100 } },
    }),
    prisma.labResult.findMany({
      where: { patientId, isDeleted: false },
      orderBy: { testDate: "asc" },
    }),
    prisma.imagingReport.findMany({
      where: { patientId },
      orderBy: { studyDate: "asc" },
    }),
    prisma.pathologyReport.findMany({
      where: { patientId },
      orderBy: { reportDate: "asc" },
    }),
    prisma.clinicalNote.findMany({
      where: { patientId },
      orderBy: { noteDate: "asc" },
    }),
    prisma.alert.findMany({
      where: { patientId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.tumorBoardMeeting.findMany({
      where: { patientId },
      include: { participants: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.outboundMessage.findMany({
      where: { patientId },
      orderBy: { sentAt: "asc" },
    }),
    prisma.conversation.findMany({
      where: { patientId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Collect all medication logs from the medications query
  const medicationLogs = medications.flatMap((m) =>
    m.adherenceLogs.map((log) => ({
      medicationName: m.name,
      taken: log.taken,
      takenAt: log.takenAt?.toISOString(),
      createdAt: log.createdAt.toISOString(),
    }))
  );

  const generatedAt = new Date().toISOString();

  const payload: CareRecordPayload = {
    meta: {
      generatedAt,
      generatedByDoctorId: requestedByDoctorId,
      patientId,
      hospitalName: patient.hospitalName,
      schemaVersion: "1.0",
    },
    patient: {
      name: patient.name,
      dateOfBirth: patient.dateOfBirth?.toISOString(),
      gender: patient.gender ?? undefined,
      cancerType: patient.cancerType,
      stage: patient.stage ?? undefined,
      histology: patient.histology ?? undefined,
      diagnosisDate: patient.diagnosisDate?.toISOString(),
      primarySite: patient.primarySite ?? undefined,
      treatmentProtocol: patient.treatmentProtocol,
      currentCycle: patient.currentCycle,
      ecogScore: patient.ecogScore ?? undefined,
      bloodGroup: patient.bloodGroup ?? undefined,
      allergies: patient.allergies,
      comorbidities: patient.comorbidities,
      hospitalName: patient.hospitalName,
      doctorName: patient.doctorName,
    },
    careTeam: careTeam.map((m) => ({
      name: m.name,
      role: m.role,
      isPrimary: m.isPrimary,
      hospitalName: m.hospitalName ?? undefined,
      department: m.department ?? undefined,
    })),
    appointments: appointments.map((a) => ({
      scheduledAt: a.scheduledAt.toISOString(),
      type: a.type,
      status: a.status,
      doctorName: a.doctorName ?? undefined,
      notes: a.notes ?? undefined,
    })),
    checkins: checkins.map((c) => ({
      createdAt: c.createdAt.toISOString(),
      score: c.score,
      symptoms: c.symptoms,
      emotionalState: c.emotionalState ?? undefined,
      notes: c.notes ?? undefined,
      cycleDay: c.cycleDay,
      ecogScore: c.ecogScore ?? undefined,
    })),
    medications: medications.map((m) => ({
      name: m.name,
      genericName: m.genericName ?? undefined,
      purpose: m.purpose,
      frequency: m.frequency,
      timing: m.timing,
      isActive: m.isActive,
    })),
    medicationLogs,
    labResults: labResults.map((l) => ({
      testDate: l.testDate.toISOString(),
      category: l.category,
      testName: l.testName,
      value: l.value ?? undefined,
      unit: l.unit ?? undefined,
      flag: l.flag ?? undefined,
      refMin: l.refMin ?? undefined,
      refMax: l.refMax ?? undefined,
      cycleNumber: l.cycleNumber ?? undefined,
      orderedBy: l.orderedBy ?? undefined,
    })),
    imagingReports: imagingReports.map((i) => ({
      studyDate: i.studyDate.toISOString(),
      modality: i.modality,
      bodyPart: i.bodyPart,
      indication: i.indication ?? undefined,
      findings: i.findings ?? undefined,
      impression: i.impression ?? undefined,
      response: i.response ?? undefined,
      radiologist: i.radiologist ?? undefined,
    })),
    pathologyReports: pathologyReports.map((p) => ({
      reportDate: p.reportDate.toISOString(),
      specimenType: p.specimenType,
      site: p.site,
      diagnosis: p.diagnosis,
      grade: p.grade ?? undefined,
      stage: p.stage ?? undefined,
      margins: p.margins ?? undefined,
      ihcFindings: (p.ihcFindings as Record<string, unknown>) ?? undefined,
      molecularTests: (p.molecularTests as Record<string, unknown>) ?? undefined,
      pathologist: p.pathologist ?? undefined,
    })),
    clinicalNotes: clinicalNotes.map((n) => ({
      noteDate: n.noteDate.toISOString(),
      noteType: n.noteType,
      title: n.title,
      content: n.content,
      authorName: n.authorName,
      authorRole: n.authorRole,
      cycleNumber: n.cycleNumber ?? undefined,
    })),
    alerts: alerts.map((a) => ({
      type: a.type,
      severity: a.severity,
      message: a.message,
      resolved: a.resolved,
      resolvedAt: a.resolvedAt?.toISOString(),
      createdAt: a.createdAt.toISOString(),
    })),
    tumorBoardMeetings: tumorBoardMeetings.map((m) => ({
      scheduledAt: m.scheduledAt.toISOString(),
      title: m.title,
      status: m.status,
      decision: (m.decision as Record<string, unknown>) ?? undefined,
      consensusReached: m.consensusReached,
      meetingNotes: m.meetingNotes ?? undefined,
      participants: m.participants.map((p) => ({ name: p.name, role: p.role })),
    })),
    outboundMessages: outboundMessages.map((m) => ({
      sentAt: m.sentAt.toISOString(),
      messageType: m.messageType,
      channel: m.channel,
      status: m.status,
    })),
    conversations: conversations.map((c) => ({
      createdAt: c.createdAt.toISOString(),
      role: c.role,
      messageType: c.messageType,
      content: c.content,
    })),
  };

  // SHA-256 hash of the canonical JSON (no whitespace) — tamper-evident anchor
  const canonicalJson = JSON.stringify(payload);
  const hash = crypto.createHash("sha256").update(canonicalJson).digest("hex");

  // Row counts for AuditLog transparency
  const rowCount = {
    appointments: appointments.length,
    checkins: checkins.length,
    labResults: labResults.length,
    imagingReports: imagingReports.length,
    pathologyReports: pathologyReports.length,
    clinicalNotes: clinicalNotes.length,
    alerts: alerts.length,
    tumorBoardMeetings: tumorBoardMeetings.length,
    outboundMessages: outboundMessages.length,
    conversations: conversations.length,
    medicationLogs: medicationLogs.length,
  };

  // Generate print-ready HTML
  const html = renderCareRecordHtml(payload, hash);

  // Store JSON in Supabase Storage (10-year retention)
  let storageKey: string | undefined;
  if (_supabase) {
    try {
      const key = `${patientId}/${hash.slice(0, 12)}.json`;
      const { error } = await _supabase.storage
        .from(CARE_RECORDS_BUCKET)
        .upload(key, Buffer.from(canonicalJson), {
          contentType: "application/json",
          upsert: false,
        });
      if (!error) {
        storageKey = key;
      } else {
        console.warn("[care-record-export] Storage upload warning:", error.message);
      }
    } catch (err) {
      console.warn("[care-record-export] Storage upload failed (non-fatal):", err);
    }
  } else {
    console.warn("[care-record-export] Supabase not configured — JSON not archived to storage");
  }

  // Persist audit record
  const record = await prisma.careRecordGeneration.create({
    data: {
      patientId,
      doctorId: requestedByDoctorId,
      jsonHash: hash,
      storageKey,
      rowCount,
    },
  });

  return { payload, hash, html, rowCount, recordId: record.id };
}

// ─── HTML renderer ───────────────────────────────────────────────────────────

function esc(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function section(title: string, content: string): string {
  return `
    <div class="section">
      <h2>${esc(title)}</h2>
      ${content}
    </div>`;
}

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return `<p class="empty">None recorded.</p>`;
  return `
    <table>
      <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;
}

export function renderCareRecordHtml(payload: CareRecordPayload, hash: string): string {
  const p = payload.patient;
  const generatedAt = formatDateTime(payload.meta.generatedAt);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width"/>
  <title>Care Record — ${esc(p.name)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; background: #fff; line-height: 1.5; }
    .cover { text-align: center; padding: 60px 40px; border-bottom: 3px solid #4338ca; }
    .cover h1 { font-size: 22pt; color: #4338ca; }
    .cover .subtitle { color: #555; margin-top: 8px; }
    .cover .patient-name { font-size: 18pt; font-weight: 700; margin: 20px 0 4px; }
    .cover .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; max-width: 500px; margin: 20px auto 0; text-align: left; font-size: 10pt; }
    .cover .meta-grid dt { color: #666; }
    .cover .meta-grid dd { font-weight: 600; }
    .section { padding: 20px 32px; border-bottom: 1px solid #e5e7eb; page-break-inside: avoid; }
    .section h2 { font-size: 13pt; color: #4338ca; margin-bottom: 12px; padding-bottom: 4px; border-bottom: 1px solid #c7d2fe; }
    table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 8px; }
    th { background: #f1f5f9; text-align: left; padding: 5px 8px; font-weight: 600; border: 1px solid #e2e8f0; }
    td { padding: 4px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .badge { display: inline-block; padding: 1px 6px; border-radius: 9px; font-size: 8.5pt; font-weight: 600; }
    .badge-critical { background: #fee2e2; color: #dc2626; }
    .badge-high, .badge-HIGH { background: #ffedd5; color: #c2410c; }
    .badge-low, .badge-LOW { background: #e0f2fe; color: #0369a1; }
    .badge-CRITICAL { background: #fee2e2; color: #dc2626; }
    .badge-resolved { background: #d1fae5; color: #065f46; }
    .badge-unresolved { background: #fee2e2; color: #991b1b; }
    .badge-cr { background: #d1fae5; color: #065f46; }
    .badge-pr { background: #d1fae5; color: #065f46; }
    .badge-sd { background: #fef3c7; color: #92400e; }
    .badge-pd { background: #fee2e2; color: #991b1b; }
    .empty { color: #6b7280; font-style: italic; font-size: 10pt; }
    .hash-footer { padding: 24px 32px; background: #f8fafc; page-break-before: always; }
    .hash-footer h2 { font-size: 12pt; color: #374151; margin-bottom: 8px; }
    .hash-footer .hash-value { font-family: 'Courier New', monospace; font-size: 9pt; word-break: break-all; background: #e2e8f0; padding: 8px 12px; border-radius: 4px; }
    .hash-footer .verify-note { font-size: 9pt; color: #6b7280; margin-top: 8px; }
    @media print {
      body { font-size: 10pt; }
      .section { page-break-inside: avoid; }
      .hash-footer { page-break-before: always; }
    }
  </style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <h1>🏥 Care Setu — Complete Care Record</h1>
  <div class="subtitle">Confidential Medical Record — For Authorised Clinical Use Only</div>
  <div class="patient-name">${esc(p.name)}</div>
  <div class="subtitle">${esc(p.cancerType)}${p.stage ? ` · ${esc(p.stage)}` : ""}</div>
  <dl class="meta-grid">
    <dt>Date of Birth</dt><dd>${formatDate(p.dateOfBirth)}</dd>
    <dt>Gender</dt><dd>${esc(p.gender) || "—"}</dd>
    <dt>Protocol</dt><dd>${esc(p.treatmentProtocol)}</dd>
    <dt>Current Cycle</dt><dd>${esc(p.currentCycle)}</dd>
    <dt>Hospital</dt><dd>${esc(p.hospitalName)}</dd>
    <dt>Primary Oncologist</dt><dd>${esc(p.doctorName)}</dd>
    <dt>Record Generated</dt><dd>${generatedAt}</dd>
    <dt>Total Sections</dt><dd>12</dd>
  </dl>
</div>

<!-- 1. PATIENT DEMOGRAPHICS -->
${section("1. Patient Demographics & Clinical Identity", `
  <dl class="meta-grid" style="max-width:100%; grid-template-columns:200px 1fr; gap:4px 24px;">
    <dt>Diagnosis Date</dt><dd>${formatDate(p.diagnosisDate)}</dd>
    <dt>Primary Site</dt><dd>${esc(p.primarySite) || "—"}</dd>
    <dt>Histology</dt><dd>${esc(p.histology) || "—"}</dd>
    <dt>ECOG Score</dt><dd>${p.ecogScore != null ? esc(p.ecogScore) : "—"}</dd>
    <dt>Blood Group</dt><dd>${esc(p.bloodGroup) || "—"}</dd>
    <dt>Allergies</dt><dd>${p.allergies.length ? esc(p.allergies.join(", ")) : "None reported"}</dd>
    <dt>Comorbidities</dt><dd>${p.comorbidities.length ? esc(p.comorbidities.join(", ")) : "None"}</dd>
  </dl>
`)}

<!-- 2. CARE TEAM -->
${section("2. Care Team", table(
  ["Name", "Role", "Hospital / Department", "Primary"],
  payload.careTeam.map((m) => [
    esc(m.name),
    esc(m.role),
    [m.hospitalName, m.department].filter(Boolean).map(esc).join(" / ") || "—",
    m.isPrimary ? "✓ Yes" : "",
  ])
))}

<!-- 3. APPOINTMENTS -->
${section("3. Appointments", table(
  ["Date & Time", "Type", "Status", "Doctor"],
  payload.appointments.map((a) => [
    formatDateTime(a.scheduledAt),
    esc(a.type),
    esc(a.status),
    esc(a.doctorName) || "—",
  ])
))}

<!-- 4. PATIENT-REPORTED CHECK-INS -->
${section("4. Patient-Reported Check-ins (Wellbeing)", table(
  ["Date", "Score /5", "Cycle Day", "Symptoms", "Notes"],
  payload.checkins.map((c) => [
    formatDateTime(c.createdAt),
    esc(c.score),
    esc(c.cycleDay),
    c.symptoms.length ? esc(c.symptoms.join(", ")) : "None",
    esc(c.notes) || "—",
  ])
))}

<!-- 5. MEDICATIONS -->
${section("5. Medications", table(
  ["Drug", "Generic", "Purpose", "Frequency", "Timing", "Active"],
  payload.medications.map((m) => [
    esc(m.name),
    esc(m.genericName) || "—",
    esc(m.purpose),
    esc(m.frequency),
    esc(m.timing),
    m.isActive ? "Yes" : "Stopped",
  ])
))}

<!-- 6. LABORATORY RESULTS -->
${section("6. Laboratory Results", table(
  ["Date", "Category", "Test", "Value", "Unit", "Flag", "Cycle"],
  payload.labResults.map((l) => [
    formatDate(l.testDate),
    esc(l.category),
    esc(l.testName),
    l.value != null ? esc(l.value) : "—",
    esc(l.unit) || "—",
    l.flag ? `<span class="badge badge-${esc(l.flag)}">${esc(l.flag)}</span>` : "Normal",
    l.cycleNumber != null ? esc(l.cycleNumber) : "—",
  ])
))}

<!-- 7. IMAGING REPORTS -->
${section("7. Imaging Reports", table(
  ["Date", "Modality", "Body Part", "Response", "Impression"],
  payload.imagingReports.map((i) => [
    formatDate(i.studyDate),
    esc(i.modality),
    esc(i.bodyPart),
    i.response ? `<span class="badge badge-${i.response.toLowerCase()}">${esc(i.response)}</span>` : "—",
    esc(i.impression) || "—",
  ])
))}

<!-- 8. PATHOLOGY REPORTS -->
${section("8. Pathology Reports", table(
  ["Date", "Specimen", "Site", "Diagnosis", "Grade", "Margins"],
  payload.pathologyReports.map((p) => [
    formatDate(p.reportDate),
    esc(p.specimenType),
    esc(p.site),
    esc(p.diagnosis),
    esc(p.grade) || "—",
    esc(p.margins) || "—",
  ])
))}

<!-- 9. CLINICAL NOTES -->
${section("9. Clinical Notes", table(
  ["Date", "Type", "Title", "Author", "Role"],
  payload.clinicalNotes.map((n) => [
    formatDate(n.noteDate),
    esc(n.noteType),
    esc(n.title),
    esc(n.authorName),
    esc(n.authorRole),
  ])
))}

<!-- 10. ALERTS -->
${section("10. Alerts", table(
  ["Date", "Type", "Severity", "Message", "Status"],
  payload.alerts.map((a) => [
    formatDate(a.createdAt),
    esc(a.type),
    `<span class="badge badge-${esc(a.severity)}">${esc(a.severity.toUpperCase())}</span>`,
    esc(a.message),
    a.resolved
      ? `<span class="badge badge-resolved">Resolved ${formatDate(a.resolvedAt)}</span>`
      : `<span class="badge badge-unresolved">Active</span>`,
  ])
))}

<!-- 11. TUMOR BOARD MEETINGS -->
${section("11. Multidisciplinary Team (MDT) Meetings", payload.tumorBoardMeetings.length === 0
  ? `<p class="empty">None recorded.</p>`
  : payload.tumorBoardMeetings.map((m) => `
    <div style="margin-bottom:16px; padding:10px; border:1px solid #e2e8f0; border-radius:6px;">
      <strong>${esc(m.title)}</strong> — ${formatDateTime(m.scheduledAt)}
      &nbsp;<span style="color:#6b7280; font-size:9.5pt;">${esc(m.status)}</span>
      ${m.consensusReached ? ' &nbsp;<span class="badge badge-resolved">Consensus reached</span>' : ""}
      ${m.participants.length ? `<div style="margin-top:6px; font-size:9.5pt; color:#555;">
        Participants: ${m.participants.map((p) => `${esc(p.name)} (${esc(p.role)})`).join(", ")}
      </div>` : ""}
      ${m.meetingNotes ? `<div style="margin-top:6px; font-size:9.5pt;">${esc(m.meetingNotes)}</div>` : ""}
    </div>`
  ).join("")
)}

<!-- 12. OUTBOUND COMMUNICATIONS -->
${section("12. Outbound Communications (Proof of Patient Notification)", table(
  ["Sent At", "Type", "Channel", "Status"],
  payload.outboundMessages.map((m) => [
    formatDateTime(m.sentAt),
    esc(m.messageType),
    esc(m.channel),
    esc(m.status),
  ])
))}

<!-- HASH FOOTER -->
<div class="hash-footer">
  <h2>🔒 Tamper-Evidence Certificate</h2>
  <p style="margin-bottom:8px; font-size:10pt;">
    This record was generated at <strong>${generatedAt}</strong>.
    The SHA-256 hash below was computed from the canonical JSON payload at generation time.
    Any modification to this record will produce a different hash.
  </p>
  <div class="hash-value">SHA-256: ${esc(hash)}</div>
  <p class="verify-note">
    To verify: obtain the archived JSON from Care Setu, compute
    <code>sha256(JSON.stringify(payload))</code> and compare with the hash above.
    Hospital IT can provide the verification procedure.
  </p>
</div>

</body>
</html>`;
}
