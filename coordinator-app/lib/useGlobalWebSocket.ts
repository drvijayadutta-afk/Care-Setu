'use client';

import { useEffect, useRef } from 'react';
import { getWsTicket } from './api';

export type ActivityKind = 'checkin' | 'alert' | 'document_uploaded' | 'outbound_message' | 'referral' | 'appointment';

export type GlobalWSEvent =
  | { type: 'activity'; patientId: string; patientName: string; eventKind: ActivityKind; summary: string; severity?: string; timestamp: string }
  | { type: 'alert_badge'; patientId: string; severity: string; alertType: string; timestamp: string }
  | { type: 'connection'; message: string; timestamp: string }
  | { type: 'pong'; timestamp: string };

export function useGlobalWebSocket(onEvent: (event: GlobalWSEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let unmounted = false;

    async function connect() {
      if (unmounted) return;

      let ticket: string;
      try {
        ticket = await getWsTicket();
      } catch {
        // Not authenticated yet — try again later
        if (!unmounted) setTimeout(connect, 3000);
        return;
      }
      if (unmounted) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://care-setu-backend.onrender.com';
      const wsUrl = apiUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');

      ws = new WebSocket(`${wsUrl}/ws/global?token=${encodeURIComponent(ticket)}`);

      ws.onopen = () => {
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30_000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as GlobalWSEvent;
          onEventRef.current(data);
        } catch {}
      };

      ws.onclose = () => {
        if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
        if (!unmounted) setTimeout(connect, 3000);
      };

      ws.onerror = () => ws?.close();
    }

    connect();

    return () => {
      unmounted = true;
      if (pingInterval) clearInterval(pingInterval);
      ws?.close();
    };
  }, []);
}
