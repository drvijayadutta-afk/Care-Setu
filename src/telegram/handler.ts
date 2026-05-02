import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../db/client";
import { markRead } from "./sender";
import { classifyIntent } from "../ai/intents";
import { handleCheckinResponse } from "../modules/checkin/engine";
import { handleAppointmentRequest } from "../modules/appointments/booking";
import { handleEmotionalSupport } from "../modules/emotional/support";
import { handleOnboarding } from "../modules/onboarding/flow";
import { handleCaregiverMessage } from "../modules/caregiver/track";
import { handleMedicationQuery } from "../modules/medications/context";

// Convert Telegram update to internal message format
interface InternalMessage {
  id: string;
  from: string; // chat_id as string
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
  reply.status(200).send("OK");

  const body = request.body as any;
  console.log("📨 Telegram update received:", JSON.stringify(body).slice(0, 200));

  try {
    // Handle regular messages
    if (body?.message) {
      const msg = body.message;
      const chatId = msg.chat.id.toString();
      console.log(`💬 Message from chatId: ${chatId}, text: ${msg.text}`);

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
        // Unsupported message type — skip
        return;
      }

      await processMessage(internal);
    }

    // Handle button clicks (callback queries)
    if (body?.callback_query) {
      const cb = body.callback_query;
      const chatId = cb.message.chat.id.toString();

      const internal: InternalMessage = {
        id: cb.id,
        from: chatId,
        timestamp: new Date().toISOString(),
        type: "interactive",
        interactive: {
          type: "button_reply",
          button_reply: {
            id: cb.data,
            title: cb.data,
          },
        },
      };

      await processMessage(internal);
    }
  } catch (err) {
    console.error("Telegram webhook error:", err);
  }
}

async function processMessage(message: InternalMessage) {
  const from = message.from; // Telegram chat_id

  // Check if sender is a caregiver
  const caregiver = await prisma.caregiver.findUnique({
    where: { whatsappNumber: from }, // reusing whatsappNumber field for Telegram chat_id
    include: { patient: true },
  });

  if (caregiver?.isEnrolled) {
    const text = extractText(message);
    await handleCaregiverMessage(caregiver, text || "", message as any);
    return;
  }

  // Find or handle new patient
  let patient = await prisma.patient.findUnique({
    where: { whatsappNumber: from }, // reusing whatsappNumber field for Telegram chat_id
  });

  // New patient — start onboarding
  if (!patient) {
    await handleOnboarding(from, null, extractText(message) || "");
    return;
  }

  // Patient mid-onboarding
  if (patient.onboardingStep < 9) {
    await handleOnboarding(from, patient, extractText(message) || "");
    return;
  }

  // Get message text
  let text = extractText(message);

  // Store conversation
  await prisma.conversation.create({
    data: {
      patientId: patient.id,
      role: "patient",
      messageType: message.interactive ? "interactive" : "text",
      content: text || "",
      isNightMode: isNightHours(),
    },
  });

  // Handle interactive button responses
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

  // Route to handler
  switch (intent.intent) {
    case "checkin_response":
      await handleCheckinResponse(patient, text, intent.extractedScore);
      break;
    case "appointment_request":
      await handleAppointmentRequest(patient, text, intent.appointmentType);
      break;
    case "medication_query":
      await handleMedicationQuery(patient, text);
      break;
    case "symptom_report":
      await handleCheckinResponse(patient, text, undefined, true);
      break;
    case "emotional_support":
    case "unknown":
    default:
      await handleEmotionalSupport(patient, text, isNightHours(), recentMessages);
      break;
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
