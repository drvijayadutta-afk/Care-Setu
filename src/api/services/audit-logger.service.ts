import { prisma } from "../../db/client";

export interface AuditParams {
  coordinatorId: string;
  patientId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  isOutOfScope: boolean;
  isCrossHospital: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export function logAccess(params: AuditParams): void {
  prisma.auditLog
    .create({ data: params })
    .catch((err) => console.error("[audit] write failed:", err));
}
