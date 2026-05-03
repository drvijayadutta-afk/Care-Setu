import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";

export function registerAuditRoutes(fastify: FastifyInstance) {
  const auth = [(fastify as any).authenticate];

  const requireAdmin = async (request: any, reply: any) => {
    if (request.user?.role !== "ADMIN") {
      return reply.status(403).send({ error: "ADMIN role required" });
    }
  };

  // Paginated audit log
  fastify.get("/admin/audit-log", { preHandler: [...auth, requireAdmin] }, async (request) => {
    const q = request.query as {
      coordinatorId?: string; patientId?: string; outOfScopeOnly?: string;
      from?: string; to?: string; limit?: string; cursor?: string;
    };
    const limit = Math.min(Number(q.limit ?? 50), 200);
    const where: any = {};
    if (q.coordinatorId) where.coordinatorId = q.coordinatorId;
    if (q.patientId) where.patientId = q.patientId;
    if (q.outOfScopeOnly === "true") where.isOutOfScope = true;
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) where.createdAt.gte = new Date(q.from);
      if (q.to)   where.createdAt.lte = new Date(q.to);
    }
    if (q.cursor) where.createdAt = { ...where.createdAt, lt: new Date(q.cursor) };

    return prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  });

  // Compliance summary (last 30 days)
  fastify.get("/admin/audit-log/summary", { preHandler: [...auth, requireAdmin] }, async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalAccesses30d, outOfScopeCount, crossHospitalCount, byCoordinator, byPatient] =
      await Promise.all([
        prisma.auditLog.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        prisma.auditLog.count({ where: { isOutOfScope: true, createdAt: { gte: thirtyDaysAgo } } }),
        prisma.auditLog.count({ where: { isCrossHospital: true, createdAt: { gte: thirtyDaysAgo } } }),
        prisma.auditLog.groupBy({
          by: ["coordinatorId"],
          where: { isOutOfScope: true, createdAt: { gte: thirtyDaysAgo } },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 10,
        }),
        prisma.auditLog.groupBy({
          by: ["patientId"],
          where: { createdAt: { gte: thirtyDaysAgo } },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 10,
        }),
      ]);

    // Resolve coordinator names
    const coordinatorIds = byCoordinator.map(r => r.coordinatorId);
    const coordinators = await prisma.coordinator.findMany({
      where: { id: { in: coordinatorIds } },
      select: { id: true, name: true },
    });
    const coordMap = Object.fromEntries(coordinators.map(c => [c.id, c.name]));

    // Resolve patient names
    const patientIds = byPatient.map(r => r.patientId);
    const patients = await prisma.patient.findMany({
      where: { id: { in: patientIds } },
      select: { id: true, name: true },
    });
    const patientMap = Object.fromEntries(patients.map(p => [p.id, p.name]));

    return {
      totalAccesses30d,
      outOfScopeCount,
      crossHospitalCount,
      flaggedCoordinators: byCoordinator.map(r => ({
        coordinatorId: r.coordinatorId,
        name: coordMap[r.coordinatorId] ?? "Unknown",
        count: r._count.id,
      })),
      topViewedPatients: byPatient.map(r => ({
        patientId: r.patientId,
        name: patientMap[r.patientId] ?? "Unknown",
        count: r._count.id,
      })),
    };
  });
}
