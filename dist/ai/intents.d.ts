import type { Patient } from "@prisma/client";
export interface IntentResult {
    intent: "checkin_response" | "appointment_request" | "symptom_report" | "emotional_support" | "medication_query" | "unknown";
    extractedScore: number | null;
    appointmentType: "chemo" | "followup" | "scan" | "consultation" | null;
    urgency: "routine" | "soon" | "today" | null;
    language: "hi" | "en" | "mr" | "ta" | "mixed";
    emotionalFlag: boolean;
}
export declare function classifyIntent(message: string, recentMessages: {
    role: string;
    content: string;
}[], patient: Patient, cycleDay: number, isNight: boolean): Promise<IntentResult>;
