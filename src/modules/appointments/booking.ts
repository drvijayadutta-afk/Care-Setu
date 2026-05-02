import { prisma } from "../../db/client";
import { messagingRouter } from "../../messaging/router";
import { askClaudeJSON } from "../../integrations/claude";
import { INTENT_CLASSIFIER_PROMPT } from "../../ai/prompts";
import * as Practo from "../../integrations/practo";
import * as Apollo from "../../integrations/apollo";
import { appointmentQueue } from "../../jobs/queue";
import type { Patient } from "@prisma/client";

interface AppointmentIntent {
  type: "chemo" | "followup" | "scan" | "consultation";
  urgency: "routine" | "soon" | "today";
  preferredDoctor?: string;
  preferredDate?: string;
}

type AnySlot = { slotId: string; date: string; time: string; doctorName: string } & Record<string, any>;

// In-memory store for pending booking sessions (Redis in production)
const pendingBookings = new Map<
  string,
  { slots: AnySlot[]; intent: AppointmentIntent; provider: string }
>();

export async function handleAppointmentRequest(
  patient: Patient,
  text: string,
  preExtractedType?: string
) {
  // If patient is selecting a slot from a list (appt_slot_0, appt_slot_1, etc.)
  if (text.startsWith("appt_slot_")) {
    const slotIndex = parseInt(text.replace("appt_slot_", ""));
    await confirmBooking(patient, slotIndex);
    return;
  }

  if (text === "appt_different_date") {
    await messagingRouter.sendText(
      patient.id,
      patient.language === "hi"
        ? "Kaunsi date prefer karenge? (Jaise: '20 May' ya 'agle hafte')"
        : "What date would you prefer? (e.g., '20 May' or 'next week')"
    );
    return;
  }

  if (text === "appt_cancel") {
    pendingBookings.delete(patient.whatsappNumber);
    await messagingRouter.sendText(
      patient.id,
      patient.language === "hi"
        ? "Theek hai — appointment booking cancel kiya. Jab zarurat ho, bata dena."
        : "Okay — appointment booking cancelled. Let me know when you need it."
    );
    return;
  }

  // Extract appointment intent from text
  let intent: AppointmentIntent;
  try {
    const raw = await askClaudeJSON<any>(
      `Extract appointment booking intent from this message.
Return JSON: { "type": "chemo"|"followup"|"scan"|"consultation", "urgency": "routine"|"soon"|"today", "preferredDate": string|null }
Respond with JSON only.`,
      text,
      64
    );
    intent = {
      type: raw.type || preExtractedType || "followup",
      urgency: raw.urgency || "routine",
      preferredDate: raw.preferredDate,
    };
  } catch {
    intent = { type: (preExtractedType as any) || "followup", urgency: "routine" };
  }

  await fetchAndPresentSlots(patient, intent);
}

