"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.askClaude = askClaude;
exports.askClaudeWithHistory = askClaudeWithHistory;
exports.askClaudeJSON = askClaudeJSON;
exports.extractDocumentData = extractDocumentData;
exports.generateMdtSummary = generateMdtSummary;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const supabase_storage_1 = require("./supabase-storage");
const client = new sdk_1.default({
    apiKey: process.env.ANTHROPIC_API_KEY,
});
const MODEL = "claude-sonnet-4-6";
async function askClaude(systemPrompt, userMessage, maxTokens = 512) {
    const message = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
    });
    const block = message.content[0];
    if (block.type !== "text")
        throw new Error("Unexpected response type from Claude");
    return block.text;
}
async function askClaudeWithHistory(systemPrompt, history, maxTokens = 512) {
    const message = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: history,
    });
    const block = message.content[0];
    if (block.type !== "text")
        throw new Error("Unexpected response type from Claude");
    return block.text;
}
async function askClaudeJSON(systemPrompt, userMessage, maxTokens = 256) {
    const raw = await askClaude(systemPrompt, userMessage, maxTokens);
    // Strip markdown code fences if Claude adds them
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(cleaned);
}
// ─── Document AI Extraction ──────────────────────────────────────────────────
const EXTRACT_PROMPTS = {
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
async function extractDocumentData(storagePath, category, fileType) {
    const systemPrompt = EXTRACT_PROMPTS[category] ?? EXTRACT_PROMPTS["LAB_REPORT"];
    const fileBytes = await (0, supabase_storage_1.downloadFileBytes)(storagePath);
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
                        type: "document",
                        source: { type: "base64", media_type: mediaType, data: base64 },
                    },
                    { type: "text", text: "Extract structured data from this medical report." },
                ],
            },
        ],
    });
    const block = message.content[0];
    if (block.type !== "text")
        throw new Error("Unexpected response from Claude");
    const cleaned = block.text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(cleaned);
}
// ─── MDT Summary Generator ───────────────────────────────────────────────────
async function generateMdtSummary(patient) {
    const recentCheckins = (patient.checkins ?? []).slice(0, 7);
    const avgScore = recentCheckins.length > 0
        ? (recentCheckins.reduce((s, c) => s + c.score, 0) / recentCheckins.length).toFixed(1)
        : "N/A";
    const abnormalLabs = (patient.labResults ?? [])
        .filter((l) => l.isAbnormal)
        .slice(0, 10)
        .map((l) => `${l.testName}: ${l.value} ${l.unit ?? ""} [${l.flag}]`)
        .join(", ");
    const latestImaging = patient.imagingReports?.[0];
    const latestPath = patient.pathologyReports?.[0];
    const latestVitals = patient.vitalSigns?.[0];
    const careTeam = (patient.careTeamMembers ?? [])
        .map((m) => `${m.role}: ${m.name}`)
        .join(", ");
    const context = `
PATIENT: ${patient.name}, ${patient.gender ?? "?"}, DOB: ${patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : "unknown"}
DIAGNOSIS: ${patient.cancerType} | Stage: ${patient.stage ?? "not staged"} | Site: ${patient.primarySite ?? "?"} | Histology: ${patient.histology ?? "?"}
DIAGNOSIS DATE: ${patient.diagnosisDate ? new Date(patient.diagnosisDate).toLocaleDateString() : "unknown"}
TREATMENT: ${patient.treatmentProtocol}, Cycle ${patient.currentCycle} (started ${new Date(patient.cycleStartDate).toLocaleDateString()})
ECOG: ${patient.ecogScore ?? latestVitals?.ecogScore ?? "not recorded"}
HOSPITAL: ${patient.hospitalName} | PRIMARY DR: ${patient.doctorName}
CARE TEAM: ${careTeam || "not configured"}
ALLERGIES: ${(patient.allergies ?? []).join(", ") || "none recorded"}
COMORBIDITIES: ${(patient.comorbidities ?? []).join(", ") || "none recorded"}

LATEST VITALS: Weight ${latestVitals?.weight ?? "?"}kg, BP ${latestVitals?.bpSystolic ?? "?"}/${latestVitals?.bpDiastolic ?? "?"}mmHg, SpO2 ${latestVitals?.oxygenSat ?? "?"}%

RECENT SYMPTOM CHECK-INS (last 7): avg score ${avgScore}/5
ACTIVE ALERTS: ${patient.alerts?.length ?? 0}

ABNORMAL LAB VALUES: ${abnormalLabs || "none flagged"}

LATEST IMAGING: ${latestImaging ? `${latestImaging.modality} ${latestImaging.bodyPart} (${new Date(latestImaging.studyDate).toLocaleDateString()}) — ${latestImaging.impression ?? "no impression recorded"}` : "none on file"}

LATEST PATHOLOGY: ${latestPath ? `${latestPath.specimenType} from ${latestPath.site} — ${latestPath.diagnosis}` : "none on file"}

ACTIVE MEDICATIONS: ${(patient.medications ?? []).map((m) => m.name).join(", ") || "none recorded"}

MDT DECISIONS ON FILE: ${patient.clinicalNotes?.length ?? 0}
`.trim();
    const systemPrompt = `You are a senior oncologist preparing a concise MDT (Multidisciplinary Team) brief.
Write a structured 1-page clinical summary suitable for a tumor board meeting.
Use clinical language. Sections: Clinical Summary, Treatment Status, Recent Symptoms & Toxicity, Key Lab/Imaging Findings, Active Issues & Alerts, Suggested Discussion Points.
Be concise and factual. Do not add anything not present in the data provided.`;
    return askClaude(systemPrompt, context, 1024);
}
//# sourceMappingURL=claude.js.map