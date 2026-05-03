import { prisma } from "../../db/client";
import { sendText } from "../../webhook/sender";
import { config } from "../../config/env";

/**
 * Notify a patient's care team when a new report (lab/imaging/pathology/document) is uploaded.
 *
 * Sends WhatsApp messages to all active care team members with a phone number.
 * Logs every dispatch attempt to AlertDelivery for audit purposes.
 *
 * Called from the document confirm hook (PATCH /documents/:id) and from the
 * extraction approval hook (PATCH /extraction-drafts/:id/approve).
 *
 * Designed to be fire-and-forget: errors during dispatch are logged but never
 * thrown, so a transient WhatsApp outage cannot block the upstream user action.
 */
export async function notifyReportUploaded(documentId: string): Promise<void> {
  try {
    const doc = await prisma.patientDocument.findUnique({
      where: { id: documentId },
      include: {
        patient: {
          include: {
            careTeamMembers: { where: { isActive: true } },
          },
        },
      },
    });

    if (!doc) return;
    if (doc.patient.careTeamMembers.length === 0) return;

    const categoryLabel = doc.category.replace(/_/g, " ").toLowerCase();
    const deepLink = `${config.coordinatorAppUrl}/dashboard/patients/${doc.patientId}`;
    // No patient name or document title in the message — PHI is behind auth.
    const msg = `📄 New ${categoryLabel} uploaded. Log in to Care Setu to review:\n${deepLink}`;

    // Create a synthetic Alert row so the AlertDelivery records have a parent
    // to point to. This unifies report-upload notifications with the rest of
    // the alert delivery audit trail.
    const alert = await prisma.alert.create({
      data: {
        patientId: doc.patientId,
        type: "REPORT_UPLOADED",
        severity: "info",
        message: `${categoryLabel}: ${doc.title}`,
        coordinatorNotified: true,
      },
    });

    for (const member of doc.patient.careTeamMembers) {
      if (!member.phone) continue;
      const delivery = await prisma.alertDelivery.create({
        data: {
          alertId: alert.id,
          channel: "whatsapp",
          recipientRef: member.phone,
          status: "pending",
        },
      });
      try {
        await sendText(member.phone, msg);
        await prisma.alertDelivery.update({
          where: { id: delivery.id },
          data: { status: "sent", sentAt: new Date() },
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
    }
  } catch (err) {
    console.error("[notifyReportUploaded] failed:", err);
  }
}
