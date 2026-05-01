"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pollAisensyMessages = pollAisensyMessages;
const aisensy_1 = require("./aisensy");
const handler_1 = require("../webhook/handler");
async function pollAisensyMessages() {
    const messages = await (0, aisensy_1.fetchNewMessages)();
    for (const msg of messages) {
        // Convert Aisensy format to WhatsApp format
        const whatsappMessage = {
            id: msg.messageId,
            from: msg.phoneNumber,
            timestamp: msg.timestamp,
            type: "text",
            text: { body: msg.message },
        };
        try {
            await (0, handler_1.processMessage)(whatsappMessage, "aisensy");
        }
        catch (err) {
            console.error(`Error processing Aisensy message ${msg.messageId}:`, err);
        }
    }
}
//# sourceMappingURL=aisensy-poller.js.map