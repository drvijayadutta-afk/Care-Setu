"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchNewMessages = fetchNewMessages;
exports.sendMessage = sendMessage;
const axios_1 = __importDefault(require("axios"));
const AISENSY_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const AISENSY_CLIENT_ID = "69f4be385fa330517ef3cd3e"; // from the JWT payload
const aisensy = axios_1.default.create({
    baseURL: "https://app.aisensy.com/api/v1",
    headers: {
        Authorization: `Bearer ${AISENSY_TOKEN}`,
        "Content-Type": "application/json",
    },
});
let lastPolledAt = 0;
async function fetchNewMessages() {
    try {
        const { data } = await aisensy.get("/conversations", {
            params: {
                limit: 50,
                offset: 0,
            },
        });
        const messages = [];
        // Parse conversations into messages
        if (Array.isArray(data?.conversations)) {
            for (const conv of data.conversations) {
                const convMessages = conv.messages || [];
                for (const msg of convMessages) {
                    // Only process messages received after last poll (to avoid duplicates)
                    const msgTime = new Date(msg.timestamp || msg.createdAt).getTime();
                    if (msgTime > lastPolledAt && msg.type === "incoming") {
                        messages.push({
                            phoneNumber: conv.phoneNumber || conv.contactPhone,
                            message: msg.text || msg.body || msg.message,
                            messageId: msg.id || msg.messageId,
                            timestamp: msg.timestamp || msg.createdAt,
                            type: "text",
                        });
                    }
                }
            }
        }
        lastPolledAt = Date.now();
        return messages;
    }
    catch (error) {
        console.error("Error fetching Aisensy messages:", error);
        return [];
    }
}
async function sendMessage(phoneNumber, message) {
    try {
        const { data } = await aisensy.post("/send-message", {
            phoneNumber,
            message,
        });
        return data?.messageId || data?.id || null;
    }
    catch (error) {
        console.error("Error sending Aisensy message:", error);
        return null;
    }
}
//# sourceMappingURL=aisensy.js.map