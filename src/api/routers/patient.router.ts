import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";
import { sendMessage as sendAisensyMessage } from "../../integrations/aisensy";
import { wsManager } from "../../websocket/manager";

interface SendMessageBody { message: string }
interface CreateAppointmentBody {
  type: string;
  scheduledAt: string;
  notes?: string;
  status?: string;
  doctorName?: string;
  hospitalName?: string;
}
interface UpdateAppointmentBody {
  type?: string;
  scheduledAt?: string;
  notes?: string;
  status?: string;
}

export function registerPatientRoutes(fastify: FastifyInstance, auth: any[]) {
  // List patients
  fastify.get("/patients", { preHandler: auth }, async (request, reply) => {
    try {
      return await prisma.patient.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    } catch (error) {
      console.error("Error fetching patients:", error);
      return reply.status(500).send({ error: "Failed to fetch patients" });
    }
  });

  // Single patient
  fastify.get("/patients/:id", { preHandler: auth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const patient = await prisma.patient.findUnique({ where: { id } });
      if (!patient) return reply.status(404).send({ error: "Patient not found" });
      return patient;
    } catch (error) {
      console.error("Error fetching patient:", error);
      return reply.status(500).send({ error: "Failed to fetch patient" });
    }
  });

  // Conversations
  fastify.get("/patients/:id/conversations", { preHandler: auth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return await prisma.conversation.findMany({
        where: { patientId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    } catch (error) {
      console.error("Error fetching conversations:", error);
      return reply.status(500).send({ error: "Failed to fetch conversations" });
    }
  });

  // Check-ins
  fastify.get("/patients/:id/checkins", { preHandler: auth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return await prisma.checkin.findMany({
        where: { patientId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    } catch (error) {
      console.error("Error fetching checkins:", error);
      return reply.status(500).send({ error: "Failed to fetch checkins" });
    }
  });

  // Appointments list
  fastify.get("/patients/:id/appointments", { preHandler: auth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return await prisma.appointment.findMany({
        where: { patientId: id },
        orderBy: { scheduledAt: "desc" },
        take: 50,
      });
    } catch (error) {
      console.error("Error fetching appointments:", error);
      return reply.status(500).send({ error: "Failed to fetch appointments" });
    }
  });

  // Send message
  fastify.post("/patients/:id/send-message", { preHandler: auth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { message } = request.body as SendMessageBody;

      if (!message || message.trim().length === 0) {
        return reply.status(400).send({ error: "Message cannot be empty" });
      }

      const patient = await prisma.patient.findUnique({ where: { id } });
      if (!patient) return reply.status(404).send({ error: "Patient not found" });

      const messageId = await sendAisensyMessage(patient.whatsappNumber, message);
      if (!messageId) return reply.status(500).send({ error: "Failed to send message via WhatsApp" });

      const conversation = await prisma.conversation.create({
        data: { patientId: id, role: "assistant", content: message, messageType: "text" },
      });

      wsManager.broadcast(id, {
        type: "message",
        patientId: id,
        conversationId: conversation.id,
        content: message,
        role: "assistant",
      });

      return { success: true, conversationId: conversation.id, messageId };
    } catch (error) {
      console.error("Error sending message:", error);
      return reply.status(500).send({ error: "Failed to send message" });
    }
  });

  // Create appointment
  fastify.post("/patients/:id/appointments", { preHandler: auth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { type, scheduledAt, notes, status, doctorName, hospitalName } =
        request.body as CreateAppointmentBody;

      const patient = await prisma.patient.findUnique({ where: { id } });
      if (!patient) return reply.status(404).send({ error: "Patient not found" });

      const appointment = await prisma.appointment.create({
        data: {
          patientId: id,
          type,
          scheduledAt: new Date(scheduledAt),
          notes: notes ?? null,
          status: (status as any) ?? "pending",
          doctorName: doctorName ?? "TBD",
          hospitalName: hospitalName ?? "TBD",
        },
      });

      wsManager.broadcast(id, {
        type: "appointment",
        patientId: id,
        appointmentId: appointment.id,
        action: "created",
        status: appointment.status,
      });

      return appointment;
    } catch (error) {
      console.error("Error creating appointment:", error);
      return reply.status(500).send({ error: "Failed to create appointment" });
    }
  });

  // Update appointment
  fastify.patch("/appointments/:id", { preHandler: auth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { type, scheduledAt, notes, status } = request.body as UpdateAppointmentBody;

      const appointment = await prisma.appointment.update({
        where: { id },
        data: {
          ...(type && { type }),
          ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
          ...(notes !== undefined && { notes }),
          ...(status && { status: status as any }),
        },
      });

      wsManager.broadcast(appointment.patientId, {
        type: "appointment",
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        action: "updated",
        status: appointment.status,
      });

      return appointment;
    } catch (error) {
      console.error("Error updating appointment:", error);
      return reply.status(500).send({ error: "Failed to update appointment" });
    }
  });
}
