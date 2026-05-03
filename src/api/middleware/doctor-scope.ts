import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../db/client";
import { logAccess } from "../services/audit-logger.service";

/**
 * Middleware: requires that the caller is a DOCTOR (role='DOCTOR' in JWT).
 * For patient-scoped endpoints (`/doctor/patients/:id/...`), also verifies
 * the doctor is on the patient's CareTeamMember roster.
 *
 * Use as: { preHandler: [authenticate, requireDoctorAccess] }
 */
export async function requireDoctorAccess(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = (request as any).user as {
    sub: string;
    doctorId?: string;
    role: string;
    hospitalName?: string;
  };

  if (user.role !== "DOCTOR" || !user.doctorId) {
    reply.status(403).send({ error: "Doctor access required" });
    return;
  }

  // If the route has a patient scope (`:id` param), verify the doctor's CareTeam membership
  const params = request.params as { id?: string; patientId?: string };
  const patientId = params.id ?? params.patientId;
  if (!patientId) return; // no patient scope on this route — DOCTOR role check is enough

  const membership = await prisma.careTeamMember.findFirst({
    where: { patientId, doctorId: user.doctorId, isActive: true },
    select: { id: true },
  });

  // Audit every patient access by a doctor
  logAccess({
    coordinatorId: user.sub, // DoctorUser.id — repurposing AuditLog.coordinatorId for any auth identity
    patientId,
    action: "doctor_patient_view",
    resourceType: "patient",
    resourceId: patientId,
    isOutOfScope: !membership,
    isCrossHospital: false,
    ipAddress: request.ip,
    userAgent: request.headers["user-agent"],
  });

  if (!membership) {
    reply.status(403).send({ error: "Not on patient's care team" });
    return;
  }
}
