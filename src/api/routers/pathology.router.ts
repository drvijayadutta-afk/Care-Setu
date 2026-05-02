import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";

interface CreatePathologyBody {
  reportDate: string;
  specimenType: string;
  site: string;
  diagnosis: string;
  grade?: string;
  stage?: string;
  margins?: string;
  ihcFindings?: Record<string, string>;
  molecularTests?: Record<string, string>;
  pathologist?: string;
  labName?: string;
  referenceId?: string;
  documentId?: string;
  source?: string;
  notes?: string;
}

interface UpdatePathologyBody {
  diagnosis?: string;
  grade?: string;
  ihcFindings?: Record<string, string>;
  molecularTests?: Record<string, string>;
  notes?: string;
}

export function registerPathologyRoutes(fastify: FastifyInstance, auth: any[]) {
  fastify.get("/patients/:id/pathology", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return prisma.pathologyReport.findMany({
      where: { patientId: id },
      orderBy: { reportDate: "desc" },
    });
  });

  fastify.post("/patients/:id/pathology", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as CreatePathologyBody;
    return prisma.pathologyReport.create({
      data: {
        patientId: id,
        reportDate: new Date(body.reportDate),
        specimenType: body.specimenType,
        site: body.site,
        diagnosis: body.diagnosis,
        grade: body.grade ?? null,
        stage: body.stage ?? null,
        margins: body.margins ?? null,
        ihcFindings: body.ihcFindings ?? null,
        molecularTests: body.molecularTests ?? null,
        pathologist: body.pathologist ?? null,
        labName: body.labName ?? null,
        referenceId: body.referenceId ?? null,
        documentId: body.documentId ?? null,
        source: body.source ?? "manual",
        notes: body.notes ?? null,
      },
    });
  });

  fastify.patch("/pathology/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as UpdatePathologyBody;
    return prisma.pathologyReport.update({
      where: { id },
      data: {
        ...(body.diagnosis !== undefined && { diagnosis: body.diagnosis }),
        ...(body.grade !== undefined && { grade: body.grade }),
        ...(body.ihcFindings !== undefined && { ihcFindings: body.ihcFindings }),
        ...(body.molecularTests !== undefined && { molecularTests: body.molecularTests }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });
  });
}
