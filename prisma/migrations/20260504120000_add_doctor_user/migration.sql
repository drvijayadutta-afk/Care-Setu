-- DoctorUser: authentication identity for a Doctor
CREATE TABLE "DoctorUser" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "magicLinkTokenHash" TEXT,
    "magicLinkExpiresAt" TIMESTAMP(3),
    "magicLinkUsedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DoctorUser_doctorId_key" ON "DoctorUser"("doctorId");
CREATE UNIQUE INDEX "DoctorUser_email_key" ON "DoctorUser"("email");
CREATE INDEX "DoctorUser_magicLinkTokenHash_idx" ON "DoctorUser"("magicLinkTokenHash");

ALTER TABLE "DoctorUser" ADD CONSTRAINT "DoctorUser_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
