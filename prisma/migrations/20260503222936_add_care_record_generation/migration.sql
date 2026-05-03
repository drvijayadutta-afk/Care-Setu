-- DropIndex
DROP INDEX "AlertDelivery_alertId_idx";

-- DropIndex
DROP INDEX "AlertDelivery_status_idx";

-- DropIndex
DROP INDEX "CareTeamMember_doctorId_idx";

-- DropIndex
DROP INDEX "TumorBoardMeeting_patientId_idx";

-- DropIndex
DROP INDEX "TumorBoardMeeting_scheduledAt_idx";

-- DropIndex
DROP INDEX "TumorBoardParticipant_meetingId_idx";

-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "qualifications" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Referral" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "CareRecordGeneration" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "jsonHash" TEXT NOT NULL,
    "storageKey" TEXT,
    "emailSentTo" TEXT,
    "rowCount" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareRecordGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CareRecordGeneration_patientId_generatedAt_idx" ON "CareRecordGeneration"("patientId", "generatedAt");

-- CreateIndex
CREATE INDEX "CareRecordGeneration_doctorId_idx" ON "CareRecordGeneration"("doctorId");

-- AddForeignKey
ALTER TABLE "CareRecordGeneration" ADD CONSTRAINT "CareRecordGeneration_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareRecordGeneration" ADD CONSTRAINT "CareRecordGeneration_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
