import type { FastifyInstance } from 'fastify';
import { wsManager } from './manager';

export async function registerWebSocketRoutes(fastify: FastifyInstance) {
  // Global coordinator channel — receives activity feed and alert badge events.
  // Must be registered BEFORE /ws/:patientId to prevent wildcard matching "global".
  fastify.get('/ws/global', { websocket: true }, async (connection, req) => {
    const query = req.query as Record<string, string>;
    const token = query.token;

    if (!token) { connection.close(1008, 'Missing auth token'); return; }
    try {
      await (fastify as any).jwt.verify(token);
    } catch {
      connection.close(1008, 'Invalid or expired token');
      return;
    }

    wsManager.subscribeGlobal(connection);
    connection.send(JSON.stringify({ type: 'connection', message: 'Connected to global feed', timestamp: new Date().toISOString() }));

    connection.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ping') {
          connection.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch {}
    });
  });

  // WebSocket endpoint for real-time updates.
  // Auth: coordinator must pass their JWT as ?token=<jwt> query param.
  fastify.get('/ws/:patientId', { websocket: true }, async (connection, req) => {
    const { patientId } = req.params as { patientId: string };
    const query = req.query as Record<string, string>;
    const token = query.token;

    if (!patientId) {
      connection.close(1008, 'Invalid patient ID');
      return;
    }

    // Verify JWT — reuse the Fastify JWT instance registered in server.ts
    if (!token) {
      connection.close(1008, 'Missing auth token');
      return;
    }

    try {
      await (fastify as any).jwt.verify(token);
    } catch {
      connection.close(1008, 'Invalid or expired token');
      return;
    }

    console.log(`WebSocket connection established for patient: ${patientId}`);

    // Subscribe to patient updates
    wsManager.subscribe(patientId, connection);

    // Send welcome message
    connection.send(
      JSON.stringify({
        type: 'connection',
        message: `Connected to real-time updates for patient ${patientId}`,
        timestamp: new Date().toISOString(),
      })
    );

    // Handle incoming messages (for future use - heartbeat, commands, etc.)
    connection.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`Received message from ${patientId}:`, data);

        // Echo pong for ping
        if (data.type === 'ping') {
          connection.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
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
