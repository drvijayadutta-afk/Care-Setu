import type { FastifyRequest, FastifyReply } from "fastify";
export declare function handleWebhookVerification(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function handleWebhookMessage(request: FastifyRequest, reply: FastifyReply): Promise<void>;
