-- AlterTable
ALTER TABLE "Checkin" ADD COLUMN     "ctcaeGrades" JSONB,
ADD COLUMN     "ecogScore" INTEGER;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "allergies" TEXT[],
ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "comorbidities" TEXT[],
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "diagnosisDate" TIMESTAMP(3),
ADD COLUMN     "ecogScore" INTEGER,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "histology" TEXT,
ADD COLUMN     "metastasisSites" TEXT[],
ADD COLUMN     "primarySite" TEXT,
ADD COLUMN     "smokingStatus" TEXT,
ADD COLUMN     "stage" TEXT;

-- CreateTable
CREATE TABLE "LabResult" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "testDate" TIMESTAMP(3) NOT NULL,
    "reportedAt" TIMESTAMP(3),
    "category" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "refMin" DOUBLE PRECISION,
    "refMax" DOUBLE PRECISION,
    "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
    "flag" TEXT,
    "rawText" TEXT,
    "cycleNumber" INTEGER,
    "cycleDay" INTEGER,
    "orderedBy" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "documentId" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImagingReport" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "studyDate" TIMESTAMP(3) NOT NULL,
    "reportedAt" TIMESTAMP(3),
    "modality" TEXT NOT NULL,
    "bodyPart" TEXT NOT NULL,
    "indication" TEXT,
    "findings" TEXT,
    "impression" TEXT,
    "response" TEXT,
    "radiologist" TEXT,
    "referenceId" TEXT,
    "documentId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImagingReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathologyReport" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "specimenType" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "grade" TEXT,
    "stage" TEXT,
    "margins" TEXT,
    "ihcFindings" JSONB,
    "molecularTests" JSONB,
    "pathologist" TEXT,
    "labName" TEXT,
    "referenceId" TEXT,
    "documentId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PathologyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VitalSign" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "weight" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "bpSystolic" INTEGER,
    "bpDiastolic" INTEGER,
    "pulseRate" INTEGER,
    "oxygenSat" DOUBLE PRECISION,
    "ecogScore" INTEGER,
    "painScore" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "cycleNumber" INTEGER,
    "cycleDay" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VitalSign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNote" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "noteDate" TIMESTAMP(3) NOT NULL,
    "noteType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "cycleNumber" INTEGER,
    "tags" TEXT[],
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientDocument" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "documentDate" TIMESTAMP(3),
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "storagePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER,
    "uploadedBy" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "extractedData" JSONB,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareTeamMember" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "hospitalName" TEXT,
    "department" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareTeamMember_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingReport" ADD CONSTRAINT "ImagingReport_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathologyReport" ADD CONSTRAINT "PathologyReport_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VitalSign" ADD CONSTRAINT "VitalSign_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientDocument" ADD CONSTRAINT "PatientDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareTeamMember" ADD CONSTRAINT "CareTeamMember_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
