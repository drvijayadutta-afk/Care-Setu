-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "repliedAt" TIMESTAMP(3),
ADD COLUMN     "replyDoctorId" TEXT,
ADD COLUMN     "suggestedReply" TEXT,
ADD COLUMN     "triageCategory" TEXT,
ADD COLUMN     "triageUrgency" TEXT,
ADD COLUMN     "triagedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Conversation_patientId_triageCategory_createdAt_idx" ON "Conversation"("patientId", "triageCategory", "createdAt");
