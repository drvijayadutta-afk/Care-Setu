import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";

interface CreateLabResultBody {
  testDate: string;
  reportedAt?: string;
  category: string;
  testName: string;
  value?: number;
  unit?: string;
  refMin?: number;
  refMax?: number;
  isAbnormal?: boolean;
  flag?: string;
  rawText?: string;
  cycleNumber?: number;
  cycleDay?: number;
  orderedBy?: string;
  source?: string;
  documentId?: string;
  notes?: string;
}

interface UpdateLabResultBody {
  value?: number;
  flag?: string;
  isAbnormal?: boolean;
  notes?: string;
}

export function registerLabRoutes(fastify: FastifyInstance, auth: any[]) {
  // List lab results (with optional category filter)
  fastify.get("/patients/:id/lab-results", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { category } = request.query as { category?: string };
    return prisma.labResult.findMany({
      where: { patientId: id, isDeleted: false, ...(category ? { category } : {}) },
      orderBy: { testDate: "desc" },
    });
  });

  // Create single lab result
  fastify.post("/patients/:id/lab-results", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as CreateLabResultBody;
    return prisma.labResult.create({
      data: {
        patientId: id,
        testDate: new Date(body.testDate),
        reportedAt: body.reportedAt ? new Date(body.reportedAt) : null,
        category: body.category,
        testName: body.testName,
        value: body.value != null ? parseFloat(String(body.value)) : null,
        unit: body.unit ?? null,
        refMin: body.refMin != null ? parseFloat(String(body.refMin)) : null,
        refMax: body.refMax != null ? parseFloat(String(body.refMax)) : null,
        isAbnormal: body.isAbnormal ?? false,
        flag: body.flag ?? null,
        rawText: body.rawText ?? null,
        cycleNumber: body.cycleNumber ?? null,
        cycleDay: body.cycleDay ?? null,
        orderedBy: body.orderedBy ?? null,
        source: body.source ?? "manual",
        documentId: body.documentId ?? null,
        notes: body.notes ?? null,
      },
    });
  });

  // Bulk create lab results
  fastify.post("/patients/:id/lab-results/bulk", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { results } = request.body as { results: CreateLabResultBody[] };
    const created = await prisma.$transaction(
      results.map((r) =>
        prisma.labResult.create({
          data: {
            patientId: id,
            testDate: new Date(r.testDate),
            category: r.category,
            testName: r.testName,
            value: r.value != null ? parseFloat(String(r.value)) : null,
            unit: r.unit ?? null,
            refMin: r.refMin != null ? parseFloat(String(r.refMin)) : null,
            refMax: r.refMax != null ? parseFloat(String(r.refMax)) : null,
            isAbnormal: r.isAbnormal ?? false,
            flag: r.flag ?? null,
            rawText: r.rawText ?? null,
            source: r.source ?? "manual",
          },
        })
      )
    );
    return { created: created.length };
  });

  // Update lab result
  fastify.patch("/lab-results/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as UpdateLabResultBody;
    return prisma.labResult.update({
      where: { id },
      data: {
        ...(body.value != null && { value: parseFloat(String(body.value)) }),
        ...(body.flag !== undefined && { flag: body.flag }),
        ...(body.isAbnormal !== undefined && { isAbnormal: body.isAbnormal }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });
  });

  // Soft delete lab result
  fastify.delete("/lab-results/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.labResult.update({ where: { id }, data: { isDeleted: true } });
    return { ok: true };
  });
}
