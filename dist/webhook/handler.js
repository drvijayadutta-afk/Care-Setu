"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebhookVerification = handleWebhookVerification;
exports.handleWebhookMessage = handleWebhookMessage;
const client_1 = require("../db/client");
const sender_1 = require("./sender");
const intents_1 = require("../ai/intents");
const engine_1 = require("../modules/checkin/engine");
const booking_1 = require("../modules/appointments/booking");
const support_1 = require("../modules/emotional/support");
const flow_1 = require("../modules/onboarding/flow");
const track_1 = require("../modules/caregiver/track");
const context_1 = require("../modules/medications/context");
const whisper_1 = require("../integrations/whisper");
async function handleWebhookVerification(request, reply) {
    const query = request.query;
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];
    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        return reply.send(challenge);
    }
    return reply.status(403).send("Forbidden");
}
async function handleWebhookMessage(request, reply) {
    // Always ack immediately to prevent WhatsApp retries
    reply.status(200).send("OK");
    const body = request.body;
    if (body?.object !== "whatsapp_business_account")
        return;
    for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
            if (change.field !== "messages")
                continue;
            const value = change.value;
            for (const message of value?.messages || []) {
                await processMessage(message, value?.metadata?.phone_number_id).catch((err) => console.error("Error processing message:", err));
            }
        }
    }
}
async function processMessage(message, phoneNumberId) {
    const from = message.from;
    const messageId = message.id;
    await (0, sender_1.markRead)(messageId).catch(() => { });
    // Check if sender is a caregiver
    const caregiver = await client_1.prisma.caregiver.findUnique({
        where: { whatsappNumber: from },
        include: { patient: true },
    });
    if (caregiver?.isEnrolled) {
        const text = extractText(message);
        await (0, track_1.handleCaregiverMessage)(caregiver, text || "", message);
        return;
    }
    // Find or handle new patient
    let patient = await client_1.prisma.patient.findUnique({ where: { whatsappNumber: from } });
    // New patient — start onboarding
    if (!patient) {
        await (0, flow_1.handleOnboarding)(from, null, extractText(message) || "");
        return;
    }
    // Patient mid-onboarding
    if (patient.onboardingStep < 9) {
        await (0, flow_1.handleOnboarding)(from, patient, extractText(message) || "");
        return;
    }
    // Get message text (handle voice notes)
    let text = extractText(message);
    let isVoiceNote = false;
    if (message.type === "audio" && message.audio) {
        isVoiceNote = true;
        text = await (0, whisper_1.transcribeVoiceNote)(message.audio.id, patient.language).catch(() => null);
        if (!text)
            return;
    }
    // Store conversation
    await client_1.prisma.conversation.create({
        data: {
            patientId: patient.id,
            role: "patient",
            messageType: isVoiceNote ? "voice" : message.interactive ? "interactive" : "text",
            content: text || "",
            isNightMode: isNightHours(),
        },
    });
    // Handle interactive button/list responses
    if (message.interactive) {
        const replyId = message.interactive.button_reply?.id ||
            message.interactive.list_reply?.id;
        const replyTitle = message.interactive.button_reply?.title ||
            message.interactive.list_reply?.title;
        if (replyId?.startsWith("checkin_")) {
            await (0, engine_1.handleCheckinResponse)(patient, replyId, replyTitle || "");
            return;
        }
        if (replyId?.startsWith("appt_")) {
            await (0, booking_1.handleAppointmentRequest)(patient, replyId, replyTitle || "");
            return;
        }
        text = replyTitle || replyId || text;
    }
    if (!text)
        return;
    // Classify intent
    const recentMessages = await client_1.prisma.conversation.findMany({
        where: { patientId: patient.id },
        orderBy: { createdAt: "desc" },
        take: 3,
    });
    const cycleDay = getCycleDay(patient.cycleStartDate, patient.currentCycle);
    const intent = await (0, intents_1.classifyIntent)(text, recentMessages.map((m) => ({ role: m.role, content: m.content })), patient, cycleDay, isNightHours());
    // Route to appropriate handler
    switch (intent.intent) {
        case "checkin_response":
            await (0, engine_1.handleCheckinResponse)(patient, text, intent.extractedScore);
            break;
        case "appointment_request":
            await (0, booking_1.handleAppointmentRequest)(patient, text, intent.appointmentType);
            break;
        case "emotional_support":
        case "unknown":
            await (0, support_1.handleEmotionalSupport)(patient, text, isNightHours(), recentMessages);
            break;
        case "medication_query":
            await (0, context_1.handleMedicationQuery)(patient, text);
            break;
        case "symptom_report":
            await (0, engine_1.handleCheckinResponse)(patient, text, undefined, true);
            break;
        default:
            await (0, support_1.handleEmotionalSupport)(patient, text, isNightHours(), recentMessages);
    }
}
function extractText(message) {
    if (message.text?.body)
        return message.text.body;
    if (message.interactive?.button_reply?.title)
        return message.interactive.button_reply.title;
    if (message.interactive?.list_reply?.title)
        return message.interactive.list_reply.title;
    return null;
}
function isNightHours() {
    const hour = new Date().getHours();
    return hour >= 22 || hour < 6;
}
function getCycleDay(cycleStartDate, currentCycle) {
    const now = new Date();
    const diffMs = now.getTime() - new Date(cycleStartDate).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return (diffDays % 21) + 1; // assume 21-day cycles
}
//# sourceMappingURL=handler.js.map