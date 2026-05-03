-- CreateTable
CREATE TABLE "TumorBoardMeeting" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "mode" TEXT NOT NULL DEFAULT 'sync',
    "agenda" TEXT,
    "briefText" TEXT,
    "decision" JSONB,
    "consensusReached" BOOLEAN NOT NULL DEFAULT false,
    "meetingNotes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TumorBoardMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TumorBoardParticipant" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "attendanceStatus" TEXT NOT NULL DEFAULT 'invited',
    "comments" TEXT,
    "signedOff" BOOLEAN NOT NULL DEFAULT false,
    "signedOffAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TumorBoardParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertDelivery" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipientRef" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertDelivery_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TumorBoardMeeting" ADD CONSTRAINT "TumorBoardMeeting_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TumorBoardParticipant" ADD CONSTRAINT "TumorBoardParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "TumorBoardMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "TumorBoardMeeting_patientId_idx" ON "TumorBoardMeeting"("patientId");
CREATE INDEX "TumorBoardMeeting_scheduledAt_idx" ON "TumorBoardMeeting"("scheduledAt");
CREATE INDEX "TumorBoardParticipant_meetingId_idx" ON "TumorBoardParticipant"("meetingId");
CREATE INDEX "AlertDelivery_alertId_idx" ON "AlertDelivery"("alertId");
CREATE INDEX "AlertDelivery_status_idx" ON "AlertDelivery"("status");
