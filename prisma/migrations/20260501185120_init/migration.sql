-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'hi',
    "cancerType" TEXT NOT NULL,
    "treatmentProtocol" TEXT NOT NULL,
    "currentCycle" INTEGER NOT NULL DEFAULT 1,
    "cycleStartDate" TIMESTAMP(3) NOT NULL,
    "hospitalName" TEXT NOT NULL,
    "doctorName" TEXT NOT NULL,
    "doctorId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "onboardingData" JSONB,
    "personalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Caregiver" (
    "id" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationToPatient" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "isEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Caregiver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hospitalName" TEXT NOT NULL,
    "specialization" TEXT NOT NULL DEFAULT 'Oncology',
    "practoId" TEXT,
    "apolloId" TEXT,
    "isOptedIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checkin" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "symptoms" TEXT[],
    "emotionalState" TEXT,
    "notes" TEXT,
    "cycleDay" INTEGER NOT NULL,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Checkin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "purpose" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "timing" TEXT NOT NULL,
    "sideEffects" TEXT[],
    "watchFor" TEXT[],
    "contextSent" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationLog" (
    "id" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "taken" BOOLEAN NOT NULL,
    "takenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT,
    "doctorName" TEXT NOT NULL,
    "hospitalName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "practoBookingId" TEXT,
    "apolloBookingId" TEXT,
    "manualBooking" BOOLEAN NOT NULL DEFAULT false,
    "prepNotesSent" BOOLEAN NOT NULL DEFAULT false,
    "briefSent" BOOLEAN NOT NULL DEFAULT false,
    "postVisitSent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "checkinId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "caregiverNotified" BOOLEAN NOT NULL DEFAULT false,
    "coordinatorNotified" BOOLEAN NOT NULL DEFAULT false,
    "doctorNotified" BOOLEAN NOT NULL DEFAULT false,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isNightMode" BOOLEAN NOT NULL DEFAULT false,
    "intent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaregiverConversation" (
    "id" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaregiverConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentProtocol" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "cancerTypes" TEXT[],
    "totalCycles" INTEGER NOT NULL,
    "cycleDays" INTEGER NOT NULL,
    "dayProfiles" JSONB NOT NULL,
    "medications" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreatmentProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoordinatorTask" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "context" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "CoordinatorTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Patient_whatsappNumber_key" ON "Patient"("whatsappNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Caregiver_whatsappNumber_key" ON "Caregiver"("whatsappNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Caregiver_patientId_key" ON "Caregiver"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_whatsappNumber_key" ON "Doctor"("whatsappNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TreatmentProtocol_name_key" ON "TreatmentProtocol"("name");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caregiver" ADD CONSTRAINT "Caregiver_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkin" ADD CONSTRAINT "Checkin_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationLog" ADD CONSTRAINT "MedicationLog_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_checkinId_fkey" FOREIGN KEY ("checkinId") REFERENCES "Checkin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverConversation" ADD CONSTRAINT "CaregiverConversation_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "Caregiver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
