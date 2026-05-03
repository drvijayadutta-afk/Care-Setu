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

    const token = typeof window !== 'undefined' ? localStorage.getItem('coordinator_token') : null;
    if (!token) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const wsUrl = apiUrl.replace(/^https?:/, 'ws:').replace(/^http?:/, 'ws:');
    const wsEndpoint = `${wsUrl}/ws/${patientId}?token=${encodeURIComponent(token)}`;

    console.log('Connecting to WebSocket:', wsEndpoint);

    const ws = new WebSocket(wsEndpoint);
    let pingInterval: ReturnType<typeof setInterval> | null = null;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);

      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketEvent;
        onEvent(data);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
      setIsConnected(false);
    };

    ws.onclose = () => {
      if (pingInterval) clearInterval(pingInterval);
      setIsConnected(false);

      // Reconnect after 3 seconds if still mounted
      setTimeout(() => connect(), 3000);
    };

    return () => {
      if (pingInterval) clearInterval(pingInterval);
      ws.close();
    };
  }, [patientId, onEvent]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  return { isConnected, error };
}