async function fetchAndPresentSlots(patient: Patient, intent: AppointmentIntent) {
  const lang = patient.language;

  await messagingRouter.sendText(
    patient.id,
    lang === "hi"
      ? "Ek second — available slots dhundh raha hun... 🔍"
      : "One moment — looking for available slots... 🔍"
  );

  // Look up doctor in DB
  const doctor = await prisma.doctor.findFirst({
    where: {
      OR: [
        { name: { contains: patient.doctorName, mode: "insensitive" } },
        { hospitalName: { contains: patient.hospitalName, mode: "insensitive" } },
      ],
    },
  });

  let slots: AnySlot[] = [];
  let provider = "manual";

  const dateFrom = getDateFrom(intent.urgency, intent.preferredDate);
  const dateTo = new Date(new Date(dateFrom).getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]!;

  try {
    if (doctor?.practoId) {
      slots = await Practo.getAvailableSlots(doctor.practoId, dateFrom, dateTo);
      provider = "practo";
    } else if (doctor?.apolloId) {
      slots = await Apollo.getAvailableSlots(doctor.apolloId, dateFrom);
      provider = "apollo";
    }
  } catch (err) {
    console.error("API slot fetch failed, falling back to manual:", err);
  }

  if (slots.length === 0) {
    // Fallback: create coordinator task and notify patient
    await createCoordinatorBookingTask(patient, intent);
    await messagingRouter.sendText(
      patient.id,
      lang === "hi"
        ? `${patient.doctorName} ke saath appointment book kar raha hun.\nHum 2 ghante mein confirm karenge. 📅\n\nAapko koi kuch nahi karna — hum batayenge.`
        : `Booking an appointment with ${patient.doctorName}.\nWe'll confirm within 2 hours. 📅\n\nYou don't need to do anything — we'll let you know.`
    );
    return;
  }

  // Present top 3 slots
  const topSlots = slots.slice(0, 3);
  pendingBookings.set(patient.whatsappNumber, { slots: topSlots, intent, provider });

  const rows = topSlots.map((slot, i) => ({
    id: `appt_slot_${i}`,
    title: formatSlotTitle(slot),
    description: slot.doctorName || patient.doctorName,
  }));

  rows.push({ id: "appt_different_date", title: "📅 Different date", description: "" });
  rows.push({ id: "appt_cancel", title: "❌ Cancel", description: "" });

  const bodyText =
    lang === "hi"
      ? `${patient.doctorName} ke saath available slots:\n(${patient.hospitalName})`
      : `Available slots with ${patient.doctorName}:\n(${patient.hospitalName})`;

  await messagingRouter.sendList(patient.id, bodyText, "Select a slot", [
    { title: "Available Times", rows },
  ]);
}

async function confirmBooking(patient: Patient, slotIndex: number) {
  const pending = pendingBookings.get(patient.whatsappNumber);
  if (!pending) {
    await messagingRouter.sendText(
      patient.id,
      patient.language === "hi"
        ? "Session expire ho gaya. Dobara try karein."
        : "Session expired. Please try again."
    );
    return;
  }

  const slot = pending.slots[slotIndex];
  if (!slot) {
    await messagingRouter.sendText(patient.id, "Invalid slot. Please try again.");
    return;
  }

  const lang = patient.language;

  await messagingRouter.sendText(
    patient.id,
    lang === "hi" ? "Book kar raha hun... ⏳" : "Booking your appointment... ⏳"
  );

  let bookingId: string | null = null;
  let practoBookingId: string | null = null;
  let apolloBookingId: string | null = null;

  try {
    if (pending.provider === "practo") {
      const result = await Practo.bookSlot(slot.slotId, {
        name: patient.name,
        phone: patient.whatsappNumber,
        cancerType: patient.cancerType,
      });
      practoBookingId = result.bookingId;
    } else if (pending.provider === "apollo") {
      const result = await Apollo.bookSlot(slot.slotId, {
        name: patient.name,
        phone: patient.whatsappNumber,
        cancerType: patient.cancerType,
      });
      apolloBookingId = result.bookingId;
    }
  } catch (err) {
    console.error("Booking API failed:", err);
    await createCoordinatorBookingTask(patient, pending.intent, slot);
    await messagingRouter.sendText(
      patient.id,
      lang === "hi"
        ? "Booking confirm ho rahi hai — thodi der mein update milega. 📅"
        : "Booking is being confirmed — you'll get an update shortly. 📅"
    );
    pendingBookings.delete(patient.whatsappNumber);
    return;
  }

  // Parse appointment datetime from slot
  const scheduledAt = new Date(`${slot.date}T${slot.time || "09:00"}:00`);

  // Store appointment
  const appointment = await prisma.appointment.create({
    data: {
      patientId: patient.id,
      doctorName: slot.doctorName || patient.doctorName,
      hospitalName: patient.hospitalName,
      type: pending.intent.type,
      scheduledAt,
      status: "confirmed",
      practoBookingId,
      apolloBookingId,
    },
  });

  pendingBookings.delete(patient.whatsappNumber);

  // Notify patient
  const confirmMsg =
    lang === "hi"
      ? `✅ Appointment confirm ho gaya!\n\n👨‍⚕️ ${slot.doctorName || patient.doctorName}\n🏥 ${patient.hospitalName}\n📅 ${formatAppointmentDate(scheduledAt)}\n\nMaine note kar liya. Reminders milenge:\n• Kal (48 ghante pehle)\n• Din par (24 ghante pehle)\n• 2 ghante pehle\n\nAapke caregiver ko bhi bata diya. 💙`
      : `✅ Appointment confirmed!\n\n👨‍⚕️ ${slot.doctorName || patient.doctorName}\n🏥 ${patient.hospitalName}\n📅 ${formatAppointmentDate(scheduledAt)}\n\nI've noted this. You'll get reminders:\n• Tomorrow (48 hours before)\n• Day of (24 hours before)\n• 2 hours before\n\nYour caregiver has been notified too. 💙`;

  await messagingRouter.sendText(patient.id, confirmMsg);

  // Notify caregiver
  const caregiver = await prisma.caregiver.findUnique({ where: { patientId: patient.id } });
  if (caregiver?.isEnrolled) {
    await messagingRouter.sendText(
      caregiver.whatsappNumber,
      `📅 ${patient.name} ka appointment book ho gaya:\n${slot.doctorName || patient.doctorName} — ${patient.hospitalName}\n${formatAppointmentDate(scheduledAt)}`,
      true
    );
  }

  // Schedule reminders
  await scheduleAppointmentReminders(appointment.id, patient.id, scheduledAt);
}

