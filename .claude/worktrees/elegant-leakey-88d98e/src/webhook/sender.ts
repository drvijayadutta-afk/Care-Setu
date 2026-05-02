import axios from "axios";

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const IS_AISENSY = API_VERSION === "aisensy";

const wa = !IS_AISENSY
  ? axios.create({
      baseURL: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    })
  : axios.create({
      baseURL: "https://app.aisensy.com/api/v1",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    });

export async function sendText(to: string, body: string): Promise<string | null> {
  if (IS_AISENSY) {
    const { data } = await wa.post("/send-message", {
      phoneNumber: to,
      message: body,
    });
    return data?.messageId ?? data?.id ?? null;
  }

  const { data } = await wa.post("", {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body, preview_url: false },
  });
  return data?.messages?.[0]?.id ?? null;
}

export async function sendButtonMessage(
  to: string,
  body: string,
  buttons: { id: string; title: string }[]
): Promise<string | null> {
  const { data } = await wa.post("", {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  });
  return data?.messages?.[0]?.id ?? null;
}

export async function sendListMessage(
  to: string,
  body: string,
  buttonLabel: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]
): Promise<string | null> {
  const { data } = await wa.post("", {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: buttonLabel,
        sections,
      },
    },
  });
  return data?.messages?.[0]?.id ?? null;
}

export async function sendTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  components?: object[]
): Promise<string | null> {
  const { data } = await wa.post("", {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  });
  return data?.messages?.[0]?.id ?? null;
}

export async function markRead(messageId: string): Promise<void> {
  if (IS_AISENSY) return; // Aisensy handles read status automatically
  await wa.post("", {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  });
}

export async function downloadMediaUrl(mediaId: string): Promise<string> {
  if (IS_AISENSY) throw new Error("Aisensy media download not yet implemented");
  const { data } = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  return data.url;
}
