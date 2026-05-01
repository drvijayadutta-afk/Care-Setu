"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCheckinMessage = sendCheckinMessage;
exports.handleCheckinResponse = handleCheckinResponse;
const client_1 = require("../../db/client");
const sender_1 = require("../../webhook/sender");
const claude_1 = require("../../integrations/claude");
const prompts_1 = require("../../ai/prompts");
const thresholds_1 = require("../symptoms/thresholds");
// Called by BullMQ worker to send the morning/afternoon check-in message
async function sendCheckinMessage(patientId, cycleDay, type) {
    const patient = await client_1.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient || !patient.isActive)
        return;
    // Get yesterday's score for context
    const yesterday = await client_1.prisma.checkin.findFirst({
        where: { patientId },
        orderBy: { createdAt: "desc" },
    });
    const message = buildCheckinMessage(patient, cycleDay, type, yesterday?.score ?? null);
    await (0, sender_1.sendButtonMessage)(patient.whatsappNumber, message, [
        { id: "checkin_1", title: "😰 Very Hard (1)" },
        { id: "checkin_2", title: "😔 Hard (2)" },
        { id: "checkin_3", title: "😐 Okay (3)" },
        { id: "checkin_4", title: "🙂 Better (4)" },
        { id: "checkin_5", title: "😊 Good (5)" },
    ]);
}
function buildCheckinMessage(patient, cycleDay, type, yesterdayScore) {
    const lang = patient.language;
    const name = patient.name.split(" ")[0]; // First name only
    const dayContext = getDayContext(cycleDay, patient.treatmentProtocol);
    const timeGreeting = type === "morning"
        ? (lang === "hi" ? "सुप्रभात" : "Good morning")
        : (lang === "hi" ? "नमस्ते" : "Good afternoon");
    const yesterdayNote = yesterdayScore !== null && yesterdayScore <= 2
        ? lang === "hi"
            ? "\nकल मुश्किल था — आज कैसा महसूस हो रहा है?"
            : "\nYesterday was hard — how are you feeling today?"
        : "";
    if (lang === "hi") {
        return `${timeGreeting}, ${name} जी 🌅\n\nआप ${patient.treatmentProtocol} के Cycle ${patient.currentCycle}, Day ${cycleDay} पर हैं।\n${dayContext}${yesterdayNote}\n\nआज कैसा महसूस हो रहा है?`;
    }
    return `${timeGreeting}, ${name} 🌅\n\nYou're on Cycle ${patient.currentCycle}, Day ${cycleDay} of ${patient.treatmentProtocol}.\n${dayContext}${yesterdayNote}\n\nHow are you feeling today?`;
}
function getDayContext(cycleDay, protocol) {
    if (cycleDay <= 2)
        return "\nDays 1-2 are usually manageable. Side effects haven't fully started yet.";
    if (cycleDay <= 5)
        return "\nDays 3-5 are often the hardest. Nausea and fatigue are common — rest as much as you need.";
    if (cycleDay <= 10)
        return "\nYou're through the hardest stretch. Things should slowly start improving.";
    if (cycleDay <= 14)
        return "\nRecovery phase. Energy is returning gradually. Your body is healing.";
    return "\nAlmost through this cycle. You're doing this. 💪";
}
// Called when patient responds to a check-in
async function handleCheckinResponse(patient, text, preExtractedScore, isSymptomReport = false) {
    // Extract score from button reply ID (checkin_1 through checkin_5)
    let score = null;
    if (typeof preExtractedScore === "string" && preExtractedScore.startsWith("checkin_")) {
        score = parseInt(preExtractedScore.replace("checkin_", ""));
        text = `Score: ${score}`;
    }
    else if (typeof preExtractedScore === "number") {
        score = preExtractedScore;
    }
    // For text responses, extract structured data via Claude
    let symptoms = [];
    let emotionalState = null;
    let notes = null;
    if (text && text.length > 2) {
        try {
            const extracted = await (0, claude_1.askClaudeJSON)(prompts_1.CHECKIN_EXTRACTOR_PROMPT, `Patient message: "${text}"\nLanguage: ${patient.language}`);
            if (score === null)
                score = extracted.score;
            symptoms = extracted.symptoms || [];
            emotionalState = extracted.emotionalState;
            notes = extracted.notes;
        }
        catch {
            // Best-effort — continue with what we have
        }
    }
    if (score === null) {
        await (0, sender_1.sendText)(patient.whatsappNumber, patient.language === "hi"
            ? "1 से 5 के बीच बताइए — 1 बहुत मुश्किल, 5 अच्छा। या अपनी बात बताइए।"
            : "Please tell me 1–5 (1 = very hard, 5 = good), or describe how you're feeling.");
        return;
    }
    const cycleDay = getCycleDay(patient.cycleStartDate, patient.currentCycle);
    // Store check-in
    const checkin = await client_1.prisma.checkin.create({
        data: {
            patientId: patient.id,
            score,
            symptoms,
            emotionalState,
            notes,
            cycleDay,
        },
    });
    // Evaluate thresholds — may create alerts
    await (0, thresholds_1.evaluateThresholds)(patient, checkin, score, symptoms, cycleDay);
    // Send response based on score
    await sendCheckinResponse(patient, score, symptoms, emotionalState, cycleDay);
    // Store system response in conversation
    await client_1.prisma.conversation.create({
        data: {
            patientId: patient.id,
            role: "system",
            messageType: "checkin",
            content: `Checkin recorded: score=${score}, symptoms=[${symptoms.join(",")}]`,
        },
    });
}
async function sendCheckinResponse(patient, score, symptoms, emotionalState, cycleDay) {
    const lang = patient.language;
    const name = patient.name.split(" ")[0];
    if (score === 1) {
        const msg = lang === "hi"
            ? `${name} जी, आपने बताया — शुक्रिया। 💙\n\nआज बहुत मुश्किल है। ये real है — इसे feel करना ज़रूरी नहीं कि आप कमज़ोर हैं।\n\n${getSymptomGuidance(symptoms, lang)}\n\nआपके caregiver को inform कर दिया है। आपको कुछ नहीं करना।\n\n4 घंटे में दोबारा पूछूँगा। 🙏`
            : `Thank you for telling me, ${name}. 💙\n\nToday is very hard. That's real — feeling this doesn't mean you are weak.\n\n${getSymptomGuidance(symptoms, lang)}\n\nYour caregiver has been notified. You don't need to do anything.\n\nI'll check back in 4 hours. 🙏`;
        await (0, sender_1.sendText)(patient.whatsappNumber, msg);
    }
    else if (score === 2) {
        const msg = lang === "hi"
            ? `${name} जी। 🙏\n\nमुश्किल है, पर आप handle कर रहे हैं — यही काफी है।\n\n${getSymptomGuidance(symptoms, lang)}\n\nबाद में और पूछूँगा।`
            : `${name}. 🙏\n\nIt's hard, but you are managing — that's enough for now.\n\n${getSymptomGuidance(symptoms, lang)}\n\nI'll check in again later.`;
        await (0, sender_1.sendText)(patient.whatsappNumber, msg);
    }
    else if (score === 3) {
        const msg = lang === "hi"
            ? `ठीक है — समझ आया। ${name} जी, okay होना भी एक जीत है।\n${symptoms.length > 0 ? `\n${getSymptomGuidance(symptoms, lang)}` : ""}\nकल और बेहतर हो। 💙`
            : `Okay — noted. ${name}, being okay is its own victory.\n${symptoms.length > 0 ? `\n${getSymptomGuidance(symptoms, lang)}` : ""}\nHere's to a better day tomorrow. 💙`;
        await (0, sender_1.sendText)(patient.whatsappNumber, msg);
    }
    else {
        const msg = lang === "hi"
            ? `${score === 5 ? "बढ़िया!" : "अच्छा!"} ${name} जी — ये सुनकर अच्छा लगा। 😊\nइस energy को बचाकर रखें। 💙`
            : `${score === 5 ? "Great!" : "Good to hear,"} ${name}! 😊\nSave that energy — you'll need it. 💙`;
        await (0, sender_1.sendText)(patient.whatsappNumber, msg);
    }
    // Additional emotional support if flagged
    if (emotionalState === "distressed" || emotionalState === "anxious") {
        await new Promise((r) => setTimeout(r, 2000));
        const supportMsg = lang === "hi"
            ? "अगर आप बात करना चाहते हैं — मन में जो भी है — बस लिखें। मैं यहाँ हूँ।"
            : "If you want to talk — whatever's on your mind — just write. I'm here.";
        await (0, sender_1.sendText)(patient.whatsappNumber, supportMsg);
    }
}
function getSymptomGuidance(symptoms, lang) {
    if (symptoms.length === 0)
        return "";
    const guidance = {
        nausea: {
            hi: "मतली के लिए: छोटे-छोटे घूंट पानी, नींबू पानी (बिना sugar), या adrak chai।",
            en: "For nausea: small sips of water, nimbu pani (no sugar), or ginger tea.",
        },
        vomiting: {
            hi: "उल्टी हो रही है तो थोड़ा-थोड़ा पानी पीते रहें। 6 घंटे से ज़्यादा रहे तो care team को call करें।",
            en: "Keep taking small sips of water. If vomiting continues for more than 6 hours, call your care team.",
        },
        fever: {
            hi: "⚠️ बुखार है? thermometer से check करें। 38°C से ऊपर है तो आज hospital जाएं।",
            en: "⚠️ Fever? Check with a thermometer. If above 38°C (100.4°F), go to hospital today.",
        },
        fatigue: {
            hi: "थकान के लिए: जितना हो सके आराम करें। खुद से 'होना चाहिए' का pressure मत लें।",
            en: "For fatigue: rest as much as you can. Don't pressure yourself with 'should be doing'.",
        },
    };
    for (const symptom of symptoms) {
        if (guidance[symptom]) {
            return guidance[symptom][lang] || guidance[symptom]["en"] || "";
        }
    }
    return "";
}
function getCycleDay(cycleStartDate, currentCycle) {
    const now = new Date();
    const diffMs = now.getTime() - new Date(cycleStartDate).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return (diffDays % 21) + 1;
}
//# sourceMappingURL=engine.js.map