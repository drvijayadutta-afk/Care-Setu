export declare function askClaude(systemPrompt: string, userMessage: string, maxTokens?: number): Promise<string>;
export declare function askClaudeWithHistory(systemPrompt: string, history: {
    role: "user" | "assistant";
    content: string;
}[], maxTokens?: number): Promise<string>;
export declare function askClaudeJSON<T>(systemPrompt: string, userMessage: string, maxTokens?: number): Promise<T>;
export declare function extractDocumentData(storagePath: string, category: string, fileType: string): Promise<unknown>;
export declare function generateMdtSummary(patient: any): Promise<string>;
