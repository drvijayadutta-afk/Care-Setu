import { fetchNewMessages } from "./aisensy";
import { processMessage } from "../webhook/handler";

export async function pollAisensyMessages() {
  const messages = await fetchNewMessages();

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
      await processMessage(whatsappMessage as any, "aisensy");
    } catch (err) {
      console.error(`Error processing Aisensy message ${msg.messageId}:`, err);
    }
  }
}
