import { prisma } from "../../db/client";
import type { IRecordRepository } from "../../repositories/types";
import type { AiPort } from "../../ports/ai";

export async function extractDocument(id: string, recordRepo: IRecordRepository, aiPort: AiPort) {
  const doc = await prisma.patientDocument.findUnique({ where: { id } });
  if (!doc) throw new Error("Document not found");

  const extracted = await aiPort.extractDocument(doc.storagePath, doc.category, doc.fileType);

  await prisma.patientDocument.update({
    where: { id },
    data: { extractedData: extracted as any },
  });

  // Auto-create structured records from extraction
  if (doc.category === "LAB_REPORT" && Array.isArray(extracted)) {
    for (const r of extracted as any[]) {
      await recordRepo.labResults.create({
        patientId: doc.patientId,
        testDate: r.testDate ? new Date(r.testDate) : new Date(doc.createdAt),
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
        documentId: id,
      });
    }
  } else if (doc.category === "IMAGING") {
    const r = extracted as any;
    await recordRepo.imaging.create({
      patientId: doc.patientId,
      studyDate: r.studyDate ? new Date(r.studyDate) : new Date(doc.createdAt),
      modality: r.modality ?? "UNKNOWN",
      bodyPart: r.bodyPart ?? "UNKNOWN",
      indication: r.indication ?? null,
      findings: r.findings ?? null,
      impression: r.impression ?? null,
      source: "pdf_extract",
      documentId: id,
    });
  } else if (doc.category === "PATHOLOGY") {
    const r = extracted as any;
    await recordRepo.pathology.create({
      patientId: doc.patientId,
      reportDate: r.reportDate ? new Date(r.reportDate) : new Date(doc.createdAt),
      specimenType: r.specimenType ?? "BIOPSY",
      site: r.site ?? "UNKNOWN",
      diagnosis: r.diagnosis ?? "See report",
      grade: r.grade ?? null,
      stage: r.stage ?? null,
      ihcFindings: r.ihcFindings ?? null,
      molecularTests: r.molecularTests ?? null,
      source: "pdf_extract",
      documentId: id,
    });
  }

  return extracted;
}
