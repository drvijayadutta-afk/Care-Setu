"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./config/env");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const handler_1 = require("./webhook/handler");
const handler_2 = require("./telegram/handler");
const sender_1 = require("./telegram/sender");
const workers_1 = require("./jobs/workers");
const queue_1 = require("./jobs/queue");
const aisensy_poller_1 = require("./integrations/aisensy-poller");
const routes_1 = require("./api/routes");
const auth_1 = require("./api/auth");
const routes_2 = require("./websocket/routes");
const patient_scope_1 = require("./api/middleware/patient-scope");
const patient_repo_1 = require("./repositories/patient.repo");
const coordinator_repo_1 = require("./repositories/coordinator.repo");
const conversation_repo_1 = require("./repositories/conversation.repo");
const record_repo_1 = require("./repositories/record.repo");
const fastify = (0, fastify_1.default)({
    logger: env_1.config.nodeEnv !== "production",
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
// Telegram incoming messages (POST)
fastify.post("/webhook/telegram", {
    handler: handler_2.handleTelegramWebhook,
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
        // Add CORS support — restrict to known frontend origins
        await fastify.register(cors_1.default, { origin: env_1.config.allowedOrigins });
        // JWT authentication — secret validated at boot in src/config/env.ts
        await fastify.register(jwt_1.default, { secret: env_1.config.jwtSecret });
        // Decorator used by protected routes
        fastify.decorate("authenticate", async (request, reply) => {
            try {
                await request.jwtVerify();
            }
            catch {
                reply.status(401).send({ error: "Unauthorized" });
            }
        });
        // Decorator for patient-scoped authorization
        fastify.decorate("requirePatientAccess", patient_scope_1.requirePatientAccess);
        // Composition root — instantiate repositories and inject as decorators
        const patientRepo = new patient_repo_1.PatientRepository();
        const coordinatorRepo = new coordinator_repo_1.CoordinatorRepository();
        const conversationRepo = new conversation_repo_1.ConversationRepository();
        const recordRepo = new record_repo_1.RecordRepository();
        fastify.decorate("patientRepo", patientRepo);
        fastify.decorate("coordinatorRepo", coordinatorRepo);
        fastify.decorate("conversationRepo", conversationRepo);
        fastify.decorate("recordRepo", recordRepo);
        // Add WebSocket support
        await fastify.register(websocket_1.default);
        // Auth routes (public — no JWT required)
        await (0, auth_1.registerAuthRoutes)(fastify);
        // Register API routes (protected inside via preHandler)
        await (0, routes_1.registerApiRoutes)(fastify);
        // Register WebSocket routes
        await (0, routes_2.registerWebSocketRoutes)(fastify);
        await fastify.listen({
            port: env_1.config.port,
            host: "0.0.0.0",
        });
        await scheduleCronJobs();
        startAisensyPolling();
        // Auto-register Telegram webhook if token is set
        if (process.env.TELEGRAM_BOT_TOKEN) {
            const backendUrl = process.env.BACKEND_URL || `https://care-setu-backend.onrender.com`;
            await (0, sender_1.setWebhook)(backendUrl).catch((err) => console.error("Failed to set Telegram webhook:", err));
            console.log(`🤖 Telegram webhook registered: ${backendUrl}/webhook/telegram`);
        }
        console.log(`🚀 Care Setu server running on port ${env_1.config.port}`);
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