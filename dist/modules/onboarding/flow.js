"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleOnboarding = handleOnboarding;
const client_1 = require("../../db/client");
const steps_1 = require("./steps");
const interpreter_1 = require("./interpreter");
// ─── Resolve patientId from any identifier type ────────────────────────────────
async function resolvePatientId(identifier) {
    try {
        let where;
        if ("whatsappNumber" in identifier)
            where = { whatsappNumber: identifier.whatsappNumber };
        else if ("telegramChatId" in identifier)
            where = { telegramChatId: identifier.telegramChatId };
        else
            return identifier.patientId;
        const patient = await client_1.prisma.patient.findUnique({ where, select: { id: true } });
        return patient?.id ?? null;
    }
    catch {
        return null;
    }
}
// ─── Ensure patient exists (upsert on first contact) ──────────────────────────
async function ensurePatientExists(identifier) {
    try {
        if ("patientId" in identifier) {
            return await client_1.prisma.patient.findUnique({
                where: { id: identifier.patientId },
            });
        }
        else if ("whatsappNumber" in identifier) {
            return await client_1.prisma.patient.upsert({
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
        }
        else {
            return await client_1.prisma.patient.upsert({
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
    }
    catch (err) {
        console.error(`❌ Failed to ensure patient exists: ${err?.message}`);
        return null;
    }
}
// ─── Main orchestrator ──────────────────────────────────────────────────────────
async function handleOnboarding(identifier, patient, incomingText) {
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
    const currentStep = (0, steps_1.getStepByNumber)(currentStepNumber);
    if (!currentStep) {
        console.warn(`⚠️ No step found for step number ${currentStepNumber}`);
        return;
    }
    const ctx = {
        patient: resolvedPatient,
        identifier,
        onboardingData: resolvedPatient.onboardingData ?? {},
    };
    try {
        const result = await currentStep.handle(incomingText, ctx);
        // Side effects already include onboardingStep updates; executed transactionally
        await (0, interpreter_1.executeSideEffects)(result.sideEffects, patientId, identifier);
        console.log(`✅ Step ${currentStepNumber} processed for patient ${patientId}`);
    }
    catch (err) {
        console.error(`❌ Step ${currentStepNumber} failed: ${err?.message}`);
        // Step resumes on next inbound message from same onboardingStep
    }
}
//# sourceMappingURL=flow.js.map