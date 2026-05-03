/**
 * Hook 3: Defense Mode — Care Record endpoints
 *
 * POST /doctor/care-record/:patientId/generate
 *   → Aggregates all clinical data, hashes it, archives JSON to Supabase,
 *     emails the HTML report to the requesting doctor.
 *   → Returns { recordId, hash, rowCount, html } — frontend can open a print window.
 *
 * GET /doctor/care-record/:patientId/history
 *   → Returns list of past generations (date, hash, rowCount) for this patient.
 */

import type { FastifyInstance } from "fastify";
import { requireDoctorAccess } from "../middleware/doctor-scope";
import { buildCareRecord } from "../services/care-record-export.service";
import { logAccess } from "../services/audit-logger.service";
import { sendEmail } from "../../integrations/email-sender";
import { prisma } from "../../db/client";

export function registerDoctorCareRecordRoutes(fastify: FastifyInstance) {
  const auth = [(fastify as any).authenticate, requireDoctorAccess];

  // ─── Generate care record ────────────────────────────────────────────────

  fastify.post(
    "/doctor/care-record/:patientId/generate",
    { preHandler: auth },
    async (request, reply) => {
      const user = (request as any).user as { doctorId: string; sub: string };
      const { patientId } = request.params as { patientId: string };

      // Verify this doctor has access to this patient
      const isMember = await prisma.careTeamMember.findFirst({
        where: { patientId, doctorId: user.doctorId, isActive: true },
      });
      if (!isMember && process.env.PATIENT_SCOPE_NO_ENFORCE !== "true") {
        return reply.status(403).send({
          error: "You are not a member of this patient's care team",
        });
      }

      // Build the complete care record
      const result = await buildCareRecord(patientId, user.doctorId);

      // Log to AuditLog
      logAccess({
        coordinatorId: user.sub, // DoctorUser.id — repurposing coordinatorId for any auth identity
        patientId,
        action: "care_record_generated",
        resourceType: "care_record",
        resourceId: result.recordId,
        isOutOfScope: false,
        isCrossHospital: false,
      });

      // Email the report to the doctor's verified email (non-blocking)
      const doctorUser = await prisma.doctorUser.findUnique({
        where: { doctorId: user.doctorId },
        select: { email: true },
      });

      if (doctorUser?.email) {
        const patient = await prisma.patient.findUnique({
          where: { id: patientId },
          select: { name: true },
        });

        sendEmail({
          to: doctorUser.email,
          subject: `Care Record — ${patient?.name ?? patientId} (${new Date().toLocaleDateString("en-IN")})`,
          html: result.html,
          attachments: [
            {
              filename: `care-record-${patientId}-${result.hash.slice(0, 8)}.html`,
              content: Buffer.from(result.html),
              contentType: "text/html",
            },
          ],
        })
          .then(() => {
            // Update emailSentTo on the record
            return prisma.careRecordGeneration.update({
              where: { id: result.recordId },
              data: { emailSentTo: doctorUser.email },
            });
          })
          .catch((err) => {
            console.error("[care-record] Email send failed:", err?.message);
          });
      }

      return reply.status(202).send({
        recordId: result.recordId,
        hash: result.hash,
        rowCount: result.rowCount,
        generatedAt: new Date().toISOString(),
        // HTML is returned so the frontend can open a print window immediately
        // without a second round-trip
        html: result.html,
      });
    }
  );

  // ─── Generation history ──────────────────────────────────────────────────

  fastify.get(
    "/doctor/care-record/:patientId/history",
    { preHandler: auth },
    async (request, reply) => {
      const user = (request as any).user as { doctorId: string };
      const { patientId } = request.params as { patientId: string };

      const isMember = await prisma.careTeamMember.findFirst({
        where: { patientId, doctorId: user.doctorId, isActive: true },
      });
      if (!isMember && process.env.PATIENT_SCOPE_NO_ENFORCE !== "true") {
        return reply.status(403).send({ error: "Not on care team" });
      }

      const history = await prisma.careRecordGeneration.findMany({
        where: { patientId },
        orderBy: { generatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          jsonHash: true,
          storageKey: true,
          emailSentTo: true,
          rowCount: true,
          generatedAt: true,
          // Include who generated it (by doctorId)
          doctorId: true,
        },
      });

      return history;
    }
  );
}
