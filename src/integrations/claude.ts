import Anthropic from "@anthropic-ai/sdk";
import { downloadFileBytes } from "./supabase-storage";

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("⚠️ ANTHROPIC_API_KEY not set — MDT summaries and AI extractions will fail");
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 30_000, // 30s hard cap so requests never hang indefinitely
});

const MODEL = "claude-sonnet-4-6";

export async function askClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 512
): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Claude");
  return block.text;
}

export async function askClaudeWithHistory(
  systemPrompt: string,
  history: { role: "user" | "assistant"; content: string }[],
  maxTokens = 512
): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: history,
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Claude");
  return block.text;
}

export async function askClaudeJSON<T>(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 256
): Promise<T> {
  const raw = await askClaude(systemPrompt, userMessage, maxTokens);
  // Strip markdown code fences if Claude adds them
  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  return JSON.parse(cleaned) as T;
}

// ─── Document AI Extraction ──────────────────────────────────────────────────

const EXTRACT_PROMPTS: Record<string, string> = {
  LAB_REPORT: `You are a medical data extractor. Read the lab report and return a JSON array of test results.
Each element: { testName, category (CBC|LFT|KFT|TUMOUR_MARKER|COAGULATION|URINE|OTHER), value, unit, refMin, refMax, flag (HIGH|LOW|CRITICAL|NORMAL|null), isAbnormal (boolean), testDate (ISO date or null), rawText }.
Return ONLY valid JSON array, no markdown.`,

  IMAGING: `You are a radiology report extractor. Read the imaging report and return a single JSON object:
{ modality (CT|MRI|PET-CT|X-RAY|ULTRASOUND|BONE-SCAN|MAMMOGRAPHY), bodyPart, studyDate (ISO date or null), indication, findings, impression, response (CR|PR|SD|PD|null), radiologist }.
Return ONLY valid JSON, no markdown.`,

  PATHOLOGY: `You are a pathology report extractor. Read the report and return a single JSON object:
{ specimenType (BIOPSY|SURGICAL|CYTOLOGY|BONE_MARROW|BLOOD), site, reportDate (ISO date or null), diagnosis, grade, stage, margins (clear|involved|close|null),
ihcFindings (object with marker:result pairs, e.g. {"ER":"positive 80%","HER2":"negative"}),
molecularTests (object with gene:result pairs, e.g. {"BRCA1":"wildtype"}), pathologist, labName }.
Return ONLY valid JSON, no markdown.`,
};

export async function extractDocumentData(
  storagePath: string,
  category: string,
  fileType: string
): Promise<unknown> {
  const systemPrompt = EXTRACT_PROMPTS[category] ?? EXTRACT_PROMPTS["LAB_REPORT"];
  const fileBytes = await downloadFileBytes(storagePath);
  const base64 = fileBytes.toString("base64");

  // PDF and image both work as base64 source blocks
  const mediaType = fileType === "pdf" ? "application/pdf" : `image/${fileType}`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document" as any,
            source: { type: "base64", media_type: mediaType, data: base64 },
          } as any,
          { type: "text", text: "Extract structured data from this medical report." },
        ],
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected response from Claude");
  const cleaned = block.text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  return JSON.parse(cleaned);
}

// ─── MDT Summary Generator (template-based, no external API) ─────────────────

