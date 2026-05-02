"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribeVoiceNote = transcribeVoiceNote;
const openai_1 = __importDefault(require("openai"));
const axios_1 = __importDefault(require("axios"));
const telegram_api_1 = require("./telegram-api");
const router_1 = require("../messaging/router");
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
const LANGUAGE_TO_BCP47 = {
    hi: "hi",
    mr: "mr",
    ta: "ta",
    en: "en",
};
async function transcribeVoiceNote(mediaId, patientLanguage, platform = "whatsapp") {
    try {
        let audioBuffer;
        if (platform === "telegram") {
            // Download from Telegram using file_id
            audioBuffer = await downloadFromTelegram(mediaId);
        }
        else {
            // Download from WhatsApp using media ID
            audioBuffer = await downloadFromWhatsApp(mediaId);
        }
        // Create a File object from the buffer (Whisper expects a file)
        const file = new File([new Uint8Array(audioBuffer)], "voice.ogg", { type: "audio/ogg" });
        // Transcribe with language hint
        const transcript = await openai.audio.transcriptions.create({
            model: "whisper-1",
            file,
            language: LANGUAGE_TO_BCP47[patientLanguage] || "hi",
        });
        return transcript.text || null;
    }
    catch (err) {
        console.error("Whisper transcription failed:", err);
        return null;
    }
}
async function downloadFromWhatsApp(mediaId) {
    const whatsapp = (0, router_1.getWhatsAppChannel)();
    const mediaUrl = await whatsapp.downloadMediaUrl(mediaId);
    const response = await axios_1.default.get(mediaUrl, {
        responseType: "arraybuffer",
        headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        },
    });
    return Buffer.from(response.data);
}
async function downloadFromTelegram(fileId) {
    const telegram = new telegram_api_1.TelegramApi(process.env.TELEGRAM_BOT_TOKEN);
    const fileInfo = await telegram.getFile(fileId);
    const filePath = fileInfo.file_path;
    const response = await axios_1.default.get(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`, { responseType: "arraybuffer" });
    return Buffer.from(response.data);
}
//# sourceMappingURL=whisper.js.map