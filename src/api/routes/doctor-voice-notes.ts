/**
 * Hook 5: Voice-to-SOAP Note routes
 *
 * POST /doctor/patients/:id/voice-note
 *   → multipart/form-data with `audio` file + optional `language`
 *   → uploads audio, transcribes via Whisper, structures via Claude
 *   → creates a draft ClinicalNote (unsigned), returns noteId + transcript + SOAP
 *
 * PATCH /doctor/voice-notes/:noteId
 *   → update SOAP fields (doctor edits before signing)
 *
 * POST /doctor/voice-notes/:noteId/sign
 *   → marks the note as signed (signedAt, signedByDoctorId)
 *   → note becomes immutable for medico-legal purposes
 */

import type { FastifyInstance } from "fastify";
import { requireDoctorAccess } from "../middleware/doctor-scope";
import { transcribeAndStructure } from "../services/voice-soap.service";
import { accrueCmeFor } from "../services/cme-accrual.service";
import { prisma } from "../../db/client";

export function registerDoctorVoiceNoteRoutes(fastify: FastifyInstance) {
  const auth = [(fastify as any).authenticate, requireDoctorAccess];

  // ─── Upload + process voice note ─────────────────────────────────────────

  fastify.post(
    "/doctor/patients/:id/voice-note",
    {
      preHandler: auth,
      config: { rawBody: true },
    },
    async (request, reply) => {
      const user = (request as any).user as { doctorId: string; sub: string };
      const { id: patientId } = request.params as { id: string };

      // Verify care team access
      const isMember = await prisma.careTeamMember.findFirst({
        where: { patientId, doctorId: user.doctorId, isActive: true },
      });
      if (!isMember && process.env.PATIENT_SCOPE_NO_ENFORCE !== "true") {
        return reply.status(403).send({ error: "Not on care team" });
      }

      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        select: { cancerType: true, treatmentProtocol: true, currentCycle: true, name: true },
      });
      if (!patient) return reply.status(404).send({ error: "Patient not found" });

      // Parse multipart form data
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: "Audio file required (multipart/form-data)" });
      }

      const language = (data.fields as any)?.language?.value ?? "en";
      const mimeType = data.mimetype ?? "audio/webm";

      // Read audio buffer
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      // Sanity-check size (10 MB cap — ~8 minutes at typical bitrate)
      const MAX_BYTES = 10 * 1024 * 1024;
      if (audioBuffer.length > MAX_BYTES) {
        return reply.status(413).send({ error: "Audio exceeds 10 MB limit" });
      }
      if (audioBuffer.length < 1000) {
        return reply.status(400).send({ error: "Audio too short (< 1 KB)" });
      }

      // Doctor identity for the note
      const doctor = await prisma.doctor.findUnique({
        where: { id: user.doctorId },
        select: { name: true },
      });

      // Transcribe and structure
      const { audioStorageKey, transcript, soap } = await transcribeAndStructure(
        audioBuffer,
        patientId,
        mimeType,
        language,
        {
          cancerType: patient.cancerType,
          treatmentProtocol: patient.treatmentProtocol,
          currentCycle: patient.currentCycle,
        }
      );

      // Create draft ClinicalNote (unsigned)
      const note = await prisma.clinicalNote.create({
        data: {
          patientId,
          noteDate: new Date(),
          noteType: "SOAP",
          title: `Clinic Note — ${patient.name} (${new Date().toLocaleDateString("en-IN")})`,
          content: `HPI: ${soap.hpi}\n\nExam: ${soap.exam}\n\nAssessment: ${soap.assessment}\n\nPlan: ${soap.plan}`,
          authorName: doctor?.name ?? "Doctor",
          authorRole: "ONCOLOGIST",
          tags: ["voice-note", "soap", language],
          audioUrl: audioStorageKey,
          transcript,
          structuredFields: soap as unknown as import("@prisma/client").Prisma.JsonObject,
          language,
          // signedAt and signedByDoctorId are null until doctor signs
        },
      });

      return reply.status(201).send({
        noteId: note.id,
        transcript,
        soap,
        audioStorageKey,
      });
    }
  );

  // ─── Edit SOAP fields before signing ─────────────────────────────────────

  fastify.patch(
    "/doctor/voice-notes/:noteId",
    { preHandler: auth },
    async (request, reply) => {
      const user = (request as any).user as { doctorId: string };
      const { noteId } = request.params as { noteId: string };
      const body = request.body as {
        hpi?: string;
        exam?: string;
        assessment?: string;
        plan?: string;
      };

      const note = await prisma.clinicalNote.findUnique({
        where: { id: noteId },
        select: { patientId: true, signedAt: true, structuredFields: true },
      });
      if (!note) return reply.status(404).send({ error: "Note not found" });
      if (note.signedAt) {
        return reply.status(409).send({
          error: "Note is already signed and cannot be edited",
        });
      }

      // Verify access
      const isMember = await prisma.careTeamMember.findFirst({
        where: { patientId: note.patientId, doctorId: user.doctorId, isActive: true },
      });
      if (!isMember && process.env.PATIENT_SCOPE_NO_ENFORCE !== "true") {
        return reply.status(403).send({ error: "Not on care team" });
      }

      const existing = (note.structuredFields as Record<string, string>) ?? {};
      const updatedSoap = {
        hpi: body.hpi ?? existing.hpi ?? "",
        exam: body.exam ?? existing.exam ?? "",
        assessment: body.assessment ?? existing.assessment ?? "",
        plan: body.plan ?? existing.plan ?? "",
      };

      const updated = await prisma.clinicalNote.update({
        where: { id: noteId },
        data: {
          structuredFields: updatedSoap,
          content: `HPI: ${updatedSoap.hpi}\n\nExam: ${updatedSoap.exam}\n\nAssessment: ${updatedSoap.assessment}\n\nPlan: ${updatedSoap.plan}`,
        },
      });

      return { noteId: updated.id, soap: updatedSoap };
    }
  );

  // ─── Sign the note ────────────────────────────────────────────────────────

  fastify.post(
    "/doctor/voice-notes/:noteId/sign",
    { preHandler: auth },
    async (request, reply) => {
      const user = (request as any).user as { doctorId: string };
      const { noteId } = request.params as { noteId: string };

      const note = await prisma.clinicalNote.findUnique({
        where: { id: noteId },
        select: { patientId: true, signedAt: true },
      });
      if (!note) return reply.status(404).send({ error: "Note not found" });
      if (note.signedAt) {
        return reply.status(409).send({ error: "Note is already signed" });
      }

      const isMember = await prisma.careTeamMember.findFirst({
        where: { patientId: note.patientId, doctorId: user.doctorId, isActive: true },
      });
      if (!isMember && process.env.PATIENT_SCOPE_NO_ENFORCE !== "true") {
        return reply.status(403).send({ error: "Not on care team" });
      }

      const signed = await prisma.clinicalNote.update({
        where: { id: noteId },
        data: {
          signedAt: new Date(),
          signedByDoctorId: user.doctorId,
        },
      });

      // Award CME credit for case documentation (Hook 7)
      accrueCmeFor("case_documentation", user.doctorId, { noteId, description: "SOAP voice note signed" });

      return {
        noteId: signed.id,
        signedAt: signed.signedAt,
        signedByDoctorId: signed.signedByDoctorId,
      };
    }
  );

  // ─── List voice notes for a patient ──────────────────────────────────────

  fastify.get(
    "/doctor/patients/:id/voice-notes",
    { preHandler: auth },
    async (request) => {
      const user = (request as any).user as { doctorId: string };
      const { id: patientId } = request.params as { id: string };

      const notes = await prisma.clinicalNote.findMany({
        where: { patientId, noteType: "SOAP", audioUrl: { not: null } },
        orderBy: { noteDate: "desc" },
        take: 20,
        select: {
          id: true,
          noteDate: true,
          title: true,
          transcript: true,
          structuredFields: true,
          language: true,
          signedAt: true,
          signedByDoctorId: true,
          audioUrl: true,
        },
      });

      return notes;
    }
  );
}
