-- CreateTable
CREATE TABLE "ExtractedRecordDraft" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "extractedData" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractedRecordDraft_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ExtractedRecordDraft" ADD CONSTRAINT "ExtractedRecordDraft_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
