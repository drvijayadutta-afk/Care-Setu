"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const handler_1 = require("./webhook/handler");
const workers_1 = require("./jobs/workers");
const queue_1 = require("./jobs/queue");
const aisensy_poller_1 = require("./integrations/aisensy-poller");
const routes_1 = require("./api/routes");
const routes_2 = require("./websocket/routes");
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
let aiensyPollingInterval = null;
function startAisensyPolling() {
    if (process.env.WHATSAPP_API_VERSION === "aisensy") {
        console.log("🔄 Starting Aisensy message polling (every 30s)...");
        aiensyPollingInterval = setInterval(async () => {
            try {
                await (0, aisensy_poller_1.pollAisensyMessages)();
            }
            catch (err) {
                console.error("Aisensy polling error:", err);
            }
        }, 30000); // Poll every 30 seconds
    }
}
async function start() {
    try {
        // Add CORS support
        await fastify.register(cors_1.default, {
            origin: true,
        });
        // Add WebSocket support
        await fastify.register(websocket_1.default);
        // Register API routes
        await (0, routes_1.registerApiRoutes)(fastify);
        // Register WebSocket routes
        await (0, routes_2.registerWebSocketRoutes)(fastify);
        await fastify.listen({
            port: parseInt(process.env.PORT || "3000"),
            host: "0.0.0.0",
        });
        await scheduleCronJobs();
        startAisensyPolling();
        console.log(`🚀 Cancer AI server running on port ${process.env.PORT || 3000}`);
        console.log(`📱 WhatsApp webhook: /webhook`);
        console.log(`📊 API endpoints: /patients, /patients/:id, /patients/:id/conversations`);
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
    if (aiensyPollingInterval)
        clearInterval(aiensyPollingInterval);
    await (0, workers_1.gracefulShutdown)();
    await fastify.close();
    process.exit(0);
});
process.on("SIGTERM", async () => {
    if (aiensyPollingInterval)
        clearInterval(aiensyPollingInterval);
    await (0, workers_1.gracefulShutdown)();
    await fastify.close();
    process.exit(0);
});
start();
//# sourceMappingURL=server.js.map