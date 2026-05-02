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
} from "./queue";

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
  { connection: redisConnection, concurrency: 10 }
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
  { connection: redisConnection, concurrency: 5 }
);

// Doctor signal worker (runs on cron)
export const doctorSignalWorker = new Worker(
  "doctor-signals",
  async () => {
    await sendDoctorWeeklySignals();
  },
  { connection: redisConnection, concurrency: 1 }
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
    checkinWorker.close(),
    appointmentWorker.close(),
    doctorSignalWorker.close(),
  ]);
}
