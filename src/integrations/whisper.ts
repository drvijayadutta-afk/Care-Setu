import OpenAI from "openai";
import axios from "axios";
import { TelegramApi } from "./telegram-api";
import { getWhatsAppChannel, getTelegramChannel } from "../messaging/router";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LANGUAGE_TO_BCP47: Record<string, string> = {
  hi: "hi",
  mr: "mr",
  ta: "ta",
  en: "en",
};

export async function transcribeVoiceNote(
  mediaId: string,
  patientLanguage: string,
  platform: "whatsapp" | "telegram" = "whatsapp"
): Promise<string | null> {
  try {
    let audioBuffer: Buffer;

    if (platform === "telegram") {
      // Download from Telegram using file_id
      audioBuffer = await downloadFromTelegram(mediaId);
    } else {
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
  } catch (err) {
    console.error("Whisper transcription failed:", err);
    return null;
  }
}

async function downloadFromWhatsApp(mediaId: string): Promise<Buffer> {
  const whatsapp = getWhatsAppChannel();
  const mediaUrl = await whatsapp.downloadMediaUrl!(mediaId);

  const response = await axios.get(mediaUrl, {
    responseType: "arraybuffer",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    },
  });

  return Buffer.from(response.data);
}

async function downloadFromTelegram(fileId: string): Promise<Buffer> {
  const telegram = new TelegramApi(process.env.TELEGRAM_BOT_TOKEN!);
  const fileInfo = await telegram.getFile(fileId);
  const filePath = fileInfo.file_path;

  const response = await axios.get(
    `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`,
    { responseType: "arraybuffer" }
  );

  return Buffer.from(response.data);
}
