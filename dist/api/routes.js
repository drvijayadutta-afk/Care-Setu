"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerApiRoutes = registerApiRoutes;
const client_1 = require("../db/client");
const aisensy_1 = require("../integrations/aisensy");
const manager_1 = require("../websocket/manager");
async function registerApiRoutes(fastify) {
    // Get all patients
    fastify.get("/patients", async (request, reply) => {
        try {
            const patients = await client_1.prisma.patient.findMany({
                orderBy: { createdAt: "desc" },
                take: 50,
            });
            return patients;
        }
        catch (error) {
            console.error("Error fetching patients:", error);
            reply.status(500).send({ error: "Failed to fetch patients" });
        }
    });
    // Get single patient
    fastify.get("/patients/:id", async (request, reply) => {
        try {
            const { id } = request.params;
            const patient = await client_1.prisma.patient.findUnique({
                where: { id },
            });
            if (!patient) {
                return reply.status(404).send({ error: "Patient not found" });
            }
            return patient;
        }
        catch (error) {
            console.error("Error fetching patient:", error);
            reply.status(500).send({ error: "Failed to fetch patient" });
        }
    });
    // Get patient conversations
    fastify.get("/patients/:id/conversations", async (request, reply) => {
        try {
            const { id } = request.params;
            const conversations = await client_1.prisma.conversation.findMany({
                where: { patientId: id },
                orderBy: { createdAt: "desc" },
                take: 100,
            });
            return conversations;
        }
        catch (error) {
            console.error("Error fetching conversations:", error);
            reply.status(500).send({ error: "Failed to fetch conversations" });
        }
    });
    // Get patient check-ins
    fastify.get("/patients/:id/checkins", async (request, reply) => {
        try {
            const { id } = request.params;
            const checkins = await client_1.prisma.checkin.findMany({
                where: { patientId: id },
                orderBy: { createdAt: "desc" },
                take: 50,
            });
            return checkins;
        }
        catch (error) {
            console.error("Error fetching checkins:", error);
            reply.status(500).send({ error: "Failed to fetch checkins" });
        }
    });
    // Get patient appointments
    fastify.get("/patients/:id/appointments", async (request, reply) => {
        try {
            const { id } = request.params;
            const appointments = await client_1.prisma.appointment.findMany({
                where: { patientId: id },
                orderBy: { scheduledAt: "desc" },
                take: 50,
            });
            return appointments;
        }
        catch (error) {
            console.error("Error fetching appointments:", error);
            reply.status(500).send({ error: "Failed to fetch appointments" });
        }
    });
    // Send message to patient
    fastify.post("/patients/:id/send-message", async (request, reply) => {
        try {
            const { id } = request.params;
            const { message } = request.body;
            if (!message || message.trim().length === 0) {
                return reply.status(400).send({ error: "Message cannot be empty" });
            }
            const patient = await client_1.prisma.patient.findUnique({ where: { id } });
            if (!patient) {
                return reply.status(404).send({ error: "Patient not found" });
            }
            // Send via Aisensy
            const messageId = await (0, aisensy_1.sendMessage)(patient.whatsappNumber, message);
            if (!messageId) {
                return reply
                    .status(500)
                    .send({ error: "Failed to send message via WhatsApp" });
            }
            // Store message in conversations table
            const conversation = await client_1.prisma.conversation.create({
                data: {
                    patientId: id,
                    role: "assistant",
                    content: message,
                    messageType: "text",
                },
            });
            // Broadcast message event via WebSocket
            manager_1.wsManager.broadcast(id, {
                type: "message",
                patientId: id,
                conversationId: conversation.id,
                content: message,
                role: "assistant",
            });
            return {
                success: true,
                conversationId: conversation.id,
                messageId,
            };
        }
        catch (error) {
            console.error("Error sending message:", error);
            reply.status(500).send({ error: "Failed to send message" });
        }
    });
    // Create appointment
    fastify.post("/patients/:id/appointments", async (request, reply) => {
        try {
            const { id } = request.params;
            const { type, scheduledAt, notes, status, doctorName, hospitalName } = request.body;
            const patient = await client_1.prisma.patient.findUnique({ where: { id } });
            if (!patient) {
                return reply.status(404).send({ error: "Patient not found" });
            }
            const appointment = await client_1.prisma.appointment.create({
                data: {
                    patientId: id,
                    type,
                    scheduledAt: new Date(scheduledAt),
                    notes: notes || null,
                    status: status || "pending",
                    doctorName: doctorName || "TBD",
                    hospitalName: hospitalName || "TBD",
                },
            });
            // Broadcast appointment creation event via WebSocket
            manager_1.wsManager.broadcast(id, {
                type: "appointment",
                patientId: id,
                appointmentId: appointment.id,
                action: "created",
                status: appointment.status,
            });
            return appointment;
        }
        catch (error) {
            console.error("Error creating appointment:", error);
            reply.status(500).send({ error: "Failed to create appointment" });
        }
    });
    // Update appointment
    fastify.patch("/appointments/:id", async (request, reply) => {
        try {
            const { id } = request.params;
            const { type, scheduledAt, notes, status } = request.body;
            const appointment = await client_1.prisma.appointment.update({
                where: { id },
                data: {
                    ...(type && { type }),
                    ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
                    ...(notes !== undefined && { notes }),
                    ...(status && { status: status }),
                },
            });
            // Broadcast appointment update event via WebSocket
            manager_1.wsManager.broadcast(appointment.patientId, {
                type: "appointment",
                patientId: appointment.patientId,
                appointmentId: appointment.id,
                action: "updated",
                status: appointment.status,
            });
            return appointment;
        }
        catch (error) {
            console.error("Error updating appointment:", error);
            reply.status(500).send({ error: "Failed to update appointment" });
        }
    });
}
//# sourceMappingURL=routes.js.map