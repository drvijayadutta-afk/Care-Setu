import type { FastifyInstance } from "fastify";
import type { IRecordRepository } from "../../repositories/types";
import { wsManager } from "../../websocket/manager";

export function registerAppointmentRoutes(
  fastify: FastifyInstance,
  recordRepo: IRecordRepository
) {
  const auth = [(fastify as any).authenticate];
  const authScope = [...auth, (fastify as any).requirePatientAccess];

  fastify.post(
    "/patients/:id/appointments",
    { preHandler: authScope },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const {
        appointmentDate,
        appointmentType,
        doctorName,
        location,
        notes,
      } = request.body as any;

      if (!appointmentDate || !appointmentType) {
        return reply
          .status(400)
          .send({ error: "appointmentDate and appointmentType are required" });
      }

      const appointment = await recordRepo.appointments.create({
        patientId: id,
        scheduledAt: new Date(appointmentDate),
        appointmentType,
        doctorName: doctorName ?? null,
        location: location ?? null,
        notes: notes ?? null,
      });

      wsManager.broadcast(id, {
        type: "appointment",
        patientId: id,
        appointmentId: appointment.id,
        action: "created",
        status: "scheduled",
      });

      return appointment;
    }
  );

  fastify.get("/patients/:id/appointments", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return await recordRepo.appointments.findMany(id);
  });

  fastify.patch(
    "/appointments/:id",
    { preHandler: auth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { appointmentDate, appointmentType, doctorName, location, notes, status } =
        request.body as any;

      const appointment = await recordRepo.appointments.findUnique(id);
      if (!appointment) {
        return reply.status(404).send({ error: "Appointment not found" });
      }

      const updated = await recordRepo.appointments.update(id, {
        ...(appointmentDate && { scheduledAt: new Date(appointmentDate) }),
        ...(appointmentType && { appointmentType }),
        ...(doctorName !== undefined && { doctorName }),
        ...(location !== undefined && { location }),
        ...(notes !== undefined && { notes }),
        ...(status && { status }),
      });

      wsManager.broadcast(appointment.patientId, {
        type: "appointment",
        patientId: appointment.patientId,
        appointmentId: updated.id,
        action: "updated",
        status: updated.status || "scheduled",
      });

      return updated;
    }
  );
}
