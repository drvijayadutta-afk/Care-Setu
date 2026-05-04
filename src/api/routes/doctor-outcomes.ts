/**
 * Hook 6: Personal Outcomes Dashboard routes
 *
 * GET /doctor/my-outcomes?days=90
 *   → Returns aggregated outcomes for this doctor's patient cohort.
 *
 * GET /doctor/peer-benchmark?metric=avg_checkin_score&days=90
 *   → Returns anonymized peer comparison (n≥10 peers required).
 *   Metrics: avg_checkin_score | alert_resolution_rate | mdt_participation |
 *            low_wellbeing_rate | imaging_response_rate
 */

import type { FastifyInstance } from "fastify";
import { requireDoctorAccess } from "../middleware/doctor-scope";
import {
  buildDoctorOutcomes,
  buildPeerBenchmark,
} from "../services/doctor-outcomes.service";

export function registerDoctorOutcomesRoutes(fastify: FastifyInstance) {
  const auth = [(fastify as any).authenticate, requireDoctorAccess];

  // ─── Personal outcomes ────────────────────────────────────────────────────

  fastify.get("/doctor/my-outcomes", { preHandler: auth }, async (request) => {
    const user = (request as any).user as { doctorId: string };
    const query = request.query as { days?: string };
    const days = Math.min(Math.max(Number(query.days ?? 90), 7), 365);

    return await buildDoctorOutcomes(user.doctorId, days);
  });

  // ─── Peer benchmark ───────────────────────────────────────────────────────

  fastify.get(
    "/doctor/peer-benchmark",
    { preHandler: auth },
    async (request, reply) => {
      const user = (request as any).user as { doctorId: string };
      const query = request.query as {
        metric?: string;
        days?: string;
        protocol?: string;
      };

      const VALID_METRICS = new Set([
        "avg_checkin_score",
        "alert_resolution_rate",
        "mdt_participation",
        "low_wellbeing_rate",
        "imaging_response_rate",
      ]);

      const metric = query.metric ?? "avg_checkin_score";
      if (!VALID_METRICS.has(metric)) {
        return reply.status(400).send({
          error: `Invalid metric. Choose from: ${[...VALID_METRICS].join(", ")}`,
        });
      }

      const days = Math.min(Math.max(Number(query.days ?? 90), 7), 365);

      return await buildPeerBenchmark(user.doctorId, metric, days, query.protocol);
    }
  );
}
