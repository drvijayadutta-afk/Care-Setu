/**
 * Hook 5: Voice-to-SOAP Note
 *
 * Workflow:
 *   1. Doctor records 15–60s audio in the PWA
 *   2. Audio blob is uploaded to Supabase Storage via multipart POST
 *   3. Server: download → Whisper → structured SOAP via Claude
 *   4. Returns { transcript, soap } — doctor reviews/edits then signs
 *
 * SOAP fields:
 *   HPI  — History of Present Illness: what the patient reported today
 *   Exam — Relevant exam findings (ECOG, vitals, relevant findings)
 *   Assessment — Clinical assessment / impression
 *   Plan — Next steps: investigations, dose adjustments, follow-up
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import type { Readable } from "stream";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30_000 })
  : null;

const _supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    : null;

const VOICE_NOTES_BUCKET = "voice-notes";
const CLAUDE_MODEL = "claude-sonnet-4-6";

export interface SoapFields {
  hpi: string;        // History of Present Illness
  exam: string;       // Examination findings
  assessment: string; // Clinical assessment
  plan: string;       // Management plan
}

export interface VoiceSoapResult {
  audioStorageKey: string;
  transcript: string;
  soap: SoapFields;
}

// ─── Step 1: Upload audio to Supabase Storage ────────────────────────────────

export async function uploadAudioToStorage(
  audioBuffer: Buffer,
  patientId: string,
  mimeType: string
): Promise<string> {
  if (!_supabase) {
    throw new Error("Supabase not configured — cannot store voice note audio");
  }

  const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "mp4" : "ogg";
  const key = `${patientId}/${Date.now()}.${ext}`;

  const { error } = await _supabase.storage
    .from(VOICE_NOTES_BUCKET)
    .upload(key, audioBuffer, { contentType: mimeType, upsert: false });

  if (error) {
    throw new Error(`Audio upload failed: ${error.message}`);
  }

  return key;
}

// ─── Step 2: Transcribe audio with Whisper ───────────────────────────────────

export async function transcribeAudio(
  audioBuffer: Buffer,
  language: string,
  filename = "voice-note.webm"
): Promise<string> {
  if (!openai) {
    return "[Transcription unavailable — OPENAI_API_KEY not configured]";
  }

  const LANG_MAP: Record<string, string> = {
    en: "en", hi: "hi", ta: "ta", mr: "mr", bn: "bn",
  };

  const file = new File([new Uint8Array(audioBuffer)], filename, {
    type: "audio/webm",
  });

  const result = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: LANG_MAP[language] ?? "en",
  });

  return result.text ?? "";
}

// ─── Step 3: Structure transcript into SOAP via Claude ───────────────────────

const SOAP_SYSTEM_PROMPT = `You are an oncology clinical documentation assistant.
Convert the doctor's voice note transcript into a structured SOAP note.

The doctor is an oncologist. The note may be brief (15–60 seconds of speech).
Fill each section with what was mentioned. If a section wasn't covered, write "Not mentioned."

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "hpi": "...",
  "exam": "...",
  "assessment": "...",
  "plan": "..."
}`;

export async function structureSoapFromTranscript(
  transcript: string,
  patientContext: {
    cancerType: string;
    treatmentProtocol: string;
    currentCycle: number;
  }
): Promise<SoapFields> {
  if (!anthropic || !transcript.trim()) {
    return {
      hpi: transcript || "Voice transcript unavailable",
      exam: "Not documented",
      assessment: "Not documented",
      plan: "Not documented",
    };
  }

  const userMessage = `Patient: ${patientContext.cancerType} · ${patientContext.treatmentProtocol} · Cycle ${patientContext.currentCycle}

Doctor's voice note transcript:
"${transcript}"`;

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      system: SOAP_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : "{}";
    const jsonText = rawText.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(jsonText) as Partial<SoapFields>;

    return {
      hpi: parsed.hpi ?? "Not documented",
      exam: parsed.exam ?? "Not documented",
      assessment: parsed.assessment ?? "Not documented",
      plan: parsed.plan ?? "Not documented",
    };
  } catch (err) {
    console.error("[voice-soap] Claude structuring failed:", (err as Error).message);
    return {
      hpi: transcript,
      exam: "Not documented (structuring failed)",
      assessment: "Not documented",
      plan: "Not documented",
    };
  }
}

// ─── Main orchestrator ───────────────────────────────────────────────────────

export async function transcribeAndStructure(
  audioBuffer: Buffer,
  patientId: string,
  mimeType: string,
  language: string,
  patientContext: {
    cancerType: string;
    treatmentProtocol: string;
    currentCycle: number;
  }
): Promise<VoiceSoapResult> {
  // Upload and transcribe in parallel where possible
  const [audioStorageKey, transcript] = await Promise.all([
    uploadAudioToStorage(audioBuffer, patientId, mimeType),
    transcribeAudio(audioBuffer, language),
  ]);

  const soap = await structureSoapFromTranscript(transcript, patientContext);

  return { audioStorageKey, transcript, soap };
}
