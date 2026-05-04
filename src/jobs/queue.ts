import { Queue, Worker, QueueEvents } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  // Give up retrying quickly so a dead Redis doesn't stall the server
  retryStrategy: (times) => Math.min(times * 200, 5000),
});

// Prevent unhandled 'error' events from crashing the process.
// BullMQ workers log their own errors; this is a safety net for auth/connect errors.
redisConnection.on("error", (err: Error) => {
  console.error("[Redis] Connection error (workers paused):", err.message);
});

// Queue definitions
export const checkinQueue = new Queue("checkins", { connection: redisConnection });
export const messageQueue = new Queue("messages", { connection: redisConnection });
export const alertQueue = new Queue("alerts", { connection: redisConnection });
export const appointmentQueue = new Queue("appointments", { connection: redisConnection });
export const doctorSignalQueue = new Queue("doctor-signals", { connection: redisConnection });
export const briefQueue = new Queue("visit-briefs", { connection: redisConnection });

// Inbox queue — durable buffer for incoming webhook payloads. Producers enqueue
// before acking 200 so a downstream failure leads to a BullMQ retry, not a lost
// patient message.
export const inboxQueue = new Queue("inbox", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 60 * 60, count: 1000 },
    removeOnFail: { age: 7 * 24 * 60 * 60 },
  },
});

export type InboxJobData =
  | { source: "whatsapp"; payload: any }
  | { source: "telegram"; payload: any };

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
