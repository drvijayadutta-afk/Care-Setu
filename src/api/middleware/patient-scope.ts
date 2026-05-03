import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../db/client";
import { config } from "../../config/env";

function logAuditAccess(params: {
  coordinatorId: string; patientId: string; action: string;
  isOutOfScope: boolean; isCrossHospital: boolean;
  ipAddress?: string; userAgent?: string;
}) {
  prisma.auditLog.create({ data: params })
    .catch(err => console.error("[audit] write failed:", err));
}

export async function requirePatientAccess(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  const user = (request as any).user as { sub: string; role: string; hospitalName?: string };

  // ADMIN role bypasses patient-scope checks but still logs the access
  if (user.role === "ADMIN") {
    logAuditAccess({
      coordinatorId: user.sub, patientId: id, action: "patient_view",
      isOutOfScope: false, isCrossHospital: false,
      ipAddress: request.ip, userAgent: request.headers["user-agent"],
    });
    return;
  }

  const patient = await prisma.patient.findUnique({
    where: { id },
    select: { assignedCoordinatorId: true, hospitalName: true },
  });

  if (!patient) {
    reply.status(404).send({ error: "Patient not found" });
    return;
  }

  const isOutOfScope = patient.assignedCoordinatorId !== user.sub;
  const isCrossHospital = !!(user.hospitalName && patient.hospitalName && patient.hospitalName !== user.hospitalName);

  // Fire-and-forget audit log — never blocks request
  logAuditAccess({
    coordinatorId: user.sub, patientId: id, action: "patient_view",
    isOutOfScope, isCrossHospital,
    ipAddress: request.ip, userAgent: request.headers["user-agent"],
  });

  if (isOutOfScope) {
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
