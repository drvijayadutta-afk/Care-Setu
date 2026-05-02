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

  // Create ExtractedRecordDraft instead of auto-creating records (requires coordinator approval)
  if (["LAB_REPORT", "IMAGING", "PATHOLOGY"].includes(doc.category)) {
    const draft = await prisma.extractedRecordDraft.create({
      data: {
        patientId: doc.patientId,
        documentId: id,
        category: doc.category,
        extractedData: extracted as any,
        status: "pending",
      },
    });
    return { extracted, draftId: draft.id };
  }

  return { extracted, draftId: null };
}
