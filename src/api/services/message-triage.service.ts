/**
 * Hook 4: AI Patient Triage Inbox — Message classifier
 *
 * Classifies an inbound patient Conversation message into:
 *   category: urgent | routine | educational
 *   urgency:  high | medium | low (finer-grain within category)
 *   suggestedReply: AI-drafted reply for the doctor's inbox
 *
 * Urgency rules (aligned with the plan):
 *   urgent  — fever, dyspnea, severe pain, suspected emergency, bleeding
 *   routine — appointment shift, "where's my report?", lab timings
 *   educational — diet, hair loss, "is X normal?" expected side effects
 *
 * Called from the message triage job (triage-classifier.job.ts) after
 * any inbound patient message is persisted.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../../db/client";

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("⚠️  ANTHROPIC_API_KEY not set — message triage will use fallback 'routine' classification");
}

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 20_000 })
  : null;

const MODEL = "claude-haiku-4-5"; // fast + cheap for classification

export type TriageCategory = "urgent" | "routine" | "educational";
export type TriageUrgency = "high" | "medium" | "low";

export interface TriageResult {
  category: TriageCategory;
  urgency: TriageUrgency;
  suggestedReply: string;
  reasoning: string;
}

const SYSTEM_PROMPT = `You are a clinical triage assistant for an oncology care platform in India.
Your job is to classify a patient's WhatsApp message and draft a brief doctor reply.

CLASSIFICATION RULES (first match wins):
- urgent/high: fever >38°C, chills/rigors, severe pain (≥7/10), dyspnea/breathlessness, bleeding, vomiting unable to hold fluids, suspected neutropenic sepsis, confusion, severe allergic reaction
- urgent/medium: moderate pain (4-6/10), persistent nausea/vomiting, missed chemo dose worry, port site redness/swelling, worsening symptoms from previous visit
- routine/medium: appointment reschedule, "when are my labs?", insurance paperwork, certificate request, mild symptom update
- routine/low: "I took my medicines", "report collected", acknowledgment messages
- educational/low: "is hair loss normal?", diet questions, general cancer information, expected side effect queries, motivational/emotional support not requiring clinical action

IMPORTANT: Even if the message is in Hindi, Marathi, or other Indian languages, classify correctly.

Respond ONLY with valid JSON (no markdown):
{
  "category": "urgent" | "routine" | "educational",
  "urgency": "high" | "medium" | "low",
  "suggestedReply": "...",  // 1-3 sentences in the same language as the patient message; warm, clinical
  "reasoning": "..."         // 1 sentence explaining the classification
}`;

function buildUserPrompt(
  message: string,
  patientContext: {
    cancerType: string;
    treatmentProtocol: string;
    currentCycle: number;
    lastCheckinScore?: number;
  }
): string {
  return `Patient context: ${patientContext.cancerType} · ${patientContext.treatmentProtocol} · Cycle ${patientContext.currentCycle}${
    patientContext.lastCheckinScore != null
      ? ` · Last wellbeing score: ${patientContext.lastCheckinScore}/5`
      : ""
  }

Patient message:
${message}`;
}

/**
 * Classify a single Conversation message and persist the triage result.
 * No-op if:
 *  - The message is not from the patient (role !== 'user')
 *  - Already triaged
 */
export async function classifyMessage(messageId: string): Promise<TriageResult | null> {
  const message = await prisma.conversation.findUnique({
    where: { id: messageId },
    include: {
      patient: {
        select: {
          cancerType: true,
          treatmentProtocol: true,
          currentCycle: true,
          checkins: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { score: true },
          },
        },
      },
    },
  });

  if (!message) return null;
  // Only classify inbound patient messages that haven't been triaged yet
  if (message.role !== "user" || message.triageCategory) return null;

  const { patient } = message;
  const patientContext = {
    cancerType: patient.cancerType,
    treatmentProtocol: patient.treatmentProtocol,
    currentCycle: patient.currentCycle,
    lastCheckinScore: patient.checkins[0]?.score,
  };

  let result: TriageResult;

  if (!client) {
    // No API key — fallback to safe 'routine' classification
    result = {
      category: "routine",
      urgency: "medium",
      suggestedReply:
        "Thank you for your message. I'll review it and get back to you shortly.",
      reasoning: "Fallback: ANTHROPIC_API_KEY not configured",
    };
  } else {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildUserPrompt(message.content, patientContext),
          },
        ],
      });

      const rawText =
        response.content[0]?.type === "text" ? response.content[0].text.trim() : "{}";

      // Strip any accidental markdown fences
      const jsonText = rawText.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      const parsed = JSON.parse(jsonText) as Partial<TriageResult>;

      result = {
        category: (parsed.category as TriageCategory) ?? "routine",
        urgency: (parsed.urgency as TriageUrgency) ?? "medium",
        suggestedReply: parsed.suggestedReply ?? "",
        reasoning: parsed.reasoning ?? "",
      };
    } catch (err) {
      console.error("[message-triage] Claude call failed:", (err as Error).message);
      result = {
        category: "routine",
        urgency: "medium",
        suggestedReply: "",
        reasoning: "Classification error — defaulted to routine",
      };
    }
  }

  // Persist the triage result
  await prisma.conversation.update({
    where: { id: messageId },
    data: {
      triageCategory: result.category,
      triageUrgency: result.urgency,
      suggestedReply: result.suggestedReply,
      triagedAt: new Date(),
    },
  });

  return result;
}

/**
 * Re-triage all unclassified inbound patient messages for a given patient.
 * Useful for backfilling when the feature first launches.
 */
export async function backfillTriage(patientId: string, limit = 50): Promise<number> {
  const unclassified = await prisma.conversation.findMany({
    where: {
      patientId,
      role: "user",
      triageCategory: null,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true },
  });

  let classified = 0;
  for (const { id } of unclassified) {
    const result = await classifyMessage(id);
    if (result) classified++;
  }
  return classified;
}
