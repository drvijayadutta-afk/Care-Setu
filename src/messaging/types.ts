// ─── Channel Addresses ────────────────────────────────────────────────────────
// Typed addresses for each channel to prevent semantic mismatches.

export type ChannelAddress =
  | { kind: "whatsapp"; phoneE164: string }
  | { kind: "telegram"; chatId: string };

// ─── Messaging Interface ───────────────────────────────────────────────────────
// Contracts for what each channel can do. Callers rely on the interface, not
// silent fallback behavior. If a channel doesn't support a capability, the type
// system prevents calling it.

export interface MessagingChannel {
  readonly kind: "whatsapp" | "telegram";
  readonly supportsTemplates: boolean;

  sendText(address: ChannelAddress, body: string): Promise<string | null>;
  sendButtons(
    address: ChannelAddress,
    body: string,
    buttons: { id: string; title: string }[]
  ): Promise<string | null>;
  sendList(
    address: ChannelAddress,
    body: string,
    buttonLabel: string,
    sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]
  ): Promise<string | null>;

  // Template sending only available on WhatsApp (enforced at compile time by
  // type narrowing, not runtime silent downgrade).
  sendTemplate?(
    address: ChannelAddress,
    templateName: string,
    languageCode: string,
    components?: object[]
  ): Promise<string | null>;

  // Media operations. Telegram doesn't implement markRead; no silent no-op.
  markRead?(messageId: string): Promise<void>;
  downloadMediaUrl?(mediaId: string): Promise<string>;
}

// ─── Channel Implementations (type-narrowed in usage) ─────────────────────────

export class WhatsAppChannel implements MessagingChannel {
  readonly kind = "whatsapp";
  readonly supportsTemplates = true;

  constructor(
    private phoneId: string,
    private token: string,
    private apiVersion: string = "v21.0",
    private isAisensy: boolean = false
  ) {}

  async sendText(address: ChannelAddress, body: string): Promise<string | null> {
    if (address.kind !== "whatsapp") {
      throw new Error(`WhatsApp channel received non-WhatsApp address: ${address.kind}`);
    }
    // Implementation delegated to internal sender methods
    return this._sendTextImpl(address.phoneE164, body);
  }

  async sendButtons(
    address: ChannelAddress,
    body: string,
    buttons: { id: string; title: string }[]
  ): Promise<string | null> {
    if (address.kind !== "whatsapp") {
      throw new Error(`WhatsApp channel received non-WhatsApp address: ${address.kind}`);
    }
    return this._sendButtonsImpl(address.phoneE164, body, buttons);
  }

