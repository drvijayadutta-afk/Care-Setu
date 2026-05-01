import type { FastifyRequest, FastifyReply } from "fastify";
interface WhatsAppMessage {
    id: string;
    from: string;
    timestamp: string;
    type: string;
    text?: {
        body: string;
    };
    audio?: {
        id: string;
        mime_type: string;
    };
    interactive?: {
        type: string;
        button_reply?: {
            id: string;
            title: string;
        };
        list_reply?: {
            id: string;
            title: string;
        };
    };
}
export declare function handleWebhookVerification(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function handleWebhookMessage(request: FastifyRequest, reply: FastifyReply): Promise<void>;
export declare function processMessage(message: WhatsAppMessage, phoneNumberId: string): Promise<void>;
export {};
