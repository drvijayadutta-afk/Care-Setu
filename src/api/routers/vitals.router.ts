import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";

interface CreateVitalsBody {
  recordedAt?: string;
  weight?: number;
  height?: number;
  bmi?: number;
  temperature?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  pulseRate?: number;
  oxygenSat?: number;
  ecogScore?: number;
  painScore?: number;
  source?: string;
  cycleNumber?: number;
  cycleDay?: number;
}

export function registerVitalsRoutes(fastify: FastifyInstance, auth: any[]) {
  fastify.get("/patients/:id/vitals", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return prisma.vitalSign.findMany({
      where: { patientId: id },
      orderBy: { recordedAt: "desc" },
      take: 100,
    });
  });

  fastify.post("/patients/:id/vitals", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as CreateVitalsBody;

    // Auto-calculate BMI if weight + height provided
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
}
