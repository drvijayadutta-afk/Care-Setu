import { useEffect, useCallback, useState } from 'react';

export type WebSocketEvent =
  | { type: 'message'; patientId: string; conversationId: string; content: string; role: 'patient' | 'assistant' }
  | { type: 'appointment'; patientId: string; appointmentId: string; action: 'created' | 'updated'; status: string }
  | { type: 'checkin'; patientId: string; checkinId: string; symptomScore: number }
  | { type: 'connection'; message: string; timestamp: string }
  | { type: 'pong'; timestamp: string };

export function useWebSocket(patientId: string | null, onEvent: (event: WebSocketEvent) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (!patientId) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const wsUrl = apiUrl.replace(/^https?:/, 'ws:').replace(/^http?:/, 'ws:');
    const wsEndpoint = `${wsUrl}/ws/${patientId}`;

    console.log('Connecting to WebSocket:', wsEndpoint);

    const ws = new WebSocket(wsEndpoint);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);

      // Send ping every 30 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
        }
      }, 30000);

      return () => clearInterval(pingInterval);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketEvent;
        console.log('WebSocket event received:', data.type);
        onEvent(data);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      setError('WebSocket connection error');
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);

      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (patientId) {
          connect();
        }
      }, 3000);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [patientId, onEvent]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  return { isConnected, error };
}
