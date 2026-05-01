"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribeVoiceNote = transcribeVoiceNote;
const openai_1 = __importDefault(require("openai"));
const axios_1 = __importDefault(require("axios"));
const sender_1 = require("../webhook/sender");
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
const LANGUAGE_TO_BCP47 = {
    hi: "hi",
    mr: "mr",
    ta: "ta",
    en: "en",
};
async function transcribeVoiceNote(mediaId, patientLanguage) {
    try {
        // 1. Get the actual download URL from WhatsApp
        const mediaUrl = await (0, sender_1.downloadMediaUrl)(mediaId);
        // 2. Download the audio buffer
        const response = await axios_1.default.get(mediaUrl, {
            responseType: "arraybuffer",
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            },
        });
        // 3. Create a File object from the buffer (Whisper expects a file)
        const audioBuffer = Buffer.from(response.data);
        const file = new File([audioBuffer], "voice.ogg", { type: "audio/ogg" });
        // 4. Transcribe with language hint
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
//# sourceMappingURL=whisper.js.map