  async sendList(
    address: ChannelAddress,
    body: string,
    buttonLabel: string,
    sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]
  ): Promise<string | null> {
    if (address.kind !== "whatsapp") {
      throw new Error(`WhatsApp channel received non-WhatsApp address: ${address.kind}`);
    }
    return this._sendListImpl(address.phoneE164, body, buttonLabel, sections);
  }

  async sendTemplate(
    address: ChannelAddress,
    templateName: string,
    languageCode: string,
    components?: object[]
  ): Promise<string | null> {
    if (address.kind !== "whatsapp") {
      throw new Error(`WhatsApp channel received non-WhatsApp address: ${address.kind}`);
    }
    return this._sendTemplateImpl(address.phoneE164, templateName, languageCode, components);
  }

  async markRead(messageId: string): Promise<void> {
    if (this.isAisensy) return;
    return this._markReadImpl(messageId);
  }

  async downloadMediaUrl(mediaId: string): Promise<string> {
    if (this.isAisensy) throw new Error("Aisensy media download not implemented");
    return this._downloadMediaUrlImpl(mediaId);
  }

  // Internal implementations (use old axios clients from sender.ts)
  private async _sendTextImpl(phoneE164: string, body: string): Promise<string | null> {
    // Will be wired to existing axios client
    const { axios, wa } = await this._getClients();
    if (this.isAisensy) {
      const { data } = await wa.post("/send-message", { phoneNumber: phoneE164, message: body });
      return data?.messageId ?? data?.id ?? null;
    }
    const { data } = await wa.post("", {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneE164,
      type: "text",
      text: { body, preview_url: false },
    });
    return data?.messages?.[0]?.id ?? null;
  }

  private async _sendButtonsImpl(
    phoneE164: string,
    body: string,
    buttons: { id: string; title: string }[]
  ): Promise<string | null> {
    const { wa } = await this._getClients();
    const { data } = await wa.post("", {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneE164,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: body },
        action: { buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })) },
      },
    });
    return data?.messages?.[0]?.id ?? null;
  }

  private async _sendListImpl(
    phoneE164: string,
    body: string,
    buttonLabel: string,
    sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]
  ): Promise<string | null> {
    const { wa } = await this._getClients();
    const { data } = await wa.post("", {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneE164,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: body },
        action: { button: buttonLabel, sections },
      },
    });
    return data?.messages?.[0]?.id ?? null;
  }

  private async _sendTemplateImpl(
    phoneE164: string,
    templateName: string,
    languageCode: string,
    components?: object[]
  ): Promise<string | null> {
    const { wa } = await this._getClients();
    const { data } = await wa.post("", {
      messaging_product: "whatsapp",
      to: phoneE164,
      type: "template",
      template: { name: templateName, language: { code: languageCode }, components },
    });
    return data?.messages?.[0]?.id ?? null;
  }

  private async _markReadImpl(messageId: string): Promise<void> {
    const { wa } = await this._getClients();
    await wa.post("", { messaging_product: "whatsapp", status: "read", message_id: messageId });
  }

  private async _downloadMediaUrlImpl(mediaId: string): Promise<string> {
    const { axios } = await this._getClients();
    const { data } = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return data.url;
  }

  private async _getClients() {
    const axios = await import("axios").then((m) => m.default);
    const wa = !this.isAisensy
      ? axios.create({
          baseURL: `https://graph.facebook.com/${this.apiVersion}/${this.phoneId}/messages`,
          headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        })
      : axios.create({
          baseURL: "https://app.aisensy.com/api/v1",
          headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        });
    return { axios, wa };
  }
}

export class TelegramChannel implements MessagingChannel {
  readonly kind = "telegram";
  readonly supportsTemplates = false;

  constructor(private token: string) {}

  async sendText(address: ChannelAddress, body: string): Promise<string | null> {
    if (address.kind !== "telegram") {
      throw new Error(`Telegram channel received non-Telegram address: ${address.kind}`);
    }
    const axios = await import("axios").then((m) => m.default);
    const { data } = await axios.post(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      chat_id: address.chatId,
      text: body,
      parse_mode: "HTML",
    });
    return data?.result?.message_id?.toString() ?? null;
  }

  async sendButtons(
    address: ChannelAddress,
    body: string,
    buttons: { id: string; title: string }[]
  ): Promise<string | null> {
    if (address.kind !== "telegram") {
      throw new Error(`Telegram channel received non-Telegram address: ${address.kind}`);
    }
    const axios = await import("axios").then((m) => m.default);
    const { data } = await axios.post(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      chat_id: address.chatId,
      text: body,
      reply_markup: {
        inline_keyboard: [buttons.map((b) => ({ text: b.title, callback_data: b.id }))],
      },
    });
    return data?.result?.message_id?.toString() ?? null;
  }

  async sendList(
    address: ChannelAddress,
    body: string,
    _buttonLabel: string,
    sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]
  ): Promise<string | null> {
    if (address.kind !== "telegram") {
      throw new Error(`Telegram channel received non-Telegram address: ${address.kind}`);
    }
    const axios = await import("axios").then((m) => m.default);
    const keyboard = sections.flatMap((s) =>
      s.rows.map((r) => [{ text: `${r.title}${r.description ? ` — ${r.description}` : ""}`, callback_data: r.id }])
    );
    const { data } = await axios.post(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      chat_id: address.chatId,
      text: body,
      reply_markup: { inline_keyboard: keyboard },
    });
    return data?.result?.message_id?.toString() ?? null;
  }

  async downloadMediaUrl(mediaId: string): Promise<string> {
    const axios = await import("axios").then((m) => m.default);
    const { data } = await axios.get(`https://api.telegram.org/bot${this.token}/getFile?file_id=${mediaId}`);
    const filePath = data?.result?.file_path;
    return `https://api.telegram.org/file/bot${this.token}/${filePath}`;
  }
}
