import { Queue, Worker, QueueEvents } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

// Queue definitions
export const checkinQueue = new Queue("checkins", { connection: redisConnection });
export const messageQueue = new Queue("messages", { connection: redisConnection });
export const alertQueue = new Queue("alerts", { connection: redisConnection });
export const appointmentQueue = new Queue("appointments", { connection: redisConnection });
export const doctorSignalQueue = new Queue("doctor-signals", { connection: redisConnection });
export const briefQueue = new Queue("visit-briefs", { connection: redisConnection });

// Job type definitions
export type CheckinJobData = {
  patientId: string;
  cycleDay: number;
  type: "morning" | "afternoon";
};

export type MessageJobData = {
  to: string;
  body: string;
  type?: "text" | "interactive" | "template";
  interactivePayload?: object;
};

export type AlertJobData = {
  patientId: string;
  checkinId?: string;
  type: string;
  severity: "info" | "caution" | "urgent";
  message: string;
};

export type AppointmentReminderJobData = {
  appointmentId: string;
  patientId: string;
  reminderType: "48h" | "24h" | "2h" | "prep_brief" | "post_visit";
};

export type BriefJobData = {
  patientId: string;
  appointmentId: string;
};
