"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsManager = void 0;
class WebSocketManager {
    constructor() {
        this.connections = new Map();
    }
    subscribe(patientId, ws) {
        if (!this.connections.has(patientId)) {
            this.connections.set(patientId, new Set());
        }
        this.connections.get(patientId).add(ws);
        console.log(`WebSocket: Client subscribed to patient ${patientId}`);
        ws.on('close', () => {
            this.unsubscribe(patientId, ws);
        });
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.unsubscribe(patientId, ws);
        });
    }
    unsubscribe(patientId, ws) {
        const connections = this.connections.get(patientId);
        if (connections) {
            connections.delete(ws);
            if (connections.size === 0) {
                this.connections.delete(patientId);
            }
        }
        console.log(`WebSocket: Client unsubscribed from patient ${patientId}`);
    }
    broadcast(patientId, event) {
        const connections = this.connections.get(patientId);
        if (!connections)
            return;
        const message = JSON.stringify(event);
        const deadConnections = [];
        connections.forEach((ws) => {
            if (ws.readyState === 1) { // WebSocket.OPEN
                ws.send(message, (error) => {
                    if (error) {
                        console.error('WebSocket send error:', error);
                        deadConnections.push(ws);
                    }
                });
            }
            else {
                deadConnections.push(ws);
            }
        });
        // Clean up dead connections
        deadConnections.forEach(ws => this.unsubscribe(patientId, ws));
    }
    broadcastToAll(event) {
        this.connections.forEach((connections) => {
            const message = JSON.stringify(event);
            connections.forEach((ws) => {
                if (ws.readyState === 1) {
                    ws.send(message);
                }
            });
        });
    }
    getConnectionCount(patientId) {
        if (patientId) {
            return this.connections.get(patientId)?.size || 0;
        }
        return Array.from(this.connections.values()).reduce((sum, set) => sum + set.size, 0);
    }
}
exports.wsManager = new WebSocketManager();
//# sourceMappingURL=manager.js.map