export async function generateMdtSummary(patient: any): Promise<string> {
  const fmt = (d: any) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "unknown";
  const na = (v: any) => v ?? "N/A";

  // ── Data extraction ──────────────────────────────────────────────────────
  const latestVitals = patient.vitalSigns?.[0];
  const ecog = patient.ecogScore ?? latestVitals?.ecogScore;

  const allCheckins: any[] = patient.checkins ?? [];
  const recent14 = allCheckins.slice(0, 14);
  const avgScore = recent14.length > 0
    ? (recent14.reduce((s: number, c: any) => s + (c.score ?? 0), 0) / recent14.length).toFixed(1)
    : null;
  const highScoreCheckins = recent14.filter((c: any) => (c.score ?? 0) >= 4);
  // Collect all symptom keywords reported across recent check-ins
  const allSymptomWords: string[] = recent14.flatMap((c: any) => {
    if (!c.symptoms) return [];
    if (Array.isArray(c.symptoms)) return c.symptoms as string[];
    if (typeof c.symptoms === "string") return [c.symptoms];
    return [];
  });
  const uniqueSymptoms = [...new Set(allSymptomWords)].slice(0, 6);

  const abnormalLabs: any[] = (patient.labResults ?? []).filter((l: any) => l.isAbnormal || (l.flag && l.flag !== "NORMAL"));
  const criticalLabs = abnormalLabs.filter((l: any) => l.flag === "CRITICAL");
  const highLabs = abnormalLabs.filter((l: any) => l.flag === "HIGH");
  const lowLabs = abnormalLabs.filter((l: any) => l.flag === "LOW");

  const latestImaging = patient.imagingReports?.[0];
  const latestPath = patient.pathologyReports?.[0];

  const activeMeds: any[] = patient.medications ?? [];
  const unresolvedAlerts: any[] = patient.alerts ?? [];
  const careTeam: any[] = patient.careTeamMembers ?? [];
  const priorMdtNotes: any[] = patient.clinicalNotes ?? [];

  const missedCheckins = recent14.filter((c: any) => c.missed === true || c.score == null).length;

  // ── Section 1: Clinical Summary ──────────────────────────────────────────
  const ageStr = patient.dateOfBirth
    ? `${Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))}y`
    : patient.age ? `${patient.age}y` : "age unknown";

  let s1 = `═══════════════════════════════════════════════════════════════
MDT BRIEF  —  ${patient.name?.toUpperCase() ?? "PATIENT"}  —  Generated ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
═══════════════════════════════════════════════════════════════

1. CLINICAL SUMMARY
───────────────────
Patient    : ${na(patient.name)}, ${patient.gender?.toUpperCase() ?? "?"}, ${ageStr}
Diagnosis  : ${na(patient.cancerType)}${patient.stage ? ` — Stage ${patient.stage}` : ""}
`;
  if (patient.primarySite) s1 += `Primary site: ${patient.primarySite}\n`;
  if (patient.histology)   s1 += `Histology   : ${patient.histology}\n`;
  if (patient.diagnosisDate) s1 += `Dx date     : ${fmt(patient.diagnosisDate)}\n`;
  s1 += `Hospital    : ${na(patient.hospitalName)}\n`;
  s1 += `Treating Dr : ${na(patient.doctorName)}\n`;
  if (patient.comorbidities?.length) s1 += `Comorbidities: ${patient.comorbidities.join(", ")}\n`;
  if (patient.allergies?.length)     s1 += `Allergies   : ${patient.allergies.join(", ")}\n`;
  if (careTeam.length) {
    s1 += `Care team   : ${careTeam.map((m: any) => `${m.name} (${m.role})`).join(" · ")}\n`;
  }

  // ── Section 2: Treatment Status ──────────────────────────────────────────
  let s2 = `
2. TREATMENT STATUS
───────────────────
Protocol    : ${na(patient.treatmentProtocol)}
Cycle       : ${na(patient.currentCycle)}${patient.cycleStartDate ? ` (started ${fmt(patient.cycleStartDate)})` : ""}
ECOG        : ${ecog != null ? ecog : "not recorded"}
`;
  if (latestVitals) {
    const parts: string[] = [];
    if (latestVitals.weight)    parts.push(`Wt ${latestVitals.weight} kg`);
    if (latestVitals.height)    parts.push(`Ht ${latestVitals.height} cm`);
    if (latestVitals.bpSystolic) parts.push(`BP ${latestVitals.bpSystolic}/${latestVitals.bpDiastolic} mmHg`);
    if (latestVitals.oxygenSat) parts.push(`SpO₂ ${latestVitals.oxygenSat}%`);
    if (latestVitals.pulseRate) parts.push(`HR ${latestVitals.pulseRate}/min`);
    if (latestVitals.temperature) parts.push(`Temp ${latestVitals.temperature}°C`);
    if (parts.length) s2 += `Vitals      : ${parts.join(", ")} (${fmt(latestVitals.recordedAt)})\n`;
  }
  if (activeMeds.length) {
    s2 += `Medications : ${activeMeds.map((m: any) => m.name + (m.frequency ? ` (${m.frequency})` : "")).join(", ")}\n`;
  } else {
    s2 += `Medications : none recorded\n`;
  }

  // ── Section 3: Recent Symptoms & Toxicity ────────────────────────────────
  let s3 = `
3. RECENT SYMPTOMS & TOXICITY  (last ${recent14.length} check-ins via WhatsApp)
────────────────────────────────────────────────────────────────
`;
  if (recent14.length === 0) {
    s3 += `No patient self-reports on file.\n`;
  } else {
    s3 += `Avg symptom score : ${avgScore}/5\n`;
    s3 += `High-burden days  : ${highScoreCheckins.length} of ${recent14.length} (score ≥ 4)\n`;
    if (uniqueSymptoms.length) {
      s3 += `Reported symptoms : ${uniqueSymptoms.join(", ")}\n`;
    }
    if (missedCheckins > 0) {
      s3 += `Missed check-ins  : ${missedCheckins} — follow-up recommended\n`;
    }
    // Show last 5 with date + score
    s3 += `\nTimeline (most recent first):\n`;
    recent14.slice(0, 5).forEach((c: any) => {
      const scoreStr = c.score != null ? `${c.score}/5` : "–";
      const syms = Array.isArray(c.symptoms) && c.symptoms.length ? ` [${(c.symptoms as string[]).slice(0, 3).join(", ")}]` : "";
      s3 += `  ${fmt(c.createdAt ?? c.recordedAt)}  Score ${scoreStr}${syms}\n`;
    });
  }

  // ── Section 4: Key Lab/Imaging Findings ──────────────────────────────────
  let s4 = `
4. KEY LAB & IMAGING FINDINGS
───────────────────────────────
`;
  if (abnormalLabs.length === 0) {
    s4 += `Labs        : No abnormal values on file\n`;
  } else {
    if (criticalLabs.length) {
      s4 += `⚠ CRITICAL  : ${criticalLabs.map((l: any) => `${l.testName} ${l.value} ${l.unit ?? ""}`).join(", ")}\n`;
    }
    if (highLabs.length) {
      s4 += `Elevated    : ${highLabs.map((l: any) => `${l.testName} ${l.value} ${l.unit ?? ""}`).join(", ")}\n`;
    }
    if (lowLabs.length) {
      s4 += `Low         : ${lowLabs.map((l: any) => `${l.testName} ${l.value} ${l.unit ?? ""}`).join(", ")}\n`;
    }
    const latest = (patient.labResults ?? [])[0];
    if (latest) s4 += `(Most recent labs: ${fmt(latest.testDate)})\n`;
  }
  if (latestImaging) {
    s4 += `\nImaging     : ${latestImaging.modality ?? ""}${latestImaging.bodyPart ? ` — ${latestImaging.bodyPart}` : ""} (${fmt(latestImaging.studyDate)})\n`;
    if (latestImaging.impression) s4 += `Impression  : ${latestImaging.impression}\n`;
    if (latestImaging.response)   s4 += `Response    : ${latestImaging.response}\n`;
  } else {
    s4 += `\nImaging     : No reports on file\n`;
  }
  if (latestPath) {
    s4 += `\nPathology   : ${latestPath.specimenType ?? ""} from ${latestPath.site ?? "?"} (${fmt(latestPath.reportDate)})\n`;
    if (latestPath.diagnosis) s4 += `Diagnosis   : ${latestPath.diagnosis}\n`;
    if (latestPath.grade)     s4 += `Grade       : ${latestPath.grade}\n`;
    if (latestPath.margins)   s4 += `Margins     : ${latestPath.margins}\n`;
    if (latestPath.ihcFindings && Object.keys(latestPath.ihcFindings).length) {
      const ihc = Object.entries(latestPath.ihcFindings).map(([k, v]) => `${k}: ${v}`).join(", ");
      s4 += `IHC         : ${ihc}\n`;
    }
  } else {
    s4 += `Pathology   : No reports on file\n`;
  }

  // ── Section 5: Active Issues & Alerts ───────────────────────────────────
  let s5 = `
5. ACTIVE ISSUES & ALERTS
──────────────────────────
`;
  if (unresolvedAlerts.length === 0) {
    s5 += `No active unresolved alerts.\n`;
  } else {
    unresolvedAlerts.slice(0, 8).forEach((a: any) => {
      const sev = a.severity ? `[${a.severity}] ` : "";
      s5 += `• ${sev}${a.message ?? a.type ?? "Alert"}\n`;
    });
    if (unresolvedAlerts.length > 8) s5 += `  … and ${unresolvedAlerts.length - 8} more\n`;
  }
  if (priorMdtNotes.length) {
    s5 += `\nPrior MDT decisions on file: ${priorMdtNotes.length}\n`;
    const last = priorMdtNotes[0];
    if (last?.content) s5 += `Last decision (${fmt(last.noteDate)}): ${last.content.slice(0, 200)}${last.content.length > 200 ? "…" : ""}\n`;
  }

  // ── Section 6: Suggested Discussion Points (rule-based) ─────────────────
  const points: string[] = [];

  if (criticalLabs.length > 0) {
    points.push(`Critical lab values (${criticalLabs.map((l: any) => l.testName).join(", ")}) — assess impact on treatment continuation`);
  }
  if (latestImaging?.response === "PD") {
    points.push(`Imaging shows Progressive Disease — review treatment change options`);
  }
  if (latestImaging?.response === "PR") {
    points.push(`Partial Response on imaging — evaluate consolidation or maintenance approach`);
  }
  if (avgScore && parseFloat(avgScore) >= 3.5) {
    points.push(`High average symptom burden (${avgScore}/5) — review supportive care and dose modification`);
  }
  if (highScoreCheckins.length >= 3) {
    points.push(`${highScoreCheckins.length} high-severity symptom days — consider dose reduction or supportive intervention`);
  }
  if (missedCheckins >= 3) {
    points.push(`${missedCheckins} missed check-ins — assess adherence and patient engagement`);
  }
  if (ecog != null && ecog >= 3) {
    points.push(`ECOG ${ecog} — poor performance status, review treatment intensity`);
  }
  if (!ecog && ecog !== 0) {
    points.push(`ECOG score not documented — record at today's review`);
  }
  if (unresolvedAlerts.length >= 3) {
    points.push(`${unresolvedAlerts.length} unresolved alerts — triage and close loop`);
  }
  if (!latestPath) {
    points.push(`No pathology on file — confirm histological confirmation is available`);
  }
  if (!latestImaging) {
    points.push(`No imaging reports on file — schedule response assessment if on active treatment`);
  }
  if (activeMeds.length === 0) {
    points.push(`No active medications recorded — confirm treatment plan is up to date`);
  }
  if (careTeam.length === 0) {
    points.push(`No care team configured — assign MDT members for proper coordination`);
  }
  if (!patient.stage) {
    points.push(`Disease stage not recorded — update staging documentation`);
  }

  // Always suggest next review
  points.push(`Confirm date and modality of next response assessment / follow-up`);

  const s6 = `
6. SUGGESTED DISCUSSION POINTS
────────────────────────────────
${points.map((p, i) => `${i + 1}. ${p}`).join("\n")}
`;

  return [s1, s2, s3, s4, s5, s6].join("").trim();
}
