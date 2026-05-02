import axios from "axios";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE = () => `https://api.telegram.org/bot${TOKEN}`;

export async function sendText(chatId: string, text: string): Promise<string | null> {
  const { data } = await axios.post(`${BASE()}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  });
  return data?.result?.message_id?.toString() ?? null;
}

export async function sendButtons(
  chatId: string,
  text: string,
  buttons: { id: string; title: string }[]
): Promise<string | null> {
  const { data } = await axios.post(`${BASE()}/sendMessage`, {
    chat_id: chatId,
    text,
    reply_markup: {
      inline_keyboard: [buttons.map((b) => ({ text: b.title, callback_data: b.id }))],
    },
  });
  return data?.result?.message_id?.toString() ?? null;
}

export async function sendList(
  chatId: string,
  text: string,
  _buttonLabel: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]
): Promise<string | null> {
  // Telegram doesn't have lists — convert to inline keyboard rows
  const keyboard = sections.flatMap((s) =>
    s.rows.map((r) => [{ text: `${r.title}${r.description ? ` — ${r.description}` : ""}`, callback_data: r.id }])
  );
  const { data } = await axios.post(`${BASE()}/sendMessage`, {
    chat_id: chatId,
    text,
    reply_markup: { inline_keyboard: keyboard },
  });
  return data?.result?.message_id?.toString() ?? null;
}

export async function markRead(_messageId: string): Promise<void> {
  // Telegram doesn't have read receipts — no-op
}

export async function setWebhook(webhookUrl: string): Promise<void> {
  const { data } = await axios.post(`${BASE()}/setWebhook`, {
    url: `${webhookUrl}/webhook/telegram`,
    allowed_updates: ["message", "callback_query"],
  });
  console.log("Telegram webhook set:", data);
}

export async function deleteWebhook(): Promise<void> {
  await axios.post(`${BASE()}/deleteWebhook`);
}
