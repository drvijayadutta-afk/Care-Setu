"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerApiRoutes = registerApiRoutes;
const client_1 = require("../db/client");
const aisensy_1 = require("../integrations/aisensy");
const manager_1 = require("../websocket/manager");
const supabase_storage_1 = require("../integrations/supabase-storage");
const claude_1 = require("../integrations/claude");
const claude_2 = require("../integrations/claude");
async function registerApiRoutes(fastify) {
    // Shorthand so every route can add preHandler: [auth]
    const auth = [fastify.authenticate];
    // DB diagnostics (public — used by Render health checks)
    fastify.get("/diag/db", async (request, reply) => {
        try {
            const count = await client_1.prisma.patient.count();
            return { ok: true, count };
        }
        catch (error) {
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
            const patients = await client_1.prisma.patient.findMany({
                orderBy: { createdAt: "desc" },
                take: 50,
            });
            return patients;
        }
        catch (error) {
            console.error("Error fetching patients:", error);
            reply.status(500).send({ error: "Failed to fetch patients" });
        }
    });
    // Get single patient
    fastify.get("/patients/:id", { preHandler: auth }, async (request, reply) => {
        try {
            const { id } = request.params;
            const patient = await client_1.prisma.patient.findUnique({
                where: { id },
            });
            if (!patient) {
                return reply.status(404).send({ error: "Patient not found" });
            }
            return patient;
        }
        catch (error) {
            console.error("Error fetching patient:", error);
            reply.status(500).send({ error: "Failed to fetch patient" });
        }
    });
    // Get patient conversations
    fastify.get("/patients/:id/conversations", { preHandler: auth }, async (request, reply) => {
        try {
            const { id } = request.params;
            const conversations = await client_1.prisma.conversation.findMany({
                where: { patientId: id },
                orderBy: { createdAt: "desc" },
                take: 100,
            });
            return conversations;
        }
        catch (error) {
            console.error("Error fetching conversations:", error);
            reply.status(500).send({ error: "Failed to fetch conversations" });
        }
    });
    // Get patient check-ins
    fastify.get("/patients/:id/checkins", { preHandler: auth }, async (request, reply) => {
        try {
            const { id } = request.params;
            const checkins = await client_1.prisma.checkin.findMany({
                where: { patientId: id },
                orderBy: { createdAt: "desc" },
                take: 50,
            });
            return checkins;
        }
        catch (error) {
            console.error("Error fetching checkins:", error);
            reply.status(500).send({ error: "Failed to fetch checkins" });
        }
    });
    // Get patient appointments
    fastify.get("/patients/:id/appointments", { preHandler: auth }, async (request, reply) => {
        try {
            const { id } = request.params;
            const appointments = await client_1.prisma.appointment.findMany({
                where: { patientId: id },
                orderBy: { scheduledAt: "desc" },
                take: 50,
            });
            return appointments;
        }
        catch (error) {
            console.error("Error fetching appointments:", error);
            reply.status(500).send({ error: "Failed to fetch appointments" });
        }
    });
    // Send message to patient
    fastify.post("/patients/:id/send-message", { preHandler: auth }, async (request, reply) => {
        try {
            const { id } = request.params;
            const { message } = request.body;
            if (!message || message.trim().length === 0) {
                return reply.status(400).send({ error: "Message cannot be empty" });
            }
            const patient = await client_1.prisma.patient.findUnique({ where: { id } });
            if (!patient) {
                return reply.status(404).send({ error: "Patient not found" });
            }
            // Send via Aisensy
            const messageId = await (0, aisensy_1.sendMessage)(patient.whatsappNumber, message);
            if (!messageId) {
                return reply
                    .status(500)
                    .send({ error: "Failed to send message via WhatsApp" });
            }
            // Store message in conversations table
            const conversation = await client_1.prisma.conversation.create({
                data: {
                    patientId: id,
                    role: "assistant",
                    content: message,
                    messageType: "text",
                },
            });
            // Broadcast message event via WebSocket
            manager_1.wsManager.broadcast(id, {
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
        }
        catch (error) {
            console.error("Error sending message:", error);
            reply.status(500).send({ error: "Failed to send message" });
        }
    });
    // Create appointment
    fastify.post("/patients/:id/appointments", { preHandler: auth }, async (request, reply) => {
        try {
            const { id } = request.params;
            const { type, scheduledAt, notes, status, doctorName, hospitalName } = request.body;
            const patient = await client_1.prisma.patient.findUnique({ where: { id } });
            if (!patient) {
                return reply.status(404).send({ error: "Patient not found" });
            }
            const appointment = await client_1.prisma.appointment.create({
                data: {
                    patientId: id,
                    type,
                    scheduledAt: new Date(scheduledAt),
                    notes: notes || null,
                    status: status || "pending",
                    doctorName: doctorName || "TBD",
                    hospitalName: hospitalName || "TBD",
                },
            });
            // Broadcast appointment creation event via WebSocket
            manager_1.wsManager.broadcast(id, {
                type: "appointment",
                patientId: id,
                appointmentId: appointment.id,
                action: "created",
                status: appointment.status,
            });
            return appointment;
        }
        catch (error) {
            console.error("Error creating appointment:", error);
            reply.status(500).send({ error: "Failed to create appointment" });
        }
    });
    // Update appointment
    fastify.patch("/appointments/:id", { preHandler: auth }, async (request, reply) => {
        try {
            const { id } = request.params;
            const { type, scheduledAt, notes, status } = request.body;
            const appointment = await client_1.prisma.appointment.update({
                where: { id },
                data: {
                    ...(type && { type }),
                    ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
                    ...(notes !== undefined && { notes }),
                    ...(status && { status: status }),
                },
            });
            manager_1.wsManager.broadcast(appointment.patientId, {
                type: "appointment",
                patientId: appointment.patientId,
                appointmentId: appointment.id,
                action: "updated",
                status: appointment.status,
            });
            return appointment;
        }
        catch (error) {
            console.error("Error updating appointment:", error);
            reply.status(500).send({ error: "Failed to update appointment" });
        }
    });
    // ─── Lab Results ────────────────────────────────────────────────────────────
    fastify.get("/patients/:id/lab-results", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        const { category } = request.query;
        const results = await client_1.prisma.labResult.findMany({
            where: { patientId: id, isDeleted: false, ...(category ? { category } : {}) },
            orderBy: { testDate: "desc" },
        });
        return results;
    });
    fastify.post("/patients/:id/lab-results", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        const body = request.body;
        const result = await client_1.prisma.labResult.create({
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
    fastify.post("/patients/:id/lab-results/bulk", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        const { results } = request.body;
        const created = await client_1.prisma.$transaction(results.map((r) => client_1.prisma.labResult.create({
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
        })));
        return { created: created.length };
    });
    fastify.patch("/lab-results/:id", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        const body = request.body;
        const result = await client_1.prisma.labResult.update({
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
        const { id } = request.params;
        await client_1.prisma.labResult.update({ where: { id }, data: { isDeleted: true } });
        return { ok: true };
    });
    // ─── Imaging Reports ─────────────────────────────────────────────────────────
    fastify.get("/patients/:id/imaging", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        return client_1.prisma.imagingReport.findMany({
            where: { patientId: id },
            orderBy: { studyDate: "desc" },
        });
    });
    fastify.post("/patients/:id/imaging", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        const body = request.body;
        return client_1.prisma.imagingReport.create({
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
        const { id } = request.params;
        const body = request.body;
        return client_1.prisma.imagingReport.update({
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
    fastify.get("/patients/:id/pathology", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        return client_1.prisma.pathologyReport.findMany({
            where: { patientId: id },
            orderBy: { reportDate: "desc" },
        });
    });
    fastify.post("/patients/:id/pathology", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        const body = request.body;
        return client_1.prisma.pathologyReport.create({
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
        const { id } = request.params;
        const body = request.body;
        return client_1.prisma.pathologyReport.update({
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
    fastify.get("/patients/:id/vitals", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        return client_1.prisma.vitalSign.findMany({
            where: { patientId: id },
            orderBy: { recordedAt: "desc" },
            take: 100,
        });
    });
    fastify.post("/patients/:id/vitals", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        const body = request.body;
        const bmi = body.weight && body.height
            ? parseFloat((body.weight / (body.height / 100) ** 2).toFixed(1))
            : body.bmi ?? null;
        return client_1.prisma.vitalSign.create({
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
    fastify.get("/patients/:id/clinical-notes", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        const { type } = request.query;
        return client_1.prisma.clinicalNote.findMany({
            where: { patientId: id, ...(type ? { noteType: type } : {}) },
            orderBy: { noteDate: "desc" },
        });
    });
    fastify.post("/patients/:id/clinical-notes", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        const body = request.body;
        return client_1.prisma.clinicalNote.create({
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
        const { id } = request.params;
        const body = request.body;
        return client_1.prisma.clinicalNote.update({
            where: { id },
            data: {
                ...(body.title !== undefined && { title: body.title }),
                ...(body.content !== undefined && { content: body.content }),
                ...(body.tags !== undefined && { tags: body.tags }),
            },
        });
    });
    // ─── Documents (Privacy-Safe) ────────────────────────────────────────────────
    fastify.post("/patients/:id/documents/upload-url", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        const { category, fileType, title, description } = request.body;
        const docId = crypto.randomUUID();
        const storagePath = `${id}/${category.toLowerCase()}/${docId}.${fileType}`;
        const { uploadUrl } = await (0, supabase_storage_1.generateUploadUrl)(storagePath, fileType);
        // Pre-register document (completed after successful upload)
        const doc = await client_1.prisma.patientDocument.create({
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
    fastify.get("/patients/:id/documents", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        const docs = await client_1.prisma.patientDocument.findMany({
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
        const { id } = request.params;
        const body = request.body;
        return client_1.prisma.patientDocument.update({
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
        const { id } = request.params;
        const doc = await client_1.prisma.patientDocument.findUnique({
            where: { id },
            select: { storagePath: true, fileType: true, title: true },
        });
        if (!doc)
            return reply.status(404).send({ error: "Document not found" });
        const { downloadUrl } = await (0, supabase_storage_1.generateDownloadUrl)(doc.storagePath);
        return { downloadUrl, title: doc.title, fileType: doc.fileType };
    });
    fastify.delete("/documents/:id", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        const doc = await client_1.prisma.patientDocument.findUnique({ where: { id } });
        if (!doc)
            return reply.status(404).send({ error: "Document not found" });
        await (0, supabase_storage_1.deleteFile)(doc.storagePath);
        await client_1.prisma.patientDocument.delete({ where: { id } });
        return { ok: true };
    });
    fastify.post("/documents/:id/extract", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        const doc = await client_1.prisma.patientDocument.findUnique({ where: { id } });
        if (!doc)
            return reply.status(404).send({ error: "Document not found" });
        const extracted = await (0, claude_1.extractDocumentData)(doc.storagePath, doc.category, doc.fileType);
        await client_1.prisma.patientDocument.update({
            where: { id },
            data: { extractedData: extracted },
        });
        // Auto-create structured records from extraction
        if (doc.category === "LAB_REPORT" && Array.isArray(extracted)) {
            for (const r of extracted) {
                await client_1.prisma.labResult.create({
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
        }
        else if (doc.category === "IMAGING") {
            const r = extracted;
            await client_1.prisma.imagingReport.create({
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
        }
        else if (doc.category === "PATHOLOGY") {
            const r = extracted;
            await client_1.prisma.pathologyReport.create({
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
    fastify.get("/patients/:id/care-team", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        return client_1.prisma.careTeamMember.findMany({
            where: { patientId: id, isActive: true },
            orderBy: [{ isPrimary: "desc" }, { role: "asc" }],
        });
    });
    fastify.post("/patients/:id/care-team", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        const body = request.body;
        return client_1.prisma.careTeamMember.create({
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
        const { id } = request.params;
        const body = request.body;
        return client_1.prisma.careTeamMember.update({
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
        const { id } = request.params;
        await client_1.prisma.careTeamMember.update({ where: { id }, data: { isActive: false } });
        return { ok: true };
    });
    // ─── Complete Patient Record ──────────────────────────────────────────────────
    fastify.get("/patients/:id/complete", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        const patient = await client_1.prisma.patient.findUnique({
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
        if (!patient)
            return reply.status(404).send({ error: "Patient not found" });
        return patient;
    });
    // ─── MDT Summary ─────────────────────────────────────────────────────────────
    fastify.get("/patients/:id/mdt-summary", { preHandler: auth }, async (request, reply) => {
        const { id } = request.params;
        const patient = await client_1.prisma.patient.findUnique({
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
        if (!patient)
            return reply.status(404).send({ error: "Patient not found" });
        const summary = await (0, claude_2.generateMdtSummary)(patient);
        return { summary };
    });
}
//# sourceMappingURL=routes.js.map