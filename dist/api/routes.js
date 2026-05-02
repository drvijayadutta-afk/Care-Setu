"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerApiRoutes = registerApiRoutes;
const patients_1 = require("./routes/patients");
const records_1 = require("./routes/records");
const appointments_1 = require("./routes/appointments");
const messages_1 = require("./routes/messages");
async function registerApiRoutes(fastify) {
    const auth = [fastify.authenticate];
    // Get injected repositories
    const patientRepo = fastify.patientRepo;
    const recordRepo = fastify.recordRepo;
    const conversationRepo = fastify.conversationRepo;
    // DB diagnostics (public — used by Render health checks)
    fastify.get("/diag/db", async (request, reply) => {
        try {
            const count = await patientRepo.count();
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
    // Register modularized routes
    (0, patients_1.registerPatientRoutes)(fastify, patientRepo, conversationRepo, recordRepo);
    (0, records_1.registerRecordRoutes)(fastify, recordRepo);
    (0, appointments_1.registerAppointmentRoutes)(fastify, recordRepo);
    (0, messages_1.registerMessageRoutes)(fastify, patientRepo, conversationRepo);
}
//# sourceMappingURL=routes.js.map