"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyIntent = classifyIntent;
const claude_1 = require("../integrations/claude");
const prompts_1 = require("./prompts");
async function classifyIntent(message, recentMessages, patient, cycleDay, isNight) {
    const context = `
Patient: ${patient.name}, ${patient.cancerType}, ${patient.treatmentProtocol}
Cycle Day: ${cycleDay} | Night: ${isNight}
Recent messages: ${recentMessages.map((m) => `[${m.role}]: ${m.content}`).join(" | ")}
Current message: ${message}
`;
    try {
        return await (0, claude_1.askClaudeJSON)(prompts_1.INTENT_CLASSIFIER_PROMPT, context, 128);
    }
    catch {
        // Safe fallback — treat as emotional support
        return {
            intent: "unknown",
            extractedScore: null,
            appointmentType: null,
            urgency: null,
            language: "hi",
            emotionalFlag: false,
        };
    }
}
//# sourceMappingURL=intents.js.map