import type { FastifyInstance } from 'fastify';
import { wsManager } from './manager';

export async function registerWebSocketRoutes(fastify: FastifyInstance) {
  // WebSocket endpoint for real-time updates
  fastify.get('/ws/:patientId', { websocket: true }, async (connection, req) => {
    const { patientId } = req.params as { patientId: string };

    // Validate patientId (in production, verify auth token and patient access)
    if (!patientId) {
      connection.socket.close(1008, 'Invalid patient ID');
      return;
    }

    console.log(`WebSocket connection established for patient: ${patientId}`);

    // Subscribe to patient updates
    wsManager.subscribe(patientId, connection.socket);

    // Send welcome message
    connection.socket.send(
      JSON.stringify({
        type: 'connection',
        message: `Connected to real-time updates for patient ${patientId}`,
        timestamp: new Date().toISOString(),
      })
    );

    // Handle incoming messages (for future use - heartbeat, commands, etc.)
    connection.socket.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`Received message from ${patientId}:`, data);

        // Echo pong for ping
        if (data.type === 'ping') {
          connection.socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
  });

  // Health check endpoint for WebSocket
  fastify.get('/ws/health', async () => {
    return {
      status: 'ok',
      connections: wsManager.getConnectionCount(),
      timestamp: new Date().toISOString(),
    };
  });
}

export { wsManager };
