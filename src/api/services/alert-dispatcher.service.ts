import { prisma } from "../../db/client";
import { sendText } from "../../webhook/sender";
import { wsManager } from "../../websocket/manager";

/**
 * Dispatch an Alert to:
 *   1. WebSocket — broadcast to coordinators currently viewing this patient
 *   2. WhatsApp — send to the primary care team member's phone
 *
 * Logs every dispatch attempt to AlertDelivery for audit and retry.
 *
 * Designed to be fire-and-forget. Errors are caught and logged so a transient
 * outage cannot break the upstream code path that created the alert.
 */
export async function dispatchAlert(alertId: string): Promise<void> {
  try {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        patient: {
          include: {
            careTeamMembers: { where: { isActive: true } },
          },
        },
      },
    });

    if (!alert || alert.resolved) return;

    // 1. WebSocket broadcast — coordinator UI gets immediate update
    wsManager.broadcast(alert.patientId, {
      type: "alert",
      patientId: alert.patientId,
      alertId: alert.id,
      severity: alert.severity,
      message: alert.message,
      alertType: alert.type,
    });

    // 2. Global dashboard broadcast — alert badge on patient row + activity feed entry
    const ts = new Date().toISOString();
    wsManager.broadcastGlobal({
      type: "alert_badge",
      patientId: alert.patientId,
      severity: alert.severity,
      alertType: alert.type,
      timestamp: ts,
    });
    wsManager.broadcastGlobal({
      type: "activity",
      patientId: alert.patientId,
      patientName: alert.patient.name ?? "Patient",
      eventKind: "alert",
      summary: alert.message,
      severity: alert.severity,
      timestamp: ts,
    });

    // 3. WhatsApp dispatch — only for HIGH/CRITICAL severities
    if (alert.severity !== "high" && alert.severity !== "critical") return;

    const primary = alert.patient.careTeamMembers.find(m => m.isPrimary)
      ?? alert.patient.careTeamMembers[0];
    if (!primary?.phone) return;

    const patientName = alert.patient.name || "patient";
    const severityIcon = alert.severity === "critical" ? "🚨" : "⚠️";
    const msg = `${severityIcon} ALERT for ${patientName}: ${alert.message}. Open Care Setu to review.`;

    const delivery = await prisma.alertDelivery.create({
      data: {
        alertId: alert.id,
        channel: "whatsapp",
        recipientRef: primary.phone,
        status: "pending",
      },
    });

    try {
      await sendText(primary.phone, msg);
      await prisma.alertDelivery.update({
        where: { id: delivery.id },
        data: { status: "sent", sentAt: new Date() },
      });
      await prisma.alert.update({
        where: { id: alert.id },
        data: { doctorNotified: true },
      });
    } catch (err: any) {
      await prisma.alertDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "failed",
          lastError: err?.message ?? String(err),
          retryCount: { increment: 1 },
        },
      });
    }
  } catch (err) {
    console.error("[dispatchAlert] failed:", err);
  }
}
