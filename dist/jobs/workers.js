"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctorSignalWorker = exports.appointmentWorker = exports.checkinWorker = void 0;
exports.gracefulShutdown = gracefulShutdown;
const bullmq_1 = require("bullmq");
const queue_1 = require("./queue");
const engine_1 = require("../modules/checkin/engine");
const track_1 = require("../modules/caregiver/track");
const brief_1 = require("../modules/appointments/brief");
const signal_1 = require("../modules/doctor/signal");
const context_1 = require("../modules/medications/context");
// Check-in worker
exports.checkinWorker = new bullmq_1.Worker("checkins", async (job) => {
    const data = job.data;
    switch (job.name) {
        case "morning-checkin":
        case "afternoon-checkin":
            await (0, engine_1.sendCheckinMessage)(data.patientId, data.cycleDay, data.type);
            break;
        case "caregiver-morning-brief":
            await (0, track_1.sendCaregiverMorningBrief)(data.patientId);
            break;
        case "caregiver-weekly-check":
            await (0, track_1.sendCaregiverWeeklyCheck)(data.patientId);
            break;
        case "medication-reminder":
            await (0, context_1.sendMedicationReminder)(data.patientId);
            break;
    }
}, { connection: queue_1.redisConnection, concurrency: 10 });
// Appointment worker
exports.appointmentWorker = new bullmq_1.Worker("appointments", async (job) => {
    const data = job.data;
    if (data.reminderType === "prep_brief") {
        await (0, brief_1.sendPreVisitBrief)(data.appointmentId, data.patientId);
    }
    else {
        await (0, brief_1.sendAppointmentReminder)(data.appointmentId, data.patientId, data.reminderType);
    }
}, { connection: queue_1.redisConnection, concurrency: 5 });
// Doctor signal worker (runs on cron)
exports.doctorSignalWorker = new bullmq_1.Worker("doctor-signals", async () => {
    await (0, signal_1.sendDoctorWeeklySignals)();
}, { connection: queue_1.redisConnection, concurrency: 1 });
exports.checkinWorker.on("failed", (job, err) => {
    console.error(`Check-in job ${job?.id} failed:`, err.message);
});
exports.appointmentWorker.on("failed", (job, err) => {
    console.error(`Appointment job ${job?.id} failed:`, err.message);
});
exports.doctorSignalWorker.on("failed", (job, err) => {
    console.error(`Doctor signal job ${job?.id} failed:`, err.message);
});
function gracefulShutdown() {
    return Promise.all([
        exports.checkinWorker.close(),
        exports.appointmentWorker.close(),
        exports.doctorSignalWorker.close(),
    ]);
}
//# sourceMappingURL=workers.js.map