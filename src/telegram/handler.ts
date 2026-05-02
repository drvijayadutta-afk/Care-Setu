import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../db/client";
import { sendText, sendButtonMessage, markRead } from "../webhook/sender";
import { classifyIntent } from "../ai/intents";
import { handleCheckinResponse } from "../modules/checkin/engine";
import { handleAppointmentRequest } from "../modules/appointments/booking";
import { handleEmotionalSupport } from "../modules/emotional/support";
import { handleOnboarding } from "../modules/onboarding/flow";
import { handleCaregiverMessage } from "../modules/caregiver/track";
import { handleMedicationQuery } from "../modules/medications/context";

interface InternalMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  audio?: { id: string; mime_type: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
  };
}

export async function handleTelegramWebhook(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Always reply 200 immediately so Telegram doesn't retry
  reply.status(200).send("OK");

  const body = request.body as any;
  console.log("📨 Telegram update:", JSON.stringify(body).slice(0, 300));

  try {
    // Regular text/voice message
    if (body?.message) {
      const msg = body.message;
      const chatId = msg.chat.id.toString();
      console.log(`💬 From: ${chatId} | Text: ${msg.text}`);

      let internal: InternalMessage = {
        id: msg.message_id.toString(),
        from: chatId,
        timestamp: new Date(msg.date * 1000).toISOString(),
        type: "text",
      };

      if (msg.text) {
        internal.type = "text";
        internal.text = { body: msg.text };
      } else if (msg.voice || msg.audio) {
        const audio = msg.voice || msg.audio;
        internal.type = "audio";
        internal.audio = { id: audio.file_id, mime_type: audio.mime_type || "audio/ogg" };
      } else {
        console.log("⏭️ Unsupported message type, skipping");
        return;
      }

      try {
        await processMessage(internal);
      } catch (err: any) {
        console.error("❌ processMessage failed:", err?.message || err);
        // Fallback reply so user is never left hanging
        await sendText(chatId,
          "🙏 *Welcome to Care Setu!*\n\nI'm your cancer care companion. Please send \"Hello\" to begin your registration."
        ).catch((e) => console.error("Fallback send failed:", e));
      }
    }

    // Button click (callback query)
    if (body?.callback_query) {
      const cb = body.callback_query;
      const chatId = cb.message.chat.id.toString();
      console.log(`🔘 Button click from: ${chatId} | Data: ${cb.data}`);

      const internal: InternalMessage = {
        id: cb.id,
        from: chatId,
        timestamp: new Date().toISOString(),
        type: "interactive",
        interactive: {
          type: "button_reply",
          button_reply: { id: cb.data, title: cb.data },
        },
      };

      try {
        await processMessage(internal);
      } catch (err: any) {
        console.error("❌ processMessage (callback) failed:", err?.message || err);
      }
    }
  } catch (err: any) {
    console.error("❌ Telegram webhook outer error:", err?.message || err);
  }
}

async function processMessage(message: InternalMessage) {
  const from = message.from;
  const messageId = message.id;

  await markRead(messageId).catch(() => {}); // no-op for Telegram

  // Check if sender is a caregiver
  const caregiver = await prisma.caregiver.findUnique({
    where: { whatsappNumber: from },
    include: { patient: true },
  }).catch(() => null);

  if (caregiver?.isEnrolled) {
    const text = extractText(message);
    await handleCaregiverMessage(caregiver, text || "", message as any);
    return;
  }

  // Find or handle new patient
  let patient = await prisma.patient.findUnique({
    where: { whatsappNumber: from },
  }).catch(() => null);

  // New patient — start onboarding
  if (!patient) {
    console.log(`🆕 New user ${from} — starting onboarding`);
    await handleOnboarding(from, null, extractText(message) || "");
    return;
  }

  // Patient mid-onboarding
  if (patient.onboardingStep < 9) {
    console.log(`🔄 User ${from} onboarding step ${patient.onboardingStep}`);
    await handleOnboarding(from, patient, extractText(message) || "");
    return;
  }

  // Get message text
  let text = extractText(message);
  let isVoiceNote = false;

  if (message.type === "audio" && message.audio) {
    isVoiceNote = true;
    const { transcribeVoiceNote } = await import("../integrations/whisper");
    text = await transcribeVoiceNote(message.audio.id, patient.language).catch(() => null);
    if (!text) return;
  }

  // Store conversation
  await prisma.conversation.create({
    data: {
      patientId: patient.id,
      role: "patient",
      messageType: isVoiceNote ? "voice" : message.interactive ? "interactive" : "text",
      content: text || "",
      isNightMode: isNightHours(),
    },
  });

  // Handle button responses
  if (message.interactive) {
    const replyId = message.interactive.button_reply?.id;
    const replyTitle = message.interactive.button_reply?.title;
    if (replyId?.startsWith("checkin_")) {
      await handleCheckinResponse(patient, replyId, replyTitle || "");
      return;
    }
    if (replyId?.startsWith("appt_")) {
      await handleAppointmentRequest(patient, replyId, replyTitle || "");
      return;
    }
    text = replyTitle || replyId || text;
  }

  if (!text) return;

  // Classify intent
  const recentMessages = await prisma.conversation.findMany({
    where: { patientId: patient.id },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  const cycleDay = getCycleDay(patient.cycleStartDate, patient.currentCycle);
  const intent = await classifyIntent(
    text,
    recentMessages.map((m) => ({ role: m.role, content: m.content })),
    patient,
    cycleDay,
    isNightHours()
  );

  console.log(`🧠 Intent: ${intent.intent} for user ${from}`);

  switch (intent.intent) {
    case "checkin_response":
      await handleCheckinResponse(patient, text, intent.extractedScore); break;
    case "appointment_request":
      await handleAppointmentRequest(patient, text, intent.appointmentType); break;
    case "medication_query":
      await handleMedicationQuery(patient, text); break;
    case "symptom_report":
      await handleCheckinResponse(patient, text, undefined, true); break;
    case "emotional_support":
    case "unknown":
    default:
      await handleEmotionalSupport(patient, text, isNightHours(), recentMessages); break;
  }
}

function extractText(message: InternalMessage): string | null {
  if (message.text?.body) return message.text.body;
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title;
  return null;
}

function isNightHours(): boolean {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 6;
}

function getCycleDay(cycleStartDate: Date, currentCycle: number): number {
  const now = new Date();
  const diffMs = now.getTime() - new Date(cycleStartDate).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return (diffDays % 21) + 1;
}
