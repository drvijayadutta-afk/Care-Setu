import { prisma } from "../../db/client";

export function logOutbound(params: {
  patientId: string;
  channel: string;
  recipientRef: string;
  messageType: string;
  content: string;
  externalId?: string | null;
  jobId?: string;
  failed?: string;
}): void {
  prisma.outboundMessage
    .create({
      data: {
        patientId:    params.patientId,
        channel:      params.channel,
        recipientRef: params.recipientRef,
        messageType:  params.messageType,
        content:      params.content,
        externalId:   params.externalId ?? null,
        status:       params.failed ? "failed" : "sent",
        jobId:        params.jobId ?? null,
        failureReason: params.failed ?? null,
      },
    })
    .catch((err) => console.error("[outbound-logger] write failed:", err));
}
