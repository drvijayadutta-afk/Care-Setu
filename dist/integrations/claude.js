"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.askClaude = askClaude;
exports.askClaudeWithHistory = askClaudeWithHistory;
exports.askClaudeJSON = askClaudeJSON;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const client = new sdk_1.default({
    apiKey: process.env.ANTHROPIC_API_KEY,
});
const MODEL = "claude-sonnet-4-6";
async function askClaude(systemPrompt, userMessage, maxTokens = 512) {
    const message = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
    });
    const block = message.content[0];
    if (block.type !== "text")
        throw new Error("Unexpected response type from Claude");
    return block.text;
}
async function askClaudeWithHistory(systemPrompt, history, maxTokens = 512) {
    const message = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: history,
    });
    const block = message.content[0];
    if (block.type !== "text")
        throw new Error("Unexpected response type from Claude");
    return block.text;
}
async function askClaudeJSON(systemPrompt, userMessage, maxTokens = 256) {
    const raw = await askClaude(systemPrompt, userMessage, maxTokens);
    // Strip markdown code fences if Claude adds them
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(cleaned);
}
//# sourceMappingURL=claude.js.map