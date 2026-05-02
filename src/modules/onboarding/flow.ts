import { prisma } from "../../db/client";
import { messagingRouter } from "../../messaging/router";
import type { Patient } from "@prisma/client";
import { getStepByNumber, ONBOARDING_STEPS } from "./steps";
import { executeSideEffects } from "./interpreter";
import type { StepContext } from "./types";

// ─── Resolve patientId from any identifier type ────────────────────────────────
async function resolvePatientId(
  identifier: { whatsappNumber: string } | { telegramChatId: string } | { patientId: string }
): Promise<string | null> {
  try {
    let where: any;
    if ("whatsappNumber" in identifier) where = { whatsappNumber: identifier.whatsappNumber };
    else if ("telegramChatId" in identifier) where = { telegramChatId: identifier.telegramChatId };
    else return identifier.patientId;

    const patient = await prisma.patient.findUnique({ where, select: { id: true } });
    return patient?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Ensure patient exists (upsert on first contact) ──────────────────────────
async function ensurePatientExists(
  identifier: { whatsappNumber: string } | { telegramChatId: string } | { patientId: string }
): Promise<Patient | null> {
  try {
    if ("patientId" in identifier) {
      return await prisma.patient.findUnique({
        where: { id: identifier.patientId },
      });
    } else if ("whatsappNumber" in identifier) {
      return await prisma.patient.upsert({
        where: { whatsappNumber: identifier.whatsappNumber },
        update: {},
        create: {
          whatsappNumber: identifier.whatsappNumber,
          onboardingStep: 0,
          name: "",
          cancerType: "",
          treatmentProtocol: "",
          cycleStartDate: new Date(),
          hospitalName: "",
          doctorName: "",
        },
      });
    } else {
      return await prisma.patient.upsert({
        where: { telegramChatId: identifier.telegramChatId },
        update: {},
        create: {
          telegramChatId: identifier.telegramChatId,
          whatsappNumber: `telegram_${identifier.telegramChatId}`,
          onboardingStep: 0,
          name: "",
          cancerType: "",
          treatmentProtocol: "",
          cycleStartDate: new Date(),
          hospitalName: "",
          doctorName: "",
        },
      });
    }
  } catch (err: any) {
    console.error(`❌ Failed to ensure patient exists: ${err?.message}`);
    return null;
  }
}

// ─── Main orchestrator ──────────────────────────────────────────────────────────
export async function handleOnboarding(
  identifier: { whatsappNumber: string } | { telegramChatId: string } | { patientId: string },
  patient: Patient | null,
  incomingText: string
) {
  // Ensure patient exists (create if first contact)
  let resolvedPatient = patient;
  if (!resolvedPatient) {
    resolvedPatient = await ensurePatientExists(identifier);
  }

  if (!resolvedPatient) {
    console.error(`❌ Could not resolve or create patient for onboarding`);
    return;
  }

  const patientId = resolvedPatient.id;
  const currentStepNumber = resolvedPatient.onboardingStep ?? 0;
  const currentStep = getStepByNumber(currentStepNumber);

  if (!currentStep) {
    console.warn(`⚠️ No step found for step number ${currentStepNumber}`);
    return;
  }

  const ctx: StepContext = {
    patient: resolvedPatient,
    identifier,
    onboardingData: (resolvedPatient.onboardingData as Record<string, any>) ?? {},
  };

  try {
    const result = await currentStep.handle(incomingText, ctx);
    // Side effects already include onboardingStep updates; executed transactionally
    await executeSideEffects(result.sideEffects, patientId, identifier);
    console.log(`✅ Step ${currentStepNumber} processed for patient ${patientId}`);
  } catch (err: any) {
    console.error(`❌ Step ${currentStepNumber} failed: ${err?.message}`);
    // Step resumes on next inbound message from same onboardingStep
  }
}
