import { prisma } from "../../db/client";
import type { IRecordRepository } from "../../repositories/types";

export async function approveExtractionDraft(
  draftId: string,
  recordRepo: IRecordRepository,
  reviewedBy: string
) {
  const draft = await prisma.extractedRecordDraft.findUnique({
    where: { id: draftId },
  });

  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "pending") throw new Error("Draft has already been reviewed");

  // Mark draft as approved
  await prisma.extractedRecordDraft.update({
    where: { id: draftId },
    data: {
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy,
    },
  });

  // Auto-create structured records from approved draft
  const extracted = draft.extractedData as any;

  if (draft.category === "LAB_REPORT" && Array.isArray(extracted)) {
    for (const r of extracted) {
      await recordRepo.labResults.create({
        patientId: draft.patientId,
        testDate: r.testDate ? new Date(r.testDate) : new Date(draft.createdAt),
        category: r.category ?? "OTHER",
        testName: r.testName,
        value: r.value != null ? parseFloat(r.value) : null,
        unit: r.unit ?? null,
        refMin: r.refMin != null ? parseFloat(r.refMin) : null,
        refMax: r.refMax != null ? parseFloat(r.refMax) : null,
        isAbnormal: r.isAbnormal ?? false,
        flag: r.flag ?? null,
        rawText: r.rawText ?? null,
        source: "pdf_extract",
        documentId: draft.documentId,
      });
    }
  } else if (draft.category === "IMAGING") {
    const r = extracted;
    await recordRepo.imaging.create({
      patientId: draft.patientId,
      studyDate: r.studyDate ? new Date(r.studyDate) : new Date(draft.createdAt),
      modality: r.modality ?? "UNKNOWN",
      bodyPart: r.bodyPart ?? "UNKNOWN",
      indication: r.indication ?? null,
      findings: r.findings ?? null,
      impression: r.impression ?? null,
      source: "pdf_extract",
      documentId: draft.documentId,
    });
  } else if (draft.category === "PATHOLOGY") {
    const r = extracted;
    await recordRepo.pathology.create({
      patientId: draft.patientId,
      reportDate: r.reportDate ? new Date(r.reportDate) : new Date(draft.createdAt),
      specimenType: r.specimenType ?? "BIOPSY",
      site: r.site ?? "UNKNOWN",
      diagnosis: r.diagnosis ?? "See report",
      grade: r.grade ?? null,
      stage: r.stage ?? null,
      ihcFindings: r.ihcFindings ?? null,
      molecularTests: r.molecularTests ?? null,
      source: "pdf_extract",
      documentId: draft.documentId,
    });
  }

  return { ok: true };
}

export async function rejectExtractionDraft(
  draftId: string,
  reason: string,
  reviewedBy: string
) {
  const draft = await prisma.extractedRecordDraft.findUnique({
    where: { id: draftId },
  });

  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "pending") throw new Error("Draft has already been reviewed");

  await prisma.extractedRecordDraft.update({
    where: { id: draftId },
    data: {
      status: "rejected",
      rejectionReason: reason,
      reviewedAt: new Date(),
      reviewedBy,
    },
  });

  return { ok: true };
}
