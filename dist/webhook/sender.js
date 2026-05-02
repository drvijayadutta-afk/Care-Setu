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
// ─── Channel Detection ────────────────────────────────────────────────────────
// If TELEGRAM_BOT_TOKEN is set, use Telegram. Otherwise use WhatsApp.
const IS_TELEGRAM = !!process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// WhatsApp config
const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WA_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const IS_AISENSY = API_VERSION === "aisensy";
// ─── Telegram Helpers ─────────────────────────────────────────────────────────
const tg = () => `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
async function tgSendText(chatId, text) {
    const { data } = await axios_1.default.post(`${tg()}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
    });
    return data?.result?.message_id?.toString() ?? null;
}
async function tgSendButtons(chatId, text, buttons) {
    const { data } = await axios_1.default.post(`${tg()}/sendMessage`, {
        chat_id: chatId,
        text,
        reply_markup: {
            inline_keyboard: [buttons.map((b) => ({ text: b.title, callback_data: b.id }))],
        },
    });
    return data?.result?.message_id?.toString() ?? null;
}
async function tgSendList(chatId, text, sections) {
    const keyboard = sections.flatMap((s) => s.rows.map((r) => [{ text: `${r.title}${r.description ? ` — ${r.description}` : ""}`, callback_data: r.id }]));
    const { data } = await axios_1.default.post(`${tg()}/sendMessage`, {
        chat_id: chatId,
        text,
        reply_markup: { inline_keyboard: keyboard },
    });
    return data?.result?.message_id?.toString() ?? null;
}
// ─── WhatsApp Helpers ─────────────────────────────────────────────────────────
const wa = !IS_AISENSY
    ? axios_1.default.create({
        baseURL: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
        headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    })
    : axios_1.default.create({
        baseURL: "https://app.aisensy.com/api/v1",
        headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    });
// ─── Universal Exports (used by all modules) ──────────────────────────────────
async function sendText(to, body) {
    if (IS_TELEGRAM)
        return tgSendText(to, body);
    if (IS_AISENSY) {
        const { data } = await wa.post("/send-message", { phoneNumber: to, message: body });
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
    if (IS_TELEGRAM)
        return tgSendButtons(to, body, buttons);
    const { data } = await wa.post("", {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
            type: "button",
            body: { text: body },
            action: { buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })) },
        },
    });
    return data?.messages?.[0]?.id ?? null;
}
async function sendListMessage(to, body, buttonLabel, sections) {
    if (IS_TELEGRAM)
        return tgSendList(to, body, sections);
    const { data } = await wa.post("", {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
            type: "list",
            body: { text: body },
            action: { button: buttonLabel, sections },
        },
    });
    return data?.messages?.[0]?.id ?? null;
}
async function sendTemplate(to, templateName, languageCode, components) {
    if (IS_TELEGRAM) {
        // Telegram has no templates — send plain text
        return tgSendText(to, `[Template: ${templateName}]`);
    }
    const { data } = await wa.post("", {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: templateName, language: { code: languageCode }, components },
    });
    return data?.messages?.[0]?.id ?? null;
}
async function markRead(messageId) {
    if (IS_TELEGRAM)
        return; // Telegram handles read status automatically
    if (IS_AISENSY)
        return;
    await wa.post("", { messaging_product: "whatsapp", status: "read", message_id: messageId });
}
async function downloadMediaUrl(mediaId) {
    if (IS_TELEGRAM) {
        // Get Telegram file URL
        const { data } = await axios_1.default.get(`${tg()}/getFile?file_id=${mediaId}`);
        const filePath = data?.result?.file_path;
        return `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
    }
    if (IS_AISENSY)
        throw new Error("Aisensy media download not implemented");
    const { data } = await axios_1.default.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${WA_TOKEN}` },
    });
    return data.url;
}
//# sourceMappingURL=sender.js.map