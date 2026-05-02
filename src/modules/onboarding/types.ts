import type { Patient } from "@prisma/client";

// ─── Step Context ────────────────────────────────────────────────────────────
export interface StepContext {
  patient: Patient;
  identifier: { whatsappNumber: string } | { telegramChatId: string } | { patientId: string };
  onboardingData: Record<string, any>;
}

// ─── Side Effects ────────────────────────────────────────────────────────────
export type SideEffect =
  | { type: "update_patient"; data: Record<string, any> }
  | { type: "send_message"; text: string }
  | { type: "send_buttons"; body: string; buttons: { id: string; title: string }[] }
  | { type: "send_list"; body: string; sections: any[] }
  | { type: "create_caregiver"; caregiverNumber: string; caregiverName: string }
  | { type: "schedule_checkin"; patientId: string };

// ─── Step Handler Result ──────────────────────────────────────────────────────
export interface StepResult {
  nextStepId: string | null; // null = end of onboarding (step 9)
  sideEffects: SideEffect[];
}

// ─── Step Definition ─────────────────────────────────────────────────────────
export interface OnboardingStep {
  id: string; // "language", "name", "cancer-type", etc.
  stepNumber: number; // 0-8
  prompt(ctx: StepContext): string;
  handle(userInput: string, ctx: StepContext): Promise<StepResult>;
}
