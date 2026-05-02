import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import {
  handleWebhookVerification,
  handleWebhookMessage,
} from "./webhook/handler";
import { handleTelegramWebhook } from "./telegram/handler";
import { setWebhook as setTelegramWebhook } from "./telegram/sender";
import {
  checkinWorker,
  appointmentWorker,
  doctorSignalWorker,
  gracefulShutdown,
} from "./jobs/workers";
import { doctorSignalQueue, checkinQueue } from "./jobs/queue";
import { pollAisensyMessages } from "./integrations/aisensy-poller";
import { registerApiRoutes } from "./api/routes";
import { registerWebSocketRoutes } from "./websocket/routes";

const fastify = Fastify({
  logger: process.env.NODE_ENV !== "production",
});

// Health check
fastify.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

// WhatsApp webhook verification (GET)
fastify.get("/webhook", handleWebhookVerification);

// WhatsApp incoming messages (POST)
fastify.post("/webhook", {
  config: { rawBody: true },
  handler: handleWebhookMessage,
});

// Telegram incoming messages (POST)
fastify.post("/webhook/telegram", {
  handler: handleTelegramWebhook,
});

// Schedule recurring cron jobs on startup
async function scheduleCronJobs() {
  // Doctor weekly signal — every Sunday at 7 PM IST (13:30 UTC)
  await doctorSignalQueue.add(
    "weekly-signals",
    {},
    { repeat: { pattern: "30 13 * * 0" } }
  );
}

let aiensyPollingInterval: NodeJS.Timeout | null = null;

function startAisensyPolling() {
  if (process.env.WHATSAPP_API_VERSION === "aisensy") {
    console.log("🔄 Starting Aisensy message polling (every 30s)...");
    aiensyPollingInterval = setInterval(async () => {
      try {
        await pollAisensyMessages();
      } catch (err) {
        console.error("Aisensy polling error:", err);
      }
    }, 30000); // Poll every 30 seconds
  }
}

async function start() {
  try {
    // Add CORS support
    await fastify.register(cors, {
      origin: true,
    });

    // Add WebSocket support
    await fastify.register(websocket);

    // Register API routes
    await registerApiRoutes(fastify);

    // Register WebSocket routes
    await registerWebSocketRoutes(fastify);

    await fastify.listen({
      port: parseInt(process.env.PORT || "3000"),
      host: "0.0.0.0",
    });

    await scheduleCronJobs();
    startAisensyPolling();

    // Auto-register Telegram webhook if token is set
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const backendUrl = process.env.BACKEND_URL || `https://care-setu-backend.onrender.com`;
      await setTelegramWebhook(backendUrl).catch((err) =>
        console.error("Failed to set Telegram webhook:", err)
      );
      console.log(`🤖 Telegram webhook registered: ${backendUrl}/webhook/telegram`);
    }

    console.log(`🚀 Care Setu server running on port ${process.env.PORT || 3000}`);
    console.log(`📱 WhatsApp webhook: /webhook`);
    console.log(`📊 API endpoints: /patients, /patients/:id, /patients/:id/conversations`);
    console.log(`⚙️  Workers: check-ins, appointments, doctor-signals`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  if (aiensyPollingInterval) clearInterval(aiensyPollingInterval);
  await gracefulShutdown();
  await fastify.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  if (aiensyPollingInterval) clearInterval(aiensyPollingInterval);
  await gracefulShutdown();
  await fastify.close();
  process.exit(0);
});

start();
