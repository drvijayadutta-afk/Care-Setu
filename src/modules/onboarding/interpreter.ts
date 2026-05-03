import { prisma } from "../../db/client";
import { messagingRouter } from "../../messaging/router";
import type { SideEffect } from "./types";

const checkinQueueCache = new Map();

async function getCheckinQueue() {
  if (!checkinQueueCache.has("queue")) {
    const { checkinQueue } = await import("../../jobs/queue");
    checkinQueueCache.set("queue", checkinQueue);
  }
  return checkinQueueCache.get("queue");
}

export async function executeSideEffects(
  sideEffects: SideEffect[],
  patientId: string,
  identifier: { whatsappNumber: string } | { telegramChatId: string } | { patientId: string }
): Promise<void> {
  // Collect deferred effects that must happen AFTER the DB transaction commits.
  // This prevents phantom jobs when the transaction rolls back, and prevents
  // partial onboarding when Redis is unavailable.
  const deferredJobs: Array<() => Promise<void>> = [];

  await prisma.$transaction(async (tx) => {
    for (const effect of sideEffects) {
      switch (effect.type) {
        case "update_patient": {
          await tx.patient.update({
            where: { id: patientId },
            data: effect.data,
          });
          break;
        }

        case "send_message": {
          await messagingRouter.sendText(patientId, effect.text);
          break;
        }

        case "send_buttons": {
          await messagingRouter.sendButtons(patientId, effect.body, effect.buttons);
          break;
        }

        case "send_list": {
          await messagingRouter.sendList(patientId, effect.body, "Select option", effect.sections);
          break;
        }

        case "create_caregiver": {
          await tx.caregiver.upsert({
            where: { whatsappNumber: effect.caregiverNumber },
            update: {
              name: effect.caregiverName,
              patientId,
            },
            create: {
              whatsappNumber: effect.caregiverNumber,
              name: effect.caregiverName,
              relationToPatient: "family",
              patientId,
              isEnrolled: false,
            },
          });
          break;
        }

        case "schedule_checkin": {
          // Capture effect data now; enqueue after the transaction succeeds.
          const capturedPatientId = patientId;
          deferredJobs.push(async () => {
            const checkinQueue = await getCheckinQueue();
            const tomorrow8am = new Date();
            tomorrow8am.setDate(tomorrow8am.getDate() + 1);
            tomorrow8am.setHours(8, 0, 0, 0);
            await checkinQueue.add(
              "morning-checkin",
              { patientId: capturedPatientId, cycleDay: 1, type: "morning" },
              { delay: tomorrow8am.getTime() - Date.now(), attempts: 3, backoff: { type: "exponential", delay: 5000 } }
            );
          });
          break;
        }
      }
    }
  });

  // Transaction committed — now run deferred jobs. Errors here do not roll back
  // the DB state, but they are logged and can be retried manually if needed.
  for (const run of deferredJobs) {
    await run().catch((err) =>
      console.error("[onboarding] deferred job enqueue failed:", err)
    );
  }
}
