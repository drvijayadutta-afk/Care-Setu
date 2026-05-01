"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendText = sendText;
exports.sendButtonMessage = sendButtonMessage;
exports.sendListMessage = sendListMessage;
exports.sendTemplate = sendTemplate;
exports.markRead = markRead;
exports.downloadMediaUrl = downloadMediaUrl;
const axios_1 = __importDefault(require("axios"));
const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const IS_AISENSY = API_VERSION === "aisensy";
const wa = !IS_AISENSY
    ? axios_1.default.create({
        baseURL: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
        },
    })
    : axios_1.default.create({
        baseURL: "https://app.aisensy.com/api/v1",
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
        },
    });
async function sendText(to, body) {
    if (IS_AISENSY) {
        const { data } = await wa.post("/send-message", {
            phoneNumber: to,
            message: body,
        });
        return data?.messageId ?? data?.id ?? null;
    }
    const { data } = await wa.post("", {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body, preview_url: false },
    });
    return data?.messages?.[0]?.id ?? null;
}
async function sendButtonMessage(to, body, buttons) {
    const { data } = await wa.post("", {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
            type: "button",
            body: { text: body },
            action: {
                buttons: buttons.map((b) => ({
                    type: "reply",
                    reply: { id: b.id, title: b.title },
                })),
            },
        },
    });
    return data?.messages?.[0]?.id ?? null;
}
async function sendListMessage(to, body, buttonLabel, sections) {
    const { data } = await wa.post("", {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
            type: "list",
            body: { text: body },
            action: {
                button: buttonLabel,
                sections,
            },
        },
    });
    return data?.messages?.[0]?.id ?? null;
}
async function sendTemplate(to, templateName, languageCode, components) {
    const { data } = await wa.post("", {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
            name: templateName,
            language: { code: languageCode },
            components,
        },
    });
    return data?.messages?.[0]?.id ?? null;
}
async function markRead(messageId) {
    if (IS_AISENSY)
        return; // Aisensy handles read status automatically
    await wa.post("", {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
    });
}
async function downloadMediaUrl(mediaId) {
    if (IS_AISENSY)
        throw new Error("Aisensy media download not yet implemented");
    const { data } = await axios_1.default.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
    });
    return data.url;
}
//# sourceMappingURL=sender.js.map