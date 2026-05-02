"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleOnboarding = handleOnboarding;
const client_1 = require("../../db/client");
const router_1 = require("../../messaging/router");
const CANCER_TYPES = [
    { id: "breast", title: "Breast Cancer", description: "" },
    { id: "colorectal", title: "Colorectal Cancer", description: "" },
    { id: "cervical", title: "Cervical Cancer", description: "" },
    { id: "lung", title: "Lung Cancer", description: "" },
    { id: "oral", title: "Oral / Head & Neck", description: "" },
    { id: "blood", title: "Blood Cancer / Leukemia", description: "" },
    { id: "stomach", title: "Stomach / Gastric", description: "" },
    { id: "liver", title: "Liver Cancer", description: "" },
    { id: "ovarian", title: "Ovarian Cancer", description: "" },
    { id: "prostate", title: "Prostate Cancer", description: "" },
    { id: "other", title: "Other", description: "" },
];
const PROTOCOLS = [
    { id: "AC-T", title: "AC-T (Breast)", description: "Doxorubicin + Cyclophosphamide + Taxol" },
    { id: "CMF", title: "CMF (Breast)", description: "Cyclophosphamide + Methotrexate + Fluorouracil" },
    { id: "FOLFOX", title: "FOLFOX (Colorectal)", description: "" },
    { id: "FOLFIRI", title: "FOLFIRI (Colorectal)", description: "" },
    { id: "CAPOX", title: "CAPOX (Colorectal)", description: "" },
    { id: "CARBOPLATIN-PACLITAXEL", title: "Carboplatin + Paclitaxel", description: "" },
    { id: "BEP", title: "BEP (Testicular)", description: "" },
    { id: "CHOP", title: "CHOP (Lymphoma)", description: "" },
    { id: "other", title: "Other / I don't know", description: "" },
];
const GREETINGS = {
    en: "Hello! I'm your Care Setu companion. 💙\n\nI'm here to support you, book appointments, and walk with you through this journey.\n\nWhich language would you prefer?",
    hi: "नमस्ते! मैं आपका Care Setu साथी हूँ। 💙\n\nआप किस भाषा में बात करना पसंद करेंगे?",
};
// ─── Safe DB helper ────────────────────────────────────────────────────────────
async function safeUpdate(identifier, data) {
    try {
        let where;
        if ("whatsappNumber" in identifier)
            where = { whatsappNumber: identifier.whatsappNumber };
        else if ("telegramChatId" in identifier)
            where = { telegramChatId: identifier.telegramChatId };
        else
            where = { id: identifier.patientId };
        await client_1.prisma.patient.update({ where, data });
        return true;
    }
    catch (err) {
        console.error(`❌ DB update failed at step: ${err?.message}`);
        return false;
    }
}
// ─── Resolve patientId from any identifier type ────────────────────────────────
async function getPatientIdFromIdentifier(identifier) {
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
// ─── Main handler ──────────────────────────────────────────────────────────────
async function handleOnboarding(identifier, patient, incomingText) {
    // Resolve patient if not provided
    let resolvedPatient = patient;
    if (!resolvedPatient) {
        if ("patientId" in identifier) {
            resolvedPatient = await client_1.prisma.patient.findUnique({
                where: { id: identifier.patientId },
            }) ?? undefined;
        }
        else if ("whatsappNumber" in identifier) {
            resolvedPatient = await client_1.prisma.patient.findUnique({
                where: { whatsappNumber: identifier.whatsappNumber },
            }) ?? undefined;
        }
        else if ("telegramChatId" in identifier) {
            resolvedPatient = await client_1.prisma.patient.findUnique({
                where: { telegramChatId: identifier.telegramChatId },
            }) ?? undefined;
        }
    }
    const step = resolvedPatient?.onboardingStep ?? 0;
    const data = resolvedPatient?.onboardingData ?? {};
    switch (step) {
        case 0: return sendStep1_Language(identifier);
        case 1: return processLanguage(identifier, incomingText, data);
        case 2: return processName(identifier, resolvedPatient, incomingText, data);
        case 3: return processCancerType(identifier, resolvedPatient, incomingText, data);
        case 4: return processProtocol(identifier, resolvedPatient, incomingText, data);
        case 5: return processCycleInfo(identifier, resolvedPatient, incomingText, data);
        case 6: return processHospital(identifier, resolvedPatient, incomingText, data);
        case 7: return processCaregiver(identifier, resolvedPatient, incomingText, data);
        case 8: return processConsent(identifier, resolvedPatient, incomingText, data);
        default: return;
    }
}
// ─── Step 0 → 1: Language selection ────────────────────────────────────────────
async function sendStep1_Language(identifier) {
    // Save to DB FIRST so we don't loop on failure
    let patientId;
    try {
        let result;
        if ("patientId" in identifier) {
            result = await client_1.prisma.patient.update({
                where: { id: identifier.patientId },
                data: { onboardingStep: 1 },
            });
            patientId = result.id;
        }
        else if ("whatsappNumber" in identifier) {
            result = await client_1.prisma.patient.upsert({
                where: { whatsappNumber: identifier.whatsappNumber },
                update: { onboardingStep: 1 },
                create: {
                    whatsappNumber: identifier.whatsappNumber,
                    onboardingStep: 1,
                    name: "", cancerType: "", treatmentProtocol: "",
                    cycleStartDate: new Date(), hospitalName: "", doctorName: "",
                },
            });
            patientId = result.id;
        }
        else {
            result = await client_1.prisma.patient.upsert({
                where: { telegramChatId: identifier.telegramChatId },
                update: { onboardingStep: 1 },
                create: {
                    telegramChatId: identifier.telegramChatId,
                    whatsappNumber: `telegram_${identifier.telegramChatId}`,
                    onboardingStep: 1,
                    name: "", cancerType: "", treatmentProtocol: "",
                    cycleStartDate: new Date(), hospitalName: "", doctorName: "",
                },
            });
            patientId = result.id;
        }
        const idStr = "whatsappNumber" in identifier ? identifier.whatsappNumber
            : "telegramChatId" in identifier ? identifier.telegramChatId : identifier.patientId;
        console.log(`✅ Patient record created/updated for ${idStr}`);
    }
    catch (err) {
        console.error(`❌ Failed to create patient: ${err?.message}`);
        return;
    }
    await router_1.messagingRouter.sendButtons(patientId, GREETINGS.en, [
        { id: "lang_hi", title: "हिंदी" },
        { id: "lang_en", title: "English" },
        { id: "lang_mr", title: "मराठी" },
    ]);
}
// ─── Step 1 → 2: Language chosen ───────────────────────────────────────────────
async function processLanguage(identifier, text, data) {
    const lang = text === "lang_hi" || text.includes("हिंदी") || text.toLowerCase().includes("hindi") ? "hi"
        : text === "lang_mr" || text.toLowerCase().includes("marathi") ? "mr"
            : text === "lang_ta" || text.toLowerCase().includes("tamil") ? "ta"
                : "en";
    await safeUpdate(identifier, {
        language: lang, onboardingStep: 2,
        onboardingData: { ...data, language: lang },
    });
    const msg = lang === "hi" ? "अच्छा! आपका पूरा नाम क्या है?"
        : lang === "mr" ? "छान! तुमचे पूर्ण नाव काय आहे?"
            : "Great! What is your full name?";
    const patientId = await getPatientIdFromIdentifier(identifier);
    if (!patientId)
        return;
    await router_1.messagingRouter.sendText(patientId, msg);
}
// ─── Step 2 → 3: Name entered ──────────────────────────────────────────────────
async function processName(identifier, patient, name, data) {
    const cleanName = name.trim() || "Friend";
    await safeUpdate(identifier, {
        name: cleanName, onboardingStep: 3,
        onboardingData: { ...data, name: cleanName },
    });
    const lang = patient.language || "en";
    const intro = lang === "hi"
        ? `${cleanName} जी, शुक्रिया। 🙏\n\nआपको कौन सा कैंसर है? नीचे से चुनें:`
        : `Thank you, ${cleanName}. 🙏\n\nWhat type of cancer are you being treated for? Choose below:`;
    const patientId = await getPatientIdFromIdentifier(identifier);
    if (!patientId)
        return;
    await router_1.messagingRouter.sendList(patientId, intro, "Select type", [{ title: "Cancer Types", rows: CANCER_TYPES }]);
}
// ─── Step 3 → 4: Cancer type chosen ───────────────────────────────────────────
async function processCancerType(identifier, patient, text, data) {
    const cancerType = CANCER_TYPES.find(c => c.id === text || c.title.toLowerCase() === text.toLowerCase())?.title || text;
    await safeUpdate(identifier, {
        cancerType, onboardingStep: 4,
        onboardingData: { ...data, cancerType },
    });
    const lang = patient.language || "en";
    const msg = lang === "hi"
        ? `ठीक है। आपका treatment protocol क्या है?\nनीचे से चुनें, या type करें:`
        : `Got it. What is your treatment protocol?\nChoose below, or type it:`;
    const patientId = await getPatientIdFromIdentifier(identifier);
    if (!patientId)
        return;
    await router_1.messagingRouter.sendList(patientId, msg, "Select protocol", [{ title: "Treatment Protocols", rows: PROTOCOLS }]);
}
// ─── Step 4 → 5: Protocol chosen ──────────────────────────────────────────────
async function processProtocol(identifier, patient, text, data) {
    const protocol = PROTOCOLS.find(p => p.id === text)?.id || text.toUpperCase().trim();
    await safeUpdate(identifier, {
        treatmentProtocol: protocol, onboardingStep: 5,
        onboardingData: { ...data, protocol },
    });
    const lang = patient.language || "en";
    const msg = lang === "hi"
        ? `समझ गया। आपका पहला cycle कब शुरू हुआ?\nजैसे: 15 April 2025\n\nऔर अभी कौन से cycle में हैं? (1, 2, 3...)`
        : `Got it. When did your first treatment cycle start?\nLike: 15 April 2025\n\nAnd which cycle are you on now? (1, 2, 3...)`;
    const patientId = await getPatientIdFromIdentifier(identifier);
    if (!patientId)
        return;
    await router_1.messagingRouter.sendText(patientId, msg);
}
// ─── Step 5 → 6: Cycle info ────────────────────────────────────────────────────
async function processCycleInfo(identifier, patient, text, data) {
    const cycleMatch = text.match(/\b([1-9]|1[0-2])\b/);
    const currentCycle = cycleMatch ? parseInt(cycleMatch[1]) : 1;
    const dateMatch = text.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)/i);
    let cycleStartDate = new Date();
    if (dateMatch) {
        cycleStartDate = new Date(`${dateMatch[1]} ${dateMatch[2]} ${new Date().getFullYear()}`);
        if (cycleStartDate > new Date())
            cycleStartDate.setFullYear(cycleStartDate.getFullYear() - 1);
    }
    await safeUpdate(identifier, {
        currentCycle, cycleStartDate, onboardingStep: 6,
        onboardingData: { ...data, currentCycle, cycleStartDate: cycleStartDate.toISOString() },
    });
    const lang = patient.language || "en";
    const msg = lang === "hi"
        ? `Cycle ${currentCycle} — ठीक है। 👍\n\nआप कौन से hospital में treatment ले रहे हैं?\nऔर आपके doctor का नाम क्या है?\n\nजैसे: Kokilaben Hospital, Dr. Priya Sharma`
        : `Cycle ${currentCycle} — noted. 👍\n\nWhich hospital are you receiving treatment at?\nAnd your doctor's name?\n\nExample: Kokilaben Hospital, Dr. Priya Sharma`;
    const patientId = await getPatientIdFromIdentifier(identifier);
    if (!patientId)
        return;
    await router_1.messagingRouter.sendText(patientId, msg);
}
// ─── Step 6 → 7: Hospital & doctor ────────────────────────────────────────────
async function processHospital(identifier, patient, text, data) {
    const parts = text.split(/,\s*dr\.?\s*/i);
    const hospitalName = parts[0]?.trim() || text.trim();
    const doctorName = parts[1] ? `Dr. ${parts[1].trim()}` : "Not specified";
    await safeUpdate(identifier, {
        hospitalName, doctorName, onboardingStep: 7,
        onboardingData: { ...data, hospitalName, doctorName },
    });
    const lang = patient.language || "en";
    const msg = lang === "hi"
        ? `${hospitalName} — नोट किया। 👍\n\nक्या आपके साथ कोई caregiver है जो आपकी देखभाल करते हैं?\n(जैसे पति/पत्नी, बच्चा, माता-पिता)\n\nउनका नाम और phone number बताइए।\nया "Skip" लिखें।`
        : `${hospitalName} — noted. 👍\n\nDo you have a caregiver who looks after you?\n(Like your spouse, child, or parent)\n\nShare their name and phone number.\nOr type "Skip" to continue.`;
    const patientId = await getPatientIdFromIdentifier(identifier);
    if (!patientId)
        return;
    await router_1.messagingRouter.sendText(patientId, msg);
}
// ─── Step 7 → 8: Caregiver ─────────────────────────────────────────────────────
async function processCaregiver(identifier, patient, text, data) {
    let caregiverData = null;
    if (!text.toLowerCase().includes("skip")) {
        const phoneMatch = text.match(/(?:\+91|91)?([6-9]\d{9})/);
        const nameMatch = text.match(/^([^,\n0-9+]+)/);
        if (phoneMatch && nameMatch) {
            const caregiverNumber = `91${phoneMatch[1]}`;
            const caregiverName = nameMatch[1]?.trim() || "Caregiver";
            try {
                await client_1.prisma.caregiver.upsert({
                    where: { whatsappNumber: caregiverNumber },
                    update: { name: caregiverName, patientId: patient.id },
                    create: {
                        whatsappNumber: caregiverNumber,
                        name: caregiverName,
                        relationToPatient: "family",
                        patientId: patient.id,
                        isEnrolled: false,
                    },
                });
                caregiverData = { name: caregiverName, number: caregiverNumber };
                console.log(`✅ Caregiver enrolled: ${caregiverName} (${caregiverNumber})`);
            }
            catch (err) {
                console.error(`❌ Caregiver upsert failed: ${err?.message}`);
            }
        }
    }
    await safeUpdate(identifier, {
        onboardingStep: 8,
        onboardingData: { ...data, caregiver: caregiverData },
    });
    await sendConsentMessage(identifier, patient.language);
}
// ─── Step 8: Consent ───────────────────────────────────────────────────────────
async function sendConsentMessage(identifier, lang) {
    const msg = lang === "hi"
        ? `आखिरी चीज़ — आपकी privacy:\n\n✅ आपकी जानकारी सिर्फ आपकी care के लिए\n✅ कभी बिना permission share नहीं होगी\n✅ सिर्फ doctor और caregiver को ज़रूरी updates\n\nAgree करके आगे बढ़ें:`
        : `Last step — your privacy:\n\n✅ Your info is only used for your care\n✅ Never shared without your permission\n✅ Only your doctor & caregiver get updates\n\nTap to continue:`;
    const patientId = await getPatientIdFromIdentifier(identifier);
    if (!patientId)
        return;
    await router_1.messagingRouter.sendButtons(patientId, msg, [
        { id: "consent_accept", title: "✅ Accept & Continue" },
        { id: "consent_decline", title: "Not now" },
    ]);
}
// ─── Step 8 → 9: Consent given ────────────────────────────────────────────────
async function processConsent(identifier, patient, text, data) {
    if (text === "consent_decline" || text.toLowerCase().includes("not now")) {
        const patientId = await getPatientIdFromIdentifier(identifier);
        if (!patientId)
            return;
        await router_1.messagingRouter.sendText(patientId, "Okay — whenever you're ready, just message me. I'm here. 💙");
        return;
    }
    await safeUpdate(identifier, {
        onboardingStep: 9,
        onboardingData: { ...data, consentGiven: true },
    });
    const lang = patient.language || "en";
    const name = patient.name || "Friend";
    const welcome = lang === "hi"
        ? `${name} जी, आपका स्वागत है! 💙\n\nमैं अब आपके साथ हूँ। कल सुबह से रोज़ आपका हाल पूछूँगा।\n\nअगर रात को नींद न आए, या कुछ भी पूछना हो — बस message करें। 🙏\n\nआज के लिए — अच्छे से आराम करें।`
        : `Welcome, ${name}! 💙\n\nI'm here with you now. Starting tomorrow morning, I'll check in with you daily.\n\nIf you can't sleep or need anything — just message me. I'm always here. 🙏\n\nFor today — rest well.`;
    const patientId = await getPatientIdFromIdentifier(identifier);
    if (!patientId)
        return;
    await router_1.messagingRouter.sendText(patientId, welcome);
    // Schedule daily check-in (best effort — don't crash if queue fails)
    try {
        const { checkinQueue } = await Promise.resolve().then(() => __importStar(require("../../jobs/queue")));
        const tomorrow8am = new Date();
        tomorrow8am.setDate(tomorrow8am.getDate() + 1);
        tomorrow8am.setHours(8, 0, 0, 0);
        await checkinQueue.add("morning-checkin", { patientId: patient.id, cycleDay: 1, type: "morning" }, { delay: tomorrow8am.getTime() - Date.now() });
        console.log(`✅ Check-in scheduled for ${name}`);
    }
    catch (err) {
        console.error(`⚠️ Check-in scheduling failed (non-critical): ${err?.message}`);
    }
}
//# sourceMappingURL=flow.js.map