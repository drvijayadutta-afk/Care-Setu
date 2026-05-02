import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../db/client";
import { getWhatsAppChannel } from "../messaging/router";
import { classifyIntent } from "../ai/intents";
import { handleCheckinResponse } from "../modules/checkin/engine";
import { handleAppointmentRequest } from "../modules/appointments/booking";
import { handleEmotionalSupport } from "../modules/emotional/support";
import { handleOnboarding } from "../modules/onboarding/flow";
import { handleCaregiverMessage } from "../modules/caregiver/track";
import { handleMedicationQuery } from "../modules/medications/context";
import { transcribeVoiceNote } from "../integrations/whisper";

interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  audio?: { id: string; mime_type: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
}

export async function handleWebhookVerification(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const query = request.query as any;
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return reply.send(challenge);
  }
  return reply.status(403).send("Forbidden");
}

export async function handleWebhookMessage(
  request: FastifyRequest,
  reply: FastifyReply
) {
  reply.status(200).send("OK");

  const body = request.body as any;

  // Aisensy format
  if (body?.phoneNumber && body?.message) {
    const message: WhatsAppMessage = {
      id: body.messageId || body.id || `aisensy_${Date.now()}`,
      from: body.phoneNumber,
      timestamp: body.timestamp || new Date().toISOString(),
      type: "text",
      text: { body: body.message },
    };
    await processMessage(message, "aisensy").catch(
      (err) => console.error("Error processing message:", err)
    );
    return;
  }

  // Meta WhatsApp Cloud API format
  if (body?.object !== "whatsapp_business_account") return;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;
      const value = change.value;

      for (const message of value?.messages || []) {
        await processMessage(message, value?.metadata?.phone_number_id).catch(
          (err) => console.error("Error processing message:", err)
        );
      }
    }
  }
}

export async function processMessage(message: WhatsAppMessage, phoneNumberId: string) {
  const from = message.from;
  const messageId = message.id;

  const whatsapp = getWhatsAppChannel();
  await whatsapp.markRead?.(messageId).catch(() => {});

  // Check if sender is a caregiver
  const caregiver = await prisma.caregiver.findUnique({
    where: { whatsappNumber: from },
    include: { patient: true },
  });

  if (caregiver?.isEnrolled) {
    const text = extractText(message);
    await handleCaregiverMessage(caregiver, text || "", message);
    return;
  }

  // Find or handle new patient
  let patient = await prisma.patient.findUnique({ where: { whatsappNumber: from } });

  // New patient — start onboarding
  if (!patient) {
    await handleOnboarding({ whatsappNumber: from }, null, extractText(message) || "");
    return;
  }

  // Patient mid-onboarding
  if (patient.onboardingStep < 9) {
    await handleOnboarding({ whatsappNumber: from }, patient, extractText(message) || "");
    return;
  }

  // Get message text (handle voice notes)
  let text = extractText(message);
  let isVoiceNote = false;

  if (message.type === "audio" && message.audio) {
    isVoiceNote = true;
    text = await transcribeVoiceNote(message.audio.id, patient.language).catch(
      () => null
    );
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

  // Handle interactive button/list responses
  if (message.interactive) {
    const replyId =
      message.interactive.button_reply?.id ||
      message.interactive.list_reply?.id;
    const replyTitle =
      message.interactive.button_reply?.title ||
      message.interactive.list_reply?.title;

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

  // Route to appropriate handler
  switch (intent.intent) {
    case "checkin_response":
      await handleCheckinResponse(patient, text, intent.extractedScore);
      break;
    case "appointment_request":
      await handleAppointmentRequest(patient, text, intent.appointmentType);
      break;
    case "emotional_support":
    case "unknown":
      await handleEmotionalSupport(patient, text, isNightHours(), recentMessages);
      break;
    case "medication_query":
      await handleMedicationQuery(patient, text);
      break;
    case "symptom_report":
      await handleCheckinResponse(patient, text, undefined, true);
      break;
    default:
      await handleEmotionalSupport(patient, text, isNightHours(), recentMessages);
  }
}

function extractText(message: WhatsAppMessage): string | null {
  if (message.text?.body) return message.text.body;
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title;
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title;
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
  return (diffDays % 21) + 1; // assume 21-day cycles
}
