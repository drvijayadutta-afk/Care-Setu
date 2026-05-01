"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.briefQueue = exports.doctorSignalQueue = exports.appointmentQueue = exports.alertQueue = exports.messageQueue = exports.checkinQueue = exports.redisConnection = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
exports.redisConnection = new ioredis_1.default(redisUrl, {
    maxRetriesPerRequest: null,
});
// Queue definitions
exports.checkinQueue = new bullmq_1.Queue("checkins", { connection: exports.redisConnection });
exports.messageQueue = new bullmq_1.Queue("messages", { connection: exports.redisConnection });
exports.alertQueue = new bullmq_1.Queue("alerts", { connection: exports.redisConnection });
exports.appointmentQueue = new bullmq_1.Queue("appointments", { connection: exports.redisConnection });
exports.doctorSignalQueue = new bullmq_1.Queue("doctor-signals", { connection: exports.redisConnection });
exports.briefQueue = new bullmq_1.Queue("visit-briefs", { connection: exports.redisConnection });
//# sourceMappingURL=queue.js.map