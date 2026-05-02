import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-6";

export async function askClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 512
): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Claude");
  return block.text;
}

export async function askClaudeWithHistory(
  systemPrompt: string,
  history: { role: "user" | "assistant"; content: string }[],
  maxTokens = 512
): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: history,
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Claude");
  return block.text;
}

export async function askClaudeJSON<T>(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 256
): Promise<T> {
  const raw = await askClaude(systemPrompt, userMessage, maxTokens);
  // Strip markdown code fences if Claude adds them
  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  return JSON.parse(cleaned) as T;
}
