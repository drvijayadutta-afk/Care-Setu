import crypto from "crypto";
import { prisma } from "../../db/client";

const TOKEN_TTL_MINUTES = 15;
const TOKEN_BYTES = 32;

export interface MagicLinkIssue {
  rawToken: string; // sent in URL; never logged or stored
  expiresAt: Date;
}

/**
 * Issue a magic-link token for a doctor identified by email.
 *
 * - Doctor must exist with this email and be opted in.
 * - DoctorUser row is created lazily on first request.
 * - Token is SHA-256 hashed before storage; raw token returned only here for
 *   delivery via WhatsApp / email.
 * - TTL: 15 minutes. Single-use.
 *
 * Returns null if no eligible doctor found — caller should still respond 200
 * to avoid email enumeration.
 */
export async function issueMagicLink(email: string): Promise<MagicLinkIssue | null> {
  const normalized = email.toLowerCase().trim();
  const doctor = await prisma.doctor.findFirst({
    where: { email: normalized, isOptedIn: true },
    select: { id: true, email: true },
  });
  if (!doctor || !doctor.email) return null;

  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.doctorUser.upsert({
    where: { doctorId: doctor.id },
    create: {
      doctorId: doctor.id,
      email: doctor.email,
      magicLinkTokenHash: tokenHash,
      magicLinkExpiresAt: expiresAt,
      magicLinkUsedAt: null,
    },
    update: {
      magicLinkTokenHash: tokenHash,
      magicLinkExpiresAt: expiresAt,
      magicLinkUsedAt: null,
    },
  });

  return { rawToken, expiresAt };
}

/**
 * Verify a magic-link token. Returns the underlying Doctor + DoctorUser if
 * valid, single-use, and not expired. Marks the token consumed on success.
 */
export async function verifyMagicLink(rawToken: string) {
  if (!rawToken || rawToken.length < 32) return null;
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const doctorUser = await prisma.doctorUser.findFirst({
    where: { magicLinkTokenHash: tokenHash },
    include: { doctor: true },
  });
  if (!doctorUser) return null;
  if (doctorUser.magicLinkUsedAt) return null; // already used
  if (!doctorUser.magicLinkExpiresAt || doctorUser.magicLinkExpiresAt < new Date()) return null;

  // Consume token + record login
  await prisma.doctorUser.update({
    where: { id: doctorUser.id },
    data: {
      magicLinkUsedAt: new Date(),
      magicLinkTokenHash: null,
      magicLinkExpiresAt: null,
      lastLoginAt: new Date(),
    },
  });

  return doctorUser;
}
