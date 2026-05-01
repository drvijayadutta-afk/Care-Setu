"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const handler_1 = require("./webhook/handler");
const workers_1 = require("./jobs/workers");
const queue_1 = require("./jobs/queue");
const fastify = (0, fastify_1.default)({
    logger: process.env.NODE_ENV !== "production",
});
// Health check
fastify.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));
// WhatsApp webhook verification (GET)
fastify.get("/webhook", handler_1.handleWebhookVerification);
// WhatsApp incoming messages (POST)
fastify.post("/webhook", {
    config: { rawBody: true },
    handler: handler_1.handleWebhookMessage,
});
// Schedule recurring cron jobs on startup
async function scheduleCronJobs() {
    // Doctor weekly signal — every Sunday at 7 PM IST (13:30 UTC)
    await queue_1.doctorSignalQueue.add("weekly-signals", {}, { repeat: { pattern: "30 13 * * 0" } });
}
async function start() {
    try {
        await fastify.listen({
            port: parseInt(process.env.PORT || "3000"),
            host: "0.0.0.0",
        });
        await scheduleCronJobs();
        console.log(`🚀 Cancer AI server running on port ${process.env.PORT || 3000}`);
        console.log(`📱 WhatsApp webhook: /webhook`);
        console.log(`⚙️  Workers: check-ins, appointments, doctor-signals`);
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}
// Graceful shutdown
process.on("SIGINT", async () => {
    console.log("Shutting down gracefully...");
    await (0, workers_1.gracefulShutdown)();
    await fastify.close();
    process.exit(0);
});
process.on("SIGTERM", async () => {
    await (0, workers_1.gracefulShutdown)();
    await fastify.close();
    process.exit(0);
});
start();
//# sourceMappingURL=server.js.map