async function scheduleAppointmentReminders(
  appointmentId: string,
  patientId: string,
  scheduledAt: Date
) {
  const now = Date.now();
  const apptTime = scheduledAt.getTime();

  const reminders: Array<{ type: string; delay: number }> = [
    { type: "48h", delay: apptTime - 48 * 60 * 60 * 1000 - now },
    { type: "24h", delay: apptTime - 24 * 60 * 60 * 1000 - now },
    { type: "prep_brief", delay: apptTime - 24 * 60 * 60 * 1000 - now - 60000 }, // 1 min before 24h reminder
    { type: "2h", delay: apptTime - 2 * 60 * 60 * 1000 - now },
    { type: "post_visit", delay: apptTime + 3 * 60 * 60 * 1000 - now },
  ];

  for (const reminder of reminders) {
    if (reminder.delay > 0) {
      await appointmentQueue.add(
        `reminder-${reminder.type}`,
        { appointmentId, patientId, reminderType: reminder.type },
        { delay: reminder.delay }
      );
    }
  }
}

async function createCoordinatorBookingTask(
  patient: Patient,
  intent: AppointmentIntent,
  preferredSlot?: any
) {
  await prisma.coordinatorTask.create({
    data: {
      patientId: patient.id,
      type: "appointment_booking",
      description: `Book ${intent.type} appointment for ${patient.name} with ${patient.doctorName} at ${patient.hospitalName}`,
      context: JSON.parse(JSON.stringify({ intent, preferredSlot, urgency: intent.urgency })),
      priority: intent.urgency === "today" ? "urgent" : "normal",
    },
  });

  // Alert coordinator
  if (process.env.COORDINATOR_WHATSAPP_NUMBER) {
    await messagingRouter.sendText(
      process.env.COORDINATOR_WHATSAPP_NUMBER,
      `📋 BOOKING TASK\nPatient: ${patient.name} (${patient.whatsappNumber})\nDoctor: ${patient.doctorName} @ ${patient.hospitalName}\nType: ${intent.type} | Urgency: ${intent.urgency}\n\nPlease call to book and update system.`,
      true
    );
  }
}

function getDateFrom(urgency: string, preferredDate?: string): string {
  if (preferredDate) {
    const parsed = new Date(preferredDate);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0]!;
  }

  const offset = urgency === "today" ? 0 : urgency === "soon" ? 2 : 5;
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0]!;
}

function formatSlotTitle(slot: AnySlot): string {
  const date = new Date(slot.date);
  const options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  return `${date.toLocaleDateString("en-IN", options)} — ${slot.time}`;
}

function formatAppointmentDate(date: Date): string {
  return date.toLocaleString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
