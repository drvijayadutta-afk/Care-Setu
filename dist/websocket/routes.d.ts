import type { FastifyInstance } from 'fastify';
import { wsManager } from './manager';
export declare function registerWebSocketRoutes(fastify: FastifyInstance): Promise<void>;
export { wsManager };
