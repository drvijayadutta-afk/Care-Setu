import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";

interface CreateImagingBody {
  studyDate: string;
  reportedAt?: string;
  modality: string;
  bodyPart: string;
  indication?: string;
  findings?: string;
  impression?: string;
  response?: string;
  radiologist?: string;
  referenceId?: string;
  documentId?: string;
  source?: string;
  notes?: string;
}

interface UpdateImagingBody {
  findings?: string;
  impression?: string;
  response?: string;
  notes?: string;
}

export function registerImagingRoutes(fastify: FastifyInstance, auth: any[]) {
  fastify.get("/patients/:id/imaging", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return prisma.imagingReport.findMany({
      where: { patientId: id },
      orderBy: { studyDate: "desc" },
    });
  });

  fastify.post("/patients/:id/imaging", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as CreateImagingBody;
    return prisma.imagingReport.create({
      data: {
        patientId: id,
        studyDate: new Date(body.studyDate),
        reportedAt: body.reportedAt ? new Date(body.reportedAt) : null,
        modality: body.modality,
        bodyPart: body.bodyPart,
        indication: body.indication ?? null,
        findings: body.findings ?? null,
        impression: body.impression ?? null,
        response: body.response ?? null,
        radiologist: body.radiologist ?? null,
        referenceId: body.referenceId ?? null,
        documentId: body.documentId ?? null,
        source: body.source ?? "manual",
        notes: body.notes ?? null,
      },
    });
  });

  fastify.patch("/imaging/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as UpdateImagingBody;
    return prisma.imagingReport.update({
      where: { id },
      data: {
        ...(body.findings !== undefined && { findings: body.findings }),
        ...(body.impression !== undefined && { impression: body.impression }),
        ...(body.response !== undefined && { response: body.response }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });
  });
}
