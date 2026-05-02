import type { FastifyInstance } from "fastify";
import type { IRecordRepository } from "../../repositories/types";
import { generateUploadUrl, generateDownloadUrl, deleteFile } from "../../integrations/supabase-storage";
import { extractDocument } from "../services/extract-document.service";
import { prisma } from "../../db/client";

export function registerRecordRoutes(
  fastify: FastifyInstance,
  recordRepo: IRecordRepository
) {
  const auth = [(fastify as any).authenticate];
  const authScope = [...auth, (fastify as any).requirePatientAccess];

  // ─── Lab Results ──────────────────────────────────────────────────────────
  fastify.get("/patients/:id/lab-results", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return await recordRepo.labResults.findMany(id);
  });

  fastify.post("/patients/:id/lab-results", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return await recordRepo.labResults.create({
      patientId: id,
      testDate: new Date(body.testDate),
      reportedAt: body.reportedAt ? new Date(body.reportedAt) : null,
      category: body.category,
      testName: body.testName,
      value: body.value != null ? parseFloat(body.value) : null,
      unit: body.unit ?? null,
      refMin: body.refMin != null ? parseFloat(body.refMin) : null,
      refMax: body.refMax != null ? parseFloat(body.refMax) : null,
      isAbnormal: body.isAbnormal ?? false,
      flag: body.flag ?? null,
      rawText: body.rawText ?? null,
      cycleNumber: body.cycleNumber ?? null,
      cycleDay: body.cycleDay ?? null,
      orderedBy: body.orderedBy ?? null,
      source: body.source ?? "manual",
      documentId: body.documentId ?? null,
      notes: body.notes ?? null,
    });
  });

  fastify.post("/patients/:id/lab-results/bulk", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { results } = request.body as { results: any[] };
    const created = await prisma.$transaction(
      results.map((r) =>
        prisma.labResult.create({
          data: {
            patientId: id,
            testDate: new Date(r.testDate),
            category: r.category,
            testName: r.testName,
            value: r.value != null ? parseFloat(r.value) : null,
            unit: r.unit ?? null,
            refMin: r.refMin != null ? parseFloat(r.refMin) : null,
            refMax: r.refMax != null ? parseFloat(r.refMax) : null,
            isAbnormal: r.isAbnormal ?? false,
            flag: r.flag ?? null,
            rawText: r.rawText ?? null,
            cycleNumber: r.cycleNumber ?? null,
            cycleDay: r.cycleDay ?? null,
            orderedBy: r.orderedBy ?? null,
            source: r.source ?? "manual",
            documentId: r.documentId ?? null,
            notes: r.notes ?? null,
          },
        })
      )
    );
    return created;
  });

  fastify.patch("/lab-results/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return await recordRepo.labResults.update(id, {
      ...(body.testDate !== undefined && { testDate: new Date(body.testDate) }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.testName !== undefined && { testName: body.testName }),
      ...(body.value !== undefined && { value: body.value != null ? parseFloat(body.value) : null }),
      ...(body.unit !== undefined && { unit: body.unit }),
      ...(body.isAbnormal !== undefined && { isAbnormal: body.isAbnormal }),
      ...(body.flag !== undefined && { flag: body.flag }),
    });
  });

  fastify.delete("/lab-results/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await recordRepo.labResults.delete(id);
    return { ok: true };
  });

  // ─── Imaging ──────────────────────────────────────────────────────────────
  fastify.get("/patients/:id/imaging", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return await recordRepo.imaging.findMany(id);
  });

  fastify.post("/patients/:id/imaging", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return await recordRepo.imaging.create({
      patientId: id,
      studyDate: new Date(body.studyDate),
      modality: body.modality,
      bodyPart: body.bodyPart,
      indication: body.indication ?? null,
      findings: body.findings ?? null,
      impression: body.impression ?? null,
      source: body.source ?? "manual",
      documentId: body.documentId ?? null,
    });
  });

  fastify.patch("/imaging/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return await recordRepo.imaging.update(id, {
      ...(body.studyDate !== undefined && { studyDate: new Date(body.studyDate) }),
      ...(body.findings !== undefined && { findings: body.findings }),
      ...(body.impression !== undefined && { impression: body.impression }),
    });
  });

  fastify.delete("/imaging/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await recordRepo.imaging.delete(id);
    return { ok: true };
  });

  // ─── Pathology ───────────────────────────────────────────────────────────
  fastify.get("/patients/:id/pathology", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return await recordRepo.pathology.findMany(id);
  });

  fastify.post("/patients/:id/pathology", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return await recordRepo.pathology.create({
      patientId: id,
      reportDate: new Date(body.reportDate),
      specimenType: body.specimenType ?? "BIOPSY",
      site: body.site,
      diagnosis: body.diagnosis,
      grade: body.grade ?? null,
      stage: body.stage ?? null,
      ihcFindings: body.ihcFindings ?? null,
      molecularTests: body.molecularTests ?? null,
      source: body.source ?? "manual",
      documentId: body.documentId ?? null,
    });
  });

  fastify.patch("/pathology/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return await recordRepo.pathology.update(id, {
      ...(body.diagnosis !== undefined && { diagnosis: body.diagnosis }),
      ...(body.grade !== undefined && { grade: body.grade }),
      ...(body.stage !== undefined && { stage: body.stage }),
    });
  });

  fastify.delete("/pathology/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await recordRepo.pathology.delete(id);
    return { ok: true };
  });

  // ─── Vitals ──────────────────────────────────────────────────────────────
  fastify.get("/patients/:id/vitals", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return await recordRepo.vitals.findMany(id);
  });

  fastify.post("/patients/:id/vitals", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return await recordRepo.vitals.create({
      patientId: id,
      recordedAt: new Date(body.recordedAt),
      systemicBP: body.systemicBP ?? null,
      diastolicBP: body.diastolicBP ?? null,
      heartRate: body.heartRate ?? null,
      temperature: body.temperature ?? null,
      respiratoryRate: body.respiratoryRate ?? null,
      oxygenSaturation: body.oxygenSaturation ?? null,
      weight: body.weight ?? null,
      height: body.height ?? null,
      notes: body.notes ?? null,
    });
  });

  fastify.patch("/vitals/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return await recordRepo.vitals.update(id, {
      ...(body.systemicBP !== undefined && { systemicBP: body.systemicBP }),
      ...(body.diastolicBP !== undefined && { diastolicBP: body.diastolicBP }),
      ...(body.heartRate !== undefined && { heartRate: body.heartRate }),
      ...(body.temperature !== undefined && { temperature: body.temperature }),
      ...(body.weight !== undefined && { weight: body.weight }),
    });
  });

  fastify.delete("/vitals/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await recordRepo.vitals.delete(id);
    return { ok: true };
  });

  // ─── Clinical Notes ──────────────────────────────────────────────────────
  fastify.get("/patients/:id/clinical-notes", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return await recordRepo.notes.findMany(id);
  });

  fastify.post("/patients/:id/clinical-notes", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return await recordRepo.notes.create({
      patientId: id,
      noteDate: new Date(body.noteDate),
      noteType: body.noteType ?? "GENERAL",
      content: body.content,
      createdBy: body.createdBy ?? null,
    });
  });

  fastify.patch("/clinical-notes/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return await recordRepo.notes.update(id, {
      ...(body.content !== undefined && { content: body.content }),
      ...(body.noteType !== undefined && { noteType: body.noteType }),
    });
  });

  fastify.delete("/clinical-notes/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await recordRepo.notes.delete(id);
    return { ok: true };
  });

  // ─── Documents ───────────────────────────────────────────────────────────
  fastify.post("/patients/:id/documents/upload-url", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { category, fileType, title, description } = request.body as {
      category: string;
      fileType: string;
      title: string;
      description?: string;
    };

    const docId = crypto.randomUUID();
    const storagePath = `${id}/${category.toLowerCase()}/${docId}.${fileType}`;
    const { uploadUrl } = await generateUploadUrl(storagePath, fileType);

    const doc = await recordRepo.documents.create({
      id: docId,
      patientId: id,
      category,
      title,
      description: description ?? null,
      storagePath,
      fileType,
      tags: [],
    });

    return { uploadUrl, documentId: doc.id };
  });

  fastify.get("/patients/:id/documents", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return await recordRepo.documents.findMany(id);
  });

  fastify.patch("/documents/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return await recordRepo.documents.update(id, {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.documentDate !== undefined && { documentDate: new Date(body.documentDate) }),
      ...(body.fileSizeBytes !== undefined && { fileSizeBytes: body.fileSizeBytes }),
      ...(body.isVerified !== undefined && { isVerified: body.isVerified }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(body.uploadedBy !== undefined && { uploadedBy: body.uploadedBy }),
    });
  });

  fastify.get("/documents/:id/download-url", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = await prisma.patientDocument.findUnique({
      where: { id },
      select: { storagePath: true, fileType: true, title: true },
    });
    if (!doc) return reply.status(404).send({ error: "Document not found" });
    const { downloadUrl } = await generateDownloadUrl(doc.storagePath);
    return { downloadUrl, title: doc.title, fileType: doc.fileType };
  });

  fastify.delete("/documents/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = await prisma.patientDocument.findUnique({ where: { id } });
    if (!doc) return reply.status(404).send({ error: "Document not found" });
    await deleteFile(doc.storagePath);
    await recordRepo.documents.delete(id);
    return { ok: true };
  });

  fastify.post("/documents/:id/extract", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const extracted = await extractDocument(id, recordRepo);
      return { ok: true, extracted };
    } catch (error: any) {
      if (error.message === "Document not found") {
        return reply.status(404).send({ error: "Document not found" });
      }
      throw error;
    }
  });

  // ─── Care Team ───────────────────────────────────────────────────────────
  fastify.get("/patients/:id/care-team", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return await recordRepo.careTeam.findMany(id);
  });

  fastify.post("/patients/:id/care-team", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return await recordRepo.careTeam.create({
      patientId: id,
      name: body.name,
      role: body.role ?? "SUPPORT",
      specialty: body.specialty ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      hospital: body.hospital ?? null,
      isActive: body.isActive ?? true,
    });
  });

  fastify.patch("/care-team/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return await recordRepo.careTeam.update(id, {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.role !== undefined && { role: body.role }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    });
  });

  fastify.delete("/care-team/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await recordRepo.careTeam.delete(id);
    return { ok: true };
  });
}
