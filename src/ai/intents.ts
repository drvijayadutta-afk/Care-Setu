import { askClaudeJSON } from "../integrations/claude";
import { INTENT_CLASSIFIER_PROMPT } from "./prompts";
import type { Patient } from "@prisma/client";

export interface IntentResult {
  intent:
    | "checkin_response"
    | "appointment_request"
    | "symptom_report"
    | "emotional_support"
    | "medication_query"
    | "unknown";
  extractedScore: number | null;
  appointmentType: "chemo" | "followup" | "scan" | "consultation" | null;
  urgency: "routine" | "soon" | "today" | null;
  language: "hi" | "en" | "mr" | "ta" | "mixed";
  emotionalFlag: boolean;
}

export async function classifyIntent(
  message: string,
  recentMessages: { role: string; content: string }[],
  patient: Patient,
  cycleDay: number,
  isNight: boolean
): Promise<IntentResult> {
  const context = `
Patient: ${patient.name}, ${patient.cancerType}, ${patient.treatmentProtocol}
Cycle Day: ${cycleDay} | Night: ${isNight}
Recent messages: ${recentMessages.map((m) => `[${m.role}]: ${m.content}`).join(" | ")}
Current message: ${message}
`;

  try {
    return await askClaudeJSON<IntentResult>(INTENT_CLASSIFIER_PROMPT, context, 128);
  } catch {
    // Safe fallback — treat as emotional support
    return {
      intent: "unknown",
      extractedScore: null,
      appointmentType: null,
      urgency: null,
      language: "hi",
      emotionalFlag: false,
    };
  }
}
