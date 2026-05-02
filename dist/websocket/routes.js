"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsManager = void 0;
exports.registerWebSocketRoutes = registerWebSocketRoutes;
const manager_1 = require("./manager");
Object.defineProperty(exports, "wsManager", { enumerable: true, get: function () { return manager_1.wsManager; } });
async function registerWebSocketRoutes(fastify) {
    // WebSocket endpoint for real-time updates
    fastify.get('/ws/:patientId', { websocket: true }, async (connection, req) => {
        const { patientId } = req.params;
        // Validate patientId (in production, verify auth token and patient access)
        if (!patientId) {
            connection.close(1008, 'Invalid patient ID');
            return;
        }
        console.log(`WebSocket connection established for patient: ${patientId}`);
        // Subscribe to patient updates
        manager_1.wsManager.subscribe(patientId, connection);
        // Send welcome message
        connection.send(JSON.stringify({
            type: 'connection',
            message: `Connected to real-time updates for patient ${patientId}`,
            timestamp: new Date().toISOString(),
        }));
        // Handle incoming messages (for future use - heartbeat, commands, etc.)
        connection.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                console.log(`Received message from ${patientId}:`, data);
                // Echo pong for ping
                if (data.type === 'ping') {
                    connection.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                }
            }
            catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        });
    });
    // Health check endpoint for WebSocket
    fastify.get('/ws/health', async () => {
        return {
            status: 'ok',
            connections: manager_1.wsManager.getConnectionCount(),
            timestamp: new Date().toISOString(),
        };
    });
}
//# sourceMappingURL=routes.js.map