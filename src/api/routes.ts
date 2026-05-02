import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client";
import { sendMessage as sendAisensyMessage } from "../integrations/aisensy";
import { wsManager } from "../websocket/manager";
import { generateUploadUrl, generateDownloadUrl, deleteFile } from "../integrations/supabase-storage";
import { extractDocumentData } from "../integrations/claude";
import { generateMdtSummary } from "../integrations/claude";
import { requirePatientAccess } from "./middleware/patient-scope";

export async function registerApiRoutes(fastify: FastifyInstance) {
  // Shorthand so every route can add preHandler: [auth]
  const auth = [(fastify as any).authenticate];
  // For routes scoped to a specific patient (:id param) — auth + ownership check
  const authScope = [...auth, requirePatientAccess];

  // DB diagnostics (public — used by Render health checks)
  fastify.get("/diag/db", async (request, reply) => {
    try {
      const count = await prisma.patient.count();
      return { ok: true, count };
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: error?.message ?? String(error),
        code: error?.code,
      });
    }
  });

  // Get all patients
  fastify.get("/patients", { preHandler: auth }, async (request, reply) => {
    try {
      const patients = await prisma.patient.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return patients;
    } catch (error) {
      console.error("Error fetching patients:", error);
      reply.status(500).send({ error: "Failed to fetch patients" });
    }
  });

  // Get single patient
  fastify.get("/patients/:id", { preHandler: authScope }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const patient = await prisma.patient.findUnique({
        where: { id },
      });

      if (!patient) {
        return reply.status(404).send({ error: "Patient not found" });
      }

      return patient;
    } catch (error) {
      console.error("Error fetching patient:", error);
      reply.status(500).send({ error: "Failed to fetch patient" });
    }
  });

  // Get patient conversations
  fastify.get("/patients/:id/conversations", { preHandler: authScope }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const conversations = await prisma.conversation.findMany({
        where: { patientId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return conversations;
    } catch (error) {
      console.error("Error fetching conversations:", error);
      reply.status(500).send({ error: "Failed to fetch conversations" });
    }
  });

  // Get patient check-ins
  fastify.get("/patients/:id/checkins", { preHandler: authScope }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const checkins = await prisma.checkin.findMany({
        where: { patientId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return checkins;
    } catch (error) {
      console.error("Error fetching checkins:", error);
      reply.status(500).send({ error: "Failed to fetch checkins" });
    }
  });

  // Get patient appointments
  fastify.get("/patients/:id/appointments", { preHandler: authScope }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const appointments = await prisma.appointment.findMany({
        where: { patientId: id },
        orderBy: { scheduledAt: "desc" },
        take: 50,
      });

      return appointments;
    } catch (error) {
      console.error("Error fetching appointments:", error);
      reply.status(500).send({ error: "Failed to fetch appointments" });
    }
  });

  // Send message to patient
  fastify.post("/patients/:id/send-message", { preHandler: authScope }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { message } = request.body as { message: string };

      if (!message || message.trim().length === 0) {
        return reply.status(400).send({ error: "Message cannot be empty" });
      }

      const patient = await prisma.patient.findUnique({ where: { id } });
      if (!patient) {
        return reply.status(404).send({ error: "Patient not found" });
      }

      // Send via Aisensy
      const messageId = await sendAisensyMessage(patient.whatsappNumber, message);

      if (!messageId) {
        return reply
          .status(500)
          .send({ error: "Failed to send message via WhatsApp" });
      }

      // Store message in conversations table
      const conversation = await prisma.conversation.create({
        data: {
          patientId: id,
          role: "assistant",
          content: message,
          messageType: "text",
        },
      });

      // Broadcast message event via WebSocket
      wsManager.broadcast(id, {
        type: "message",
        patientId: id,
        conversationId: conversation.id,
        content: message,
        role: "assistant",
      });

      return {
        success: true,
        conversationId: conversation.id,
        messageId,
      };
    } catch (error) {
      console.error("Error sending message:", error);
      reply.status(500).send({ error: "Failed to send message" });
    }
  });

  // Create appointment
  fastify.post("/patients/:id/appointments", { preHandler: authScope }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { type, scheduledAt, notes, status, doctorName, hospitalName } = request.body as {
        type: string;
        scheduledAt: string;
        notes?: string;
        status?: string;
        doctorName?: string;
        hospitalName?: string;
      };

      const patient = await prisma.patient.findUnique({ where: { id } });
      if (!patient) {
        return reply.status(404).send({ error: "Patient not found" });
      }

      const appointment = await prisma.appointment.create({
        data: {
          patientId: id,
          type,
          scheduledAt: new Date(scheduledAt),
          notes: notes || null,
          status: (status as any) || "pending",
          doctorName: doctorName || "TBD",
          hospitalName: hospitalName || "TBD",
        },
      });

      // Broadcast appointment creation event via WebSocket
      wsManager.broadcast(id, {
        type: "appointment",
        patientId: id,
        appointmentId: appointment.id,
        action: "created",
        status: appointment.status,
      });

      return appointment;
    } catch (error) {
      console.error("Error creating appointment:", error);
      reply.status(500).send({ error: "Failed to create appointment" });
    }
  });

  // Update appointment
  fastify.patch("/appointments/:id", { preHandler: auth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { type, scheduledAt, notes, status } = request.body as {
        type?: string;
        scheduledAt?: string;
        notes?: string;
        status?: string;
      };

      const appointment = await prisma.appointment.update({
        where: { id },
        data: {
          ...(type && { type }),
          ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
          ...(notes !== undefined && { notes }),
          ...(status && { status: status as any }),
        },
      });

      wsManager.broadcast(appointment.patientId, {
        type: "appointment",
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        action: "updated",
        status: appointment.status,
      });

      return appointment;
    } catch (error) {
      console.error("Error updating appointment:", error);
      reply.status(500).send({ error: "Failed to update appointment" });
    }
  });

  // ─── Lab Results ────────────────────────────────────────────────────────────

  fastify.get("/patients/:id/lab-results", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { category } = request.query as { category?: string };
    const results = await prisma.labResult.findMany({
      where: { patientId: id, isDeleted: false, ...(category ? { category } : {}) },
      orderBy: { testDate: "desc" },
    });
    return results;
  });

  fastify.post("/patients/:id/lab-results", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const result = await prisma.labResult.create({
      data: {
        patientId: id,
        testDate: new Date(body.testDate),
        reportedAt: body.reportedAt ? new Date(body.reportedAt) : null,
        category: body.category,
        testName: body.testName,
        value: body.value != null ? parseFloat(body.value) : null,
        unit: body.unit ?? null,
        refMin: body.refMin != null ? parseFloat(body.refMin) : null,
        refMax: body.refMax != null ? parseFloat(body.refMax) : null,
        isAbnormal: body.isAbnormal ?? false,
        flag: body.flag ?? null,
        rawText: body.rawText ?? null,
        cycleNumber: body.cycleNumber ?? null,
        cycleDay: body.cycleDay ?? null,
        orderedBy: body.orderedBy ?? null,
        source: body.source ?? "manual",
        documentId: body.documentId ?? null,
        notes: body.notes ?? null,
      },
    });
    return result;
  });

  fastify.post("/patients/:id/lab-results/bulk", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { results } = request.body as { results: any[] };
    const created = await prisma.$transaction(
      results.map((r) =>
        prisma.labResult.create({
          data: {
            patientId: id,
            testDate: new Date(r.testDate),
            category: r.category,
            testName: r.testName,
            value: r.value != null ? parseFloat(r.value) : null,
            unit: r.unit ?? null,
            refMin: r.refMin != null ? parseFloat(r.refMin) : null,
            refMax: r.refMax != null ? parseFloat(r.refMax) : null,
            isAbnormal: r.isAbnormal ?? false,
            flag: r.flag ?? null,
            rawText: r.rawText ?? null,
            source: r.source ?? "manual",
          },
        })
      )
    );
    return { created: created.length };
  });

  fastify.patch("/lab-results/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const result = await prisma.labResult.update({
      where: { id },
      data: {
        ...(body.value != null && { value: parseFloat(body.value) }),
        ...(body.flag !== undefined && { flag: body.flag }),
        ...(body.isAbnormal !== undefined && { isAbnormal: body.isAbnormal }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });
    return result;
  });

  fastify.delete("/lab-results/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.labResult.update({ where: { id }, data: { isDeleted: true } });
    return { ok: true };
  });

  // ─── Imaging Reports ─────────────────────────────────────────────────────────

  fastify.get("/patients/:id/imaging", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return prisma.imagingReport.findMany({
      where: { patientId: id },
      orderBy: { studyDate: "desc" },
    });
  });

  fastify.post("/patients/:id/imaging", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return prisma.imagingReport.create({
      data: {
        patientId: id,
        studyDate: new Date(body.studyDate),
        reportedAt: body.reportedAt ? new Date(body.reportedAt) : null,
        modality: body.modality,
        bodyPart: body.bodyPart,
        indication: body.indication ?? null,
        findings: body.findings ?? null,
        impression: body.impression ?? null,
        response: body.response ?? null,
        radiologist: body.radiologist ?? null,
        referenceId: body.referenceId ?? null,
        documentId: body.documentId ?? null,
        source: body.source ?? "manual",
        notes: body.notes ?? null,
      },
    });
  });

  fastify.patch("/imaging/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return prisma.imagingReport.update({
      where: { id },
      data: {
        ...(body.findings !== undefined && { findings: body.findings }),
        ...(body.impression !== undefined && { impression: body.impression }),
        ...(body.response !== undefined && { response: body.response }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });
  });

  // ─── Pathology Reports ───────────────────────────────────────────────────────

  fastify.get("/patients/:id/pathology", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return prisma.pathologyReport.findMany({
      where: { patientId: id },
      orderBy: { reportDate: "desc" },
    });
  });

  fastify.post("/patients/:id/pathology", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return prisma.pathologyReport.create({
      data: {
        patientId: id,
        reportDate: new Date(body.reportDate),
        specimenType: body.specimenType,
        site: body.site,
        diagnosis: body.diagnosis,
        grade: body.grade ?? null,
        stage: body.stage ?? null,
        margins: body.margins ?? null,
        ihcFindings: body.ihcFindings ?? null,
        molecularTests: body.molecularTests ?? null,
        pathologist: body.pathologist ?? null,
        labName: body.labName ?? null,
        referenceId: body.referenceId ?? null,
        documentId: body.documentId ?? null,
        source: body.source ?? "manual",
        notes: body.notes ?? null,
      },
    });
  });

  fastify.patch("/pathology/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return prisma.pathologyReport.update({
      where: { id },
      data: {
        ...(body.diagnosis !== undefined && { diagnosis: body.diagnosis }),
        ...(body.grade !== undefined && { grade: body.grade }),
        ...(body.ihcFindings !== undefined && { ihcFindings: body.ihcFindings }),
        ...(body.molecularTests !== undefined && { molecularTests: body.molecularTests }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });
  });

  // ─── Vital Signs ─────────────────────────────────────────────────────────────

  fastify.get("/patients/:id/vitals", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return prisma.vitalSign.findMany({
      where: { patientId: id },
      orderBy: { recordedAt: "desc" },
      take: 100,
    });
  });

  fastify.post("/patients/:id/vitals", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const bmi =
      body.weight && body.height
        ? parseFloat((body.weight / (body.height / 100) ** 2).toFixed(1))
        : body.bmi ?? null;
    return prisma.vitalSign.create({
      data: {
        patientId: id,
        recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date(),
        weight: body.weight ?? null,
        height: body.height ?? null,
        bmi,
        temperature: body.temperature ?? null,
        bpSystolic: body.bpSystolic ?? null,
        bpDiastolic: body.bpDiastolic ?? null,
        pulseRate: body.pulseRate ?? null,
        oxygenSat: body.oxygenSat ?? null,
        ecogScore: body.ecogScore ?? null,
        painScore: body.painScore ?? null,
        source: body.source ?? "manual",
        cycleNumber: body.cycleNumber ?? null,
        cycleDay: body.cycleDay ?? null,
      },
    });
  });

  // ─── Clinical Notes ──────────────────────────────────────────────────────────

  fastify.get("/patients/:id/clinical-notes", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { type } = request.query as { type?: string };
    return prisma.clinicalNote.findMany({
      where: { patientId: id, ...(type ? { noteType: type } : {}) },
      orderBy: { noteDate: "desc" },
    });
  });

  fastify.post("/patients/:id/clinical-notes", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return prisma.clinicalNote.create({
      data: {
        patientId: id,
        noteDate: body.noteDate ? new Date(body.noteDate) : new Date(),
        noteType: body.noteType,
        title: body.title,
        content: body.content,
        authorName: body.authorName,
        authorRole: body.authorRole ?? "COORDINATOR",
        isPrivate: body.isPrivate ?? false,
        cycleNumber: body.cycleNumber ?? null,
        tags: body.tags ?? [],
        documentId: body.documentId ?? null,
      },
    });
  });

  fastify.patch("/clinical-notes/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return prisma.clinicalNote.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.tags !== undefined && { tags: body.tags }),
      },
    });
  });

  // ─── Documents (Privacy-Safe) ────────────────────────────────────────────────

  fastify.post("/patients/:id/documents/upload-url", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { category, fileType, title, description } = request.body as {
      category: string;
      fileType: string;
      title: string;
      description?: string;
    };

    const docId = crypto.randomUUID();
    const storagePath = `${id}/${category.toLowerCase()}/${docId}.${fileType}`;

    const { uploadUrl } = await generateUploadUrl(storagePath, fileType);

    // Pre-register document (completed after successful upload)
    const doc = await prisma.patientDocument.create({
      data: {
        id: docId,
        patientId: id,
        category,
        title,
        description: description ?? null,
        storagePath,
        fileType,
        tags: [],
      },
    });

    return { uploadUrl, documentId: doc.id };
  });

  fastify.get("/patients/:id/documents", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const docs = await prisma.patientDocument.findMany({
      where: { patientId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        category: true,
        title: true,
        description: true,
        fileType: true,
        fileSizeBytes: true,
        isVerified: true,
        tags: true,
        documentDate: true,
        uploadedBy: true,
        createdAt: true,
        // storagePath intentionally excluded — access via /download-url only
      },
    });
    return docs;
  });

  fastify.patch("/documents/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return prisma.patientDocument.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.documentDate !== undefined && { documentDate: new Date(body.documentDate) }),
        ...(body.fileSizeBytes !== undefined && { fileSizeBytes: body.fileSizeBytes }),
        ...(body.isVerified !== undefined && { isVerified: body.isVerified }),
        ...(body.tags !== undefined && { tags: body.tags }),
        ...(body.uploadedBy !== undefined && { uploadedBy: body.uploadedBy }),
      },
    });
  });

  fastify.get("/documents/:id/download-url", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = await prisma.patientDocument.findUnique({
      where: { id },
      select: { storagePath: true, fileType: true, title: true },
    });
    if (!doc) return reply.status(404).send({ error: "Document not found" });
    const { downloadUrl } = await generateDownloadUrl(doc.storagePath);
    return { downloadUrl, title: doc.title, fileType: doc.fileType };
  });

  fastify.delete("/documents/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = await prisma.patientDocument.findUnique({ where: { id } });
    if (!doc) return reply.status(404).send({ error: "Document not found" });
    await deleteFile(doc.storagePath);
    await prisma.patientDocument.delete({ where: { id } });
    return { ok: true };
  });

  fastify.post("/documents/:id/extract", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = await prisma.patientDocument.findUnique({ where: { id } });
    if (!doc) return reply.status(404).send({ error: "Document not found" });

    const extracted = await extractDocumentData(doc.storagePath, doc.category, doc.fileType);

    await prisma.patientDocument.update({
      where: { id },
      data: { extractedData: extracted as any },
    });

    // Auto-create structured records from extraction
    if (doc.category === "LAB_REPORT" && Array.isArray(extracted)) {
      for (const r of extracted as any[]) {
        await prisma.labResult.create({
          data: {
            patientId: doc.patientId,
            testDate: r.testDate ? new Date(r.testDate) : new Date(doc.createdAt),
            category: r.category ?? "OTHER",
            testName: r.testName,
            value: r.value != null ? parseFloat(r.value) : null,
            unit: r.unit ?? null,
            refMin: r.refMin != null ? parseFloat(r.refMin) : null,
            refMax: r.refMax != null ? parseFloat(r.refMax) : null,
            isAbnormal: r.isAbnormal ?? false,
            flag: r.flag ?? null,
            rawText: r.rawText ?? null,
            source: "pdf_extract",
            documentId: id,
          },
        });
      }
    } else if (doc.category === "IMAGING") {
      const r = extracted as any;
      await prisma.imagingReport.create({
        data: {
          patientId: doc.patientId,
          studyDate: r.studyDate ? new Date(r.studyDate) : new Date(doc.createdAt),
          modality: r.modality ?? "UNKNOWN",
          bodyPart: r.bodyPart ?? "UNKNOWN",
          indication: r.indication ?? null,
          findings: r.findings ?? null,
          impression: r.impression ?? null,
          source: "pdf_extract",
          documentId: id,
        },
      });
    } else if (doc.category === "PATHOLOGY") {
      const r = extracted as any;
      await prisma.pathologyReport.create({
        data: {
          patientId: doc.patientId,
          reportDate: r.reportDate ? new Date(r.reportDate) : new Date(doc.createdAt),
          specimenType: r.specimenType ?? "BIOPSY",
          site: r.site ?? "UNKNOWN",
          diagnosis: r.diagnosis ?? "See report",
          grade: r.grade ?? null,
          stage: r.stage ?? null,
          ihcFindings: r.ihcFindings ?? null,
          molecularTests: r.molecularTests ?? null,
          source: "pdf_extract",
          documentId: id,
        },
      });
    }

    return { ok: true, extracted };
  });

  // ─── Care Team ───────────────────────────────────────────────────────────────

  fastify.get("/patients/:id/care-team", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return prisma.careTeamMember.findMany({
      where: { patientId: id, isActive: true },
      orderBy: [{ isPrimary: "desc" }, { role: "asc" }],
    });
  });

  fastify.post("/patients/:id/care-team", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return prisma.careTeamMember.create({
      data: {
        patientId: id,
        role: body.role,
        name: body.name,
        phone: body.phone ?? null,
        email: body.email ?? null,
        hospitalName: body.hospitalName ?? null,
        department: body.department ?? null,
        isPrimary: body.isPrimary ?? false,
      },
    });
  });

  fastify.patch("/care-team/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return prisma.careTeamMember.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.isPrimary !== undefined && { isPrimary: body.isPrimary }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });
  });

  fastify.delete("/care-team/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.careTeamMember.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  });

  // ─── Complete Patient Record ──────────────────────────────────────────────────

  fastify.get("/patients/:id/complete", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        checkins: { orderBy: { createdAt: "desc" }, take: 30 },
        medications: { where: { isActive: true } },
        appointments: { orderBy: { scheduledAt: "desc" }, take: 20 },
        alerts: { where: { resolved: false } },
        labResults: { where: { isDeleted: false }, orderBy: { testDate: "desc" }, take: 50 },
        imagingReports: { orderBy: { studyDate: "desc" } },
        pathologyReports: { orderBy: { reportDate: "desc" } },
        vitalSigns: { orderBy: { recordedAt: "desc" }, take: 20 },
        clinicalNotes: { orderBy: { noteDate: "desc" }, take: 20 },
        careTeamMembers: { where: { isActive: true } },
        caregiver: true,
      },
    });
    if (!patient) return reply.status(404).send({ error: "Patient not found" });
    return patient;
  });

  // ─── MDT Summary ─────────────────────────────────────────────────────────────

  fastify.get("/patients/:id/mdt-summary", { preHandler: authScope }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        checkins: { orderBy: { createdAt: "desc" }, take: 14 },
        medications: { where: { isActive: true } },
        appointments: { orderBy: { scheduledAt: "desc" }, take: 5 },
        alerts: { where: { resolved: false } },
        labResults: { where: { isDeleted: false }, orderBy: { testDate: "desc" }, take: 30 },
        imagingReports: { orderBy: { studyDate: "desc" }, take: 5 },
        pathologyReports: { orderBy: { reportDate: "desc" }, take: 3 },
        vitalSigns: { orderBy: { recordedAt: "desc" }, take: 5 },
        clinicalNotes: { where: { noteType: "MDT_DECISION" }, orderBy: { noteDate: "desc" }, take: 5 },
        careTeamMembers: { where: { isActive: true } },
      },
    });
    if (!patient) return reply.status(404).send({ error: "Patient not found" });
    const summary = await generateMdtSummary(patient as any);
    return { summary };
  });
}
