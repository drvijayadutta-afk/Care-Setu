import { useEffect, useRef, useState } from 'react';
import { getWsTicket } from './api';

export type WebSocketEvent =
  | { type: 'message'; patientId: string; conversationId: string; content: string; role: 'patient' | 'assistant' }
  | { type: 'appointment'; patientId: string; appointmentId: string; action: 'created' | 'updated'; status: string }
  | { type: 'checkin'; patientId: string; checkinId: string; symptomScore: number }
  | { type: 'connection'; message: string; timestamp: string }
  | { type: 'pong'; timestamp: string };

export function useWebSocket(patientId: string | null, onEvent: (event: WebSocketEvent) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep onEvent in a ref so it never needs to be a useEffect dependency.
  // This prevents a new WebSocket being created on every render when the
  // caller passes an inline callback.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!patientId) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    // Use wss:// for https backends, ws:// for http (local dev)
    const wsUrl = apiUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');

    let ws: WebSocket;
    let pingInterval: ReturnType<typeof setInterval>;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let unmounted = false;

    async function connect() {
      // Fetch a short-lived ticket from /auth/ws-ticket using the auth cookie.
      // Browsers don't send cookies on cross-origin WebSocket handshakes, so we
      // pass the ticket as a query param.
      let ticket: string;
      try {
        ticket = await getWsTicket();
      } catch {
        setError('Auth ticket failed');
        return;
      }
      if (unmounted) return;
      const wsEndpoint = `${wsUrl}/ws/${patientId}?token=${encodeURIComponent(ticket)}`;
      ws = new WebSocket(wsEndpoint);

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
          onEventRef.current(data);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        clearInterval(pingInterval);
        setIsConnected(false);
        if (!unmounted) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      unmounted = true;
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [patientId]); // only patientId — onEvent is stable via ref

  return { isConnected, error };
}
