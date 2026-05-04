/**
 * Hook 7 Part B: Publication Cohort Export routes
 *
 * POST /doctor/cohorts/export
 *   Body: { cancerType?, stage?, protocol?, dateFrom?, dateTo? }
 *   → Returns de-identified CSV + summary stats.
 *   → Returns 400 if cohort has fewer than 5 patients (k-anonymity).
 *
 * GET /doctor/cohorts/exports
 *   → Returns list of past export metadata (no raw data).
 */

import type { FastifyInstance } from "fastify";
import { requireDoctorAccess } from "../middleware/doctor-scope";
import { buildCohortExport } from "../services/cohort-export.service";
import { prisma } from "../../db/client";

export function registerDoctorCohortRoutes(fastify: FastifyInstance) {
  const auth = [(fastify as any).authenticate, requireDoctorAccess];

  // ─── Export cohort ────────────────────────────────────────────────────────

  fastify.post("/doctor/cohorts/export", { preHandler: auth }, async (request, reply) => {
    const user = (request as any).user as { doctorId: string };
    const body = request.body as {
      cancerType?: string;
      stage?: string;
      protocol?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    try {
      const result = await buildCohortExport(user.doctorId, {
        cancerType: body.cancerType,
        stage: body.stage,
        protocol: body.protocol,
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
      });

      // Return CSV as download
      return reply
        .header("Content-Type", "text/csv")
        .header(
          "Content-Disposition",
          `attachment; filename="cohort-export-${result.exportId.slice(0, 8)}.csv"`
        )
        .header("X-Export-Id", result.exportId)
        .header("X-Row-Count", String(result.summary.rowCount))
        .header("X-Summary", JSON.stringify(result.summary))
        .send(result.csv);
    } catch (err: any) {
      if (err?.code === "COHORT_TOO_SMALL") {
        return reply.status(400).send({
          error: err.message,
          rowCount: err.rowCount,
          minRequired: err.minRequired,
        });
      }
      throw err;
    }
  });

  // ─── Export history ───────────────────────────────────────────────────────

  fastify.get("/doctor/cohorts/exports", { preHandler: auth }, async (request) => {
    const user = (request as any).user as { doctorId: string };

    const exports = await prisma.cohortExport.findMany({
      where: { doctorId: user.doctorId },
      orderBy: { exportedAt: "desc" },
      take: 20,
      select: {
        id: true,
        cohortDef: true,
        rowCount: true,
        exportedAt: true,
        downloadKey: true,
      },
    });

    return exports;
  });
}
