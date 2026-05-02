import OpenAI from "openai";
import axios from "axios";
import { downloadMediaUrl } from "../webhook/sender";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LANGUAGE_TO_BCP47: Record<string, string> = {
  hi: "hi",
  mr: "mr",
  ta: "ta",
  en: "en",
};

export async function transcribeVoiceNote(
  mediaId: string,
  patientLanguage: string
): Promise<string | null> {
  try {
    // 1. Get the actual download URL from WhatsApp
    const mediaUrl = await downloadMediaUrl(mediaId);

    // 2. Download the audio buffer
    const response = await axios.get(mediaUrl, {
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
  } catch (err) {
    console.error("Whisper transcription failed:", err);
    return null;
  }
}
