import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../db/client";
import { config } from "../../config/env";

export async function requirePatientAccess(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  const user = (request as any).user as { sub: string; role: string };

  // ADMIN role bypasses all patient-scope checks
  if (user.role === "ADMIN") return;

  const patient = await prisma.patient.findUnique({
    where: { id },
    select: { assignedCoordinatorId: true },
  });

  if (!patient) {
    reply.status(404).send({ error: "Patient not found" });
    return;
  }

  const allowed = patient.assignedCoordinatorId === user.sub;
  if (!allowed) {
    if (config.patientScopeEnforce) {
      reply.status(403).send({ error: "Forbidden" });
    } else {
      // Log-only mode: warn but let the request through during rollout week.
      // Flip PATIENT_SCOPE_ENFORCE=true once backfill + coordinator UI ship.
      console.warn(
        `[patient-scope] WOULD DENY: coordinator=${user.sub} patient=${id} owner=${patient.assignedCoordinatorId ?? "unassigned"}`
      );
    }
  }
}
