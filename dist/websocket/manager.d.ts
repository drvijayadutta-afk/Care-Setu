import { WebSocket } from 'ws';
export type WSEvent = {
    type: 'message';
    patientId: string;
    conversationId: string;
    content: string;
    role: 'patient' | 'assistant';
} | {
    type: 'appointment';
    patientId: string;
    appointmentId: string;
    action: 'created' | 'updated';
    status: string;
} | {
    type: 'checkin';
    patientId: string;
    checkinId: string;
    symptomScore: number;
} | {
    type: 'patient_status';
    patientId: string;
    status: 'online' | 'offline';
    lastSeen: string;
};
declare class WebSocketManager {
    private connections;
    subscribe(patientId: string, ws: WebSocket): void;
    unsubscribe(patientId: string, ws: WebSocket): void;
    broadcast(patientId: string, event: WSEvent): void;
    broadcastToAll(event: WSEvent & {
        type: 'patient_status';
    }): void;
    getConnectionCount(patientId?: string): number;
}
export declare const wsManager: WebSocketManager;
export {};
