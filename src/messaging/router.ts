import { MessagingChannel, WhatsAppChannel, TelegramChannel, ChannelAddress } from "./types";
import { prisma } from "../db/client";
import { logOutbound } from "../api/services/outbound-logger.service";

// ─── Singleton Channel Instances ───────────────────────────────────────────────

const whatsappChannel = new WhatsAppChannel(
  process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  process.env.WHATSAPP_ACCESS_TOKEN || "",
  process.env.WHATSAPP_API_VERSION || "v21.0",
  process.env.WHATSAPP_API_VERSION === "aisensy"
);

const telegramChannel = new TelegramChannel(process.env.TELEGRAM_BOT_TOKEN || "");

// ─── Routing Logic ────────────────────────────────────────────────────────────
// Routes messages to the correct channel based on patient's preferred channel.
// Falls back to detection if not explicitly stored.

export class MessagingRouter {
  async getChannelAndAddress(
    patientIdOrWhatsapp: string,
    isWhatsappNumber?: boolean
  ): Promise<{ channel: MessagingChannel; address: ChannelAddress; patientId: string }> {
    const where = isWhatsappNumber
      ? { whatsappNumber: patientIdOrWhatsapp }
      : { id: patientIdOrWhatsapp };
    const patient = await prisma.patient.findUniqueOrThrow({ where });

    // Use explicit preference if set; otherwise detect from available data
    const preferredChannel = patient.preferredMessagingChannel || this.detectChannel();

    if (preferredChannel === "telegram" && patient.telegramChatId) {
      return {
        channel: telegramChannel,
        address: { kind: "telegram", chatId: patient.telegramChatId },
        patientId: patient.id,
      };
    }

    if (patient.whatsappNumber) {
      return {
        channel: whatsappChannel,
        address: { kind: "whatsapp", phoneE164: patient.whatsappNumber },
        patientId: patient.id,
      };
    }

    throw new Error(`Patient ${patientIdOrWhatsapp} has no messaging address (WhatsApp or Telegram)`);
  }

  async getChannelForAddress(address: ChannelAddress): Promise<MessagingChannel> {
    if (address.kind === "whatsapp") return whatsappChannel;
    if (address.kind === "telegram") return telegramChannel;
    throw new Error(`Unknown channel kind: ${(address as any).kind}`);
  }

  private detectChannel(): "whatsapp" | "telegram" {
    // Fall back to global environment flag; will be replaced by patient preference
    return process.env.TELEGRAM_BOT_TOKEN ? "telegram" : "whatsapp";
  }

  // Convenience methods: get patient → send message → log outbound record
  // Accepts either patientId or whatsappNumber via the isWhatsappNumber flag.
  // messageType is stored in OutboundMessage for the communication log tab.
  async sendText(
    patientIdOrWhatsapp: string,
    body: string,
    isWhatsappNumber = false,
    messageType = "coordinator_manual"
  ): Promise<string | null> {
    const { channel, address, patientId } = await this.getChannelAndAddress(patientIdOrWhatsapp, isWhatsappNumber);
    const externalId = await channel.sendText(address, body);
    const recipientRef = address.kind === "whatsapp" ? address.phoneE164 : address.chatId;
    logOutbound({ patientId, channel: address.kind, recipientRef, messageType, content: body, externalId });
    return externalId;
  }

  async sendButtons(
    patientIdOrWhatsapp: string,
    body: string,
    buttons: { id: string; title: string }[],
    isWhatsappNumber = false,
    messageType = "coordinator_manual"
  ): Promise<string | null> {
    const { channel, address, patientId } = await this.getChannelAndAddress(patientIdOrWhatsapp, isWhatsappNumber);
    const externalId = await channel.sendButtons(address, body, buttons);
    const recipientRef = address.kind === "whatsapp" ? address.phoneE164 : address.chatId;
    logOutbound({ patientId, channel: address.kind, recipientRef, messageType, content: body, externalId });
    return externalId;
  }

  async sendList(
    patientIdOrWhatsapp: string,
    body: string,
    buttonLabel: string,
    sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
    isWhatsappNumber = false,
    messageType = "coordinator_manual"
  ): Promise<string | null> {
    const { channel, address, patientId } = await this.getChannelAndAddress(patientIdOrWhatsapp, isWhatsappNumber);
    const externalId = await channel.sendList(address, body, buttonLabel, sections);
    const recipientRef = address.kind === "whatsapp" ? address.phoneE164 : address.chatId;
    logOutbound({ patientId, channel: address.kind, recipientRef, messageType, content: body, externalId });
    return externalId;
  }

  async sendTemplate(
    patientIdOrWhatsapp: string,
    templateName: string,
    languageCode: string,
    components?: object[],
    isWhatsappNumber = false,
    messageType = "coordinator_manual"
  ): Promise<string | null> {
    const { channel, address, patientId } = await this.getChannelAndAddress(patientIdOrWhatsapp, isWhatsappNumber);
    // Compile-time safety: sendTemplate is only callable if channel.supportsTemplates is true
    if (!channel.supportsTemplates) {
      throw new Error(
        `Patient's preferred channel (${address.kind}) does not support templates. Use explicit channel selection or switch to WhatsApp.`
      );
    }
    const externalId = await (channel.sendTemplate?.(address, templateName, languageCode, components) ?? null);
    const recipientRef = address.kind === "whatsapp" ? address.phoneE164 : address.chatId;
    logOutbound({ patientId, channel: address.kind, recipientRef, messageType, content: templateName, externalId });
    return externalId;
  }
}

export const messagingRouter = new MessagingRouter();

// ─── Direct Channel Access (for webhook handlers that know the address type upfront) ──

export function getWhatsAppChannel(): MessagingChannel {
  return whatsappChannel;
}

export function getTelegramChannel(): MessagingChannel {
  return telegramChannel;
}
