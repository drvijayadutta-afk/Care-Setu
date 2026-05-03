-- ─── T19: Platform Intelligence Schema Foundation ─────────────────────────────

-- Extend Doctor with full profile fields (all nullable — safe ALTER on live table)
ALTER TABLE "Doctor"
  ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "qualifications"     TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "department"          TEXT,
  ADD COLUMN IF NOT EXISTS "experienceYears"     INTEGER,
  ADD COLUMN IF NOT EXISTS "secondaryPhone"      TEXT,
  ADD COLUMN IF NOT EXISTS "email"               TEXT,
  ADD COLUMN IF NOT EXISTS "availabilityNotes"   TEXT,
  ADD COLUMN IF NOT EXISTS "photoUrl"            TEXT,
  ADD COLUMN IF NOT EXISTS "bio"                 TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Extend CareTeamMember with optional Doctor link
ALTER TABLE "CareTeamMember"
  ADD COLUMN IF NOT EXISTS "doctorId" TEXT;

ALTER TABLE "CareTeamMember"
  ADD CONSTRAINT "CareTeamMember_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "CareTeamMember_doctorId_idx" ON "CareTeamMember"("doctorId");

-- CreateTable OutboundMessage
CREATE TABLE "OutboundMessage" (
    "id"            TEXT NOT NULL,
    "patientId"     TEXT NOT NULL,
    "channel"       TEXT NOT NULL,
    "recipientRef"  TEXT NOT NULL,
    "messageType"   TEXT NOT NULL,
    "content"       TEXT NOT NULL,
    "externalId"    TEXT,
    "status"        TEXT NOT NULL DEFAULT 'sent',
    "jobId"         TEXT,
    "sentAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failureReason" TEXT,

    CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OutboundMessage"
  ADD CONSTRAINT "OutboundMessage_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "OutboundMessage_patientId_sentAt_idx" ON "OutboundMessage"("patientId", "sentAt");
CREATE INDEX "OutboundMessage_sentAt_idx"            ON "OutboundMessage"("sentAt");

-- CreateTable AuditLog
CREATE TABLE "AuditLog" (
    "id"              TEXT NOT NULL,
    "coordinatorId"   TEXT NOT NULL,
    "patientId"       TEXT NOT NULL,
    "action"          TEXT NOT NULL,
    "resourceType"    TEXT,
    "resourceId"      TEXT,
    "isOutOfScope"    BOOLEAN NOT NULL DEFAULT false,
    "isCrossHospital" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress"       TEXT,
    "userAgent"       TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_coordinatorId_createdAt_idx" ON "AuditLog"("coordinatorId", "createdAt");
CREATE INDEX "AuditLog_patientId_createdAt_idx"      ON "AuditLog"("patientId", "createdAt");
CREATE INDEX "AuditLog_isOutOfScope_createdAt_idx"   ON "AuditLog"("isOutOfScope", "createdAt");

-- CreateTable Referral
CREATE TABLE "Referral" (
    "id"                TEXT NOT NULL,
    "patientId"         TEXT NOT NULL,
    "fromDoctorId"      TEXT,
    "fromCoordinatorId" TEXT,
    "toDoctorId"        TEXT NOT NULL,
    "reason"            TEXT NOT NULL,
    "urgency"           TEXT NOT NULL DEFAULT 'routine',
    "clinicalContext"   TEXT,
    "status"            TEXT NOT NULL DEFAULT 'pending',
    "acceptedAt"        TIMESTAMP(3),
    "seenAt"            TIMESTAMP(3),
    "completedAt"       TIMESTAMP(3),
    "declinedAt"        TIMESTAMP(3),
    "declineReason"     TEXT,
    "notificationSent"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Referral"
  ADD CONSTRAINT "Referral_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Referral"
  ADD CONSTRAINT "Referral_fromDoctorId_fkey"
  FOREIGN KEY ("fromDoctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Referral"
  ADD CONSTRAINT "Referral_fromCoordinatorId_fkey"
  FOREIGN KEY ("fromCoordinatorId") REFERENCES "Coordinator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Referral"
  ADD CONSTRAINT "Referral_toDoctorId_fkey"
  FOREIGN KEY ("toDoctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Referral_patientId_idx"        ON "Referral"("patientId");
CREATE INDEX "Referral_toDoctorId_status_idx" ON "Referral"("toDoctorId", "status");
CREATE INDEX "Referral_status_createdAt_idx"  ON "Referral"("status", "createdAt");
