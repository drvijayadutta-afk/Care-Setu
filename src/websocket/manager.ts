import { WebSocket } from 'ws';

export type WSEvent =
  | { type: 'message'; patientId: string; conversationId: string; content: string; role: 'patient' | 'assistant' }
  | { type: 'appointment'; patientId: string; appointmentId: string; action: 'created' | 'updated'; status: string }
  | { type: 'checkin'; patientId: string; checkinId: string; symptomScore: number }
  | { type: 'patient_status'; patientId: string; status: 'online' | 'offline'; lastSeen: string }
  | { type: 'alert'; patientId: string; alertId: string; severity: string; message: string; alertType: string }
  | { type: 'document_uploaded'; patientId: string; documentId: string; category: string; title: string }
  | { type: 'tumor-board'; patientId: string; meetingId: string; action: 'created' | 'updated' | 'signed-off'; title: string };

export type ActivityKind = 'checkin' | 'alert' | 'document_uploaded' | 'outbound_message' | 'referral' | 'appointment';

export type GlobalWSEvent =
  | { type: 'activity'; patientId: string; patientName: string; eventKind: ActivityKind; summary: string; severity?: string; timestamp: string }
  | { type: 'alert_badge'; patientId: string; severity: string; alertType: string; timestamp: string }
  | { type: 'global_ping' };

// Throttle tracking — suppress duplicate global events within 5s per patientId+eventKind
const throttleMap = new Map<string, number>();

class WebSocketManager {
  private connections: Map<string, Set<WebSocket>> = new Map();
  private globalConnections: Set<WebSocket> = new Set();

  subscribe(patientId: string, ws: WebSocket) {
    if (!this.connections.has(patientId)) {
      this.connections.set(patientId, new Set());
    }
    this.connections.get(patientId)!.add(ws);
    console.log(`WebSocket: Client subscribed to patient ${patientId}`);

    ws.on('close', () => {
      this.unsubscribe(patientId, ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.unsubscribe(patientId, ws);
    });
  }

  unsubscribe(patientId: string, ws: WebSocket) {
    const connections = this.connections.get(patientId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        this.connections.delete(patientId);
      }
    }
    console.log(`WebSocket: Client unsubscribed from patient ${patientId}`);
  }

  broadcast(patientId: string, event: WSEvent) {
    const connections = this.connections.get(patientId);
    if (!connections) return;

    const message = JSON.stringify(event);
    const deadConnections: WebSocket[] = [];

    connections.forEach((ws) => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(message, (error) => {
          if (error) {
            console.error('WebSocket send error:', error);
            deadConnections.push(ws);
          }
        });
      } else {
        deadConnections.push(ws);
      }
    });

    // Clean up dead connections
    deadConnections.forEach(ws => this.unsubscribe(patientId, ws));
  }

  subscribeGlobal(ws: WebSocket) {
    this.globalConnections.add(ws);
    ws.on('close', () => this.globalConnections.delete(ws));
    ws.on('error', () => this.globalConnections.delete(ws));
  }

  broadcastGlobal(event: GlobalWSEvent) {
    // Throttle activity events to once per 5s per patientId+eventKind
    if (event.type === 'activity') {
      const key = `${event.patientId}:${event.eventKind}`;
      const last = throttleMap.get(key) ?? 0;
      if (Date.now() - last < 5000) return;
      throttleMap.set(key, Date.now());
    }

    const message = JSON.stringify(event);
    const dead: WebSocket[] = [];
    this.globalConnections.forEach(ws => {
      if (ws.readyState === 1) {
        ws.send(message, err => { if (err) dead.push(ws); });
      } else {
        dead.push(ws);
      }
    });
    dead.forEach(ws => this.globalConnections.delete(ws));
  }

  broadcastToAll(event: WSEvent & { type: 'patient_status' }) {
    this.connections.forEach((connections) => {
      const message = JSON.stringify(event);
      connections.forEach((ws) => {
        if (ws.readyState === 1) {
          ws.send(message);
        }
      });
    });
  }

  getConnectionCount(patientId?: string): number {
    if (patientId) {
      return this.connections.get(patientId)?.size || 0;
    }
    return Array.from(this.connections.values()).reduce((sum, set) => sum + set.size, 0);
  }
}

export const wsManager = new WebSocketManager();
