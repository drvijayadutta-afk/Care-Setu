import type { FastifyInstance } from "fastify";
import type { IPatientRepository, IConversationRepository } from "../../repositories/types";
import { sendMessage as sendAisensyMessage } from "../../integrations/aisensy";
import { wsManager } from "../../websocket/manager";

export function registerMessageRoutes(
  fastify: FastifyInstance,
  patientRepo: IPatientRepository,
  conversationRepo: IConversationRepository
) {
  const authScope = [(fastify as any).authenticate, (fastify as any).requirePatientAccess];

  fastify.post("/patients/:id/send-message", { preHandler: authScope }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { message } = request.body as { message: string };

      if (!message || message.trim().length === 0) {
        return reply.status(400).send({ error: "Message cannot be empty" });
      }

      const patient = await patientRepo.findUnique(id);
      if (!patient) {
        return reply.status(404).send({ error: "Patient not found" });
      }

      const messageId = await sendAisensyMessage(patient.whatsappNumber, message);

      if (!messageId) {
        return reply.status(500).send({ error: "Failed to send message via WhatsApp" });
      }

      const conversation = await conversationRepo.create({
        data: {
          patientId: id,
          role: "assistant",
          content: message,
          messageType: "text",
        },
      });

      wsManager.broadcast(id, {
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
    } catch (error) {
      console.error("Error sending message:", error);
      reply.status(500).send({ error: "Failed to send message" });
    }
  });
}
