-- AlterTable
ALTER TABLE "ClinicalNote" ADD COLUMN     "audioUrl" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "signedAt" TIMESTAMP(3),
ADD COLUMN     "signedByDoctorId" TEXT,
ADD COLUMN     "structuredFields" JSONB,
ADD COLUMN     "transcript" TEXT;
