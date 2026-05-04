import { Worker } from "bullmq";
import { redisConnection } from "./queue";
import { sendCheckinMessage } from "../modules/checkin/engine";
import { sendCaregiverMorningBrief, sendCaregiverWeeklyCheck } from "../modules/caregiver/track";
import { sendPreVisitBrief, sendAppointmentReminder } from "../modules/appointments/brief";
import { sendDoctorWeeklySignals } from "../modules/doctor/signal";
import { sendMedicationReminder } from "../modules/medications/context";
import type {
  CheckinJobData,
  AlertJobData,
  AppointmentReminderJobData,
  BriefJobData,
  InboxJobData,
} from "./queue";

// Stall-check interval for all workers: 5 minutes (default is 30s).
// This dramatically reduces Redis command consumption on free-tier Upstash.
// Trade-off: stalled jobs are detected up to 5 min later, which is fine for
// a clinical care app where jobs are short-lived (< 10s each).
const STALLED_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Inbox worker — drains the durable webhook inbox queue.
// Errors thrown here trigger BullMQ retry with exponential back-off.
export const inboxWorker = new Worker(
  "inbox",
  async (job) => {
    const data = job.data as InboxJobData;

    if (data.source === "whatsapp") {
      const { processWhatsAppPayload } = await import("../webhook/handler");
      await processWhatsAppPayload(data.payload);
    } else if (data.source === "telegram") {
      const { processTelegramUpdate } = await import("../telegram/handler");
      await processTelegramUpdate(data.payload);
    }
  },
  { connection: redisConnection, concurrency: 5, stalledInterval: STALLED_INTERVAL }
);

inboxWorker.on("failed", (job, err) => {
  console.error(`Inbox job ${job?.id} (${(job?.data as any)?.source}) failed:`, err.message);
});

// Check-in worker
export const checkinWorker = new Worker(
  "checkins",
  async (job) => {
    const data = job.data as CheckinJobData & { jobType?: string };
    switch (job.name) {
      case "morning-checkin":
      case "afternoon-checkin":
        await sendCheckinMessage(data.patientId, data.cycleDay, data.type);
        break;
      case "caregiver-morning-brief":
        await sendCaregiverMorningBrief(data.patientId);
        break;
      case "caregiver-weekly-check":
        await sendCaregiverWeeklyCheck(data.patientId);
        break;
      case "medication-reminder":
        await sendMedicationReminder(data.patientId);
        break;
    }
  },
  { connection: redisConnection, concurrency: 10, stalledInterval: STALLED_INTERVAL }
);

// Appointment worker
export const appointmentWorker = new Worker(
  "appointments",
  async (job) => {
    const data = job.data as AppointmentReminderJobData;
    if (data.reminderType === "prep_brief") {
      await sendPreVisitBrief(data.appointmentId, data.patientId);
    } else {
      await sendAppointmentReminder(
        data.appointmentId,
        data.patientId,
        data.reminderType as "48h" | "24h" | "2h" | "post_visit"
      );
    }
  },
  { connection: redisConnection, concurrency: 5, stalledInterval: STALLED_INTERVAL }
);

// Doctor signal worker (runs on cron)
export const doctorSignalWorker = new Worker(
  "doctor-signals",
  async () => {
    await sendDoctorWeeklySignals();
  },
  { connection: redisConnection, concurrency: 1, stalledInterval: STALLED_INTERVAL }
);

checkinWorker.on("failed", (job, err) => {
  console.error(`Check-in job ${job?.id} failed:`, err.message);
});

appointmentWorker.on("failed", (job, err) => {
  console.error(`Appointment job ${job?.id} failed:`, err.message);
});

doctorSignalWorker.on("failed", (job, err) => {
  console.error(`Doctor signal job ${job?.id} failed:`, err.message);
});

export function gracefulShutdown() {
  return Promise.all([
    inboxWorker.close(),
    checkinWorker.close(),
    appointmentWorker.close(),
    doctorSignalWorker.close(),
  ]);
}
