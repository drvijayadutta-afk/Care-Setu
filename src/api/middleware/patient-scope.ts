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
    if (config.patientScopeNoEnforce) {
      // Log-only mode — only allowed in local dev via PATIENT_SCOPE_NO_ENFORCE=true.
      console.warn(
        `[patient-scope] WOULD DENY (enforcement disabled): coordinator=${user.sub} patient=${id} owner=${patient.assignedCoordinatorId ?? "unassigned"}`
      );
    } else {
      reply.status(403).send({ error: "Forbidden" });
    }
  }
}
