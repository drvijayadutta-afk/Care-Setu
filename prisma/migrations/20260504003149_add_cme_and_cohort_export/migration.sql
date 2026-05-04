-- CreateTable
CREATE TABLE "CmeCredit" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "evidence" JSONB NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "year" INTEGER NOT NULL,

    CONSTRAINT "CmeCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortExport" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "cohortDef" JSONB NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "downloadKey" TEXT,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CmeCredit_doctorId_year_idx" ON "CmeCredit"("doctorId", "year");

-- CreateIndex
CREATE INDEX "CohortExport_doctorId_exportedAt_idx" ON "CohortExport"("doctorId", "exportedAt");

-- AddForeignKey
ALTER TABLE "CmeCredit" ADD CONSTRAINT "CmeCredit_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortExport" ADD CONSTRAINT "CohortExport_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
