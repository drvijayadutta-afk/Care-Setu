import { Queue } from "bullmq";
import IORedis from "ioredis";
export declare const redisConnection: IORedis;
export declare const checkinQueue: Queue<any, any, string, any, any, string>;
export declare const messageQueue: Queue<any, any, string, any, any, string>;
export declare const alertQueue: Queue<any, any, string, any, any, string>;
export declare const appointmentQueue: Queue<any, any, string, any, any, string>;
export declare const doctorSignalQueue: Queue<any, any, string, any, any, string>;
export declare const briefQueue: Queue<any, any, string, any, any, string>;
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
