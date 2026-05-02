import { prisma } from "../../db/client";
import { messagingRouter } from "../../messaging/router";
import { askClaudeWithHistory } from "../../integrations/claude";
import {
  EMOTIONAL_SUPPORT_DAYTIME_PROMPT,
  EMOTIONAL_SUPPORT_NIGHT_PROMPT,
} from "../../ai/prompts";
import type { Patient } from "@prisma/client";

// Crisis keywords in Hindi, English, Marathi
const CRISIS_KEYWORDS = [
  "marna chahta", "marna chahti", "mar jaana", "khatam karna", "khatam kar lu",
  "want to die", "end it all", "give up", "no point", "koi fayda nahi",
  "jeena nahi", "nahi rehna", "chhod dena", "suicide", "khud ko",
  "aatmahatya", "sanpna chahta"
];

export async function handleEmotionalSupport(
  patient: Patient,
  text: string,
  isNight: boolean,
  recentConversations: { role: string; content: string; createdAt: Date }[]
) {
  // Crisis detection — always takes priority
  const isCrisis = CRISIS_KEYWORDS.some((kw) =>
    text.toLowerCase().includes(kw.toLowerCase())
  );

  if (isCrisis) {
    await handleCrisis(patient);
    return;
  }

  // Build conversation history for Claude (last 5 exchanges max)
  const history: { role: "user" | "assistant"; content: string }[] = recentConversations
    .slice(0, 5)
    .reverse()
    .map((m) => ({
      role: m.role === "patient" ? "user" : "assistant",
      content: m.content,
    }));

  // Add current message
  history.push({ role: "user", content: text });

  const cycleDay = getCycleDay(patient.cycleStartDate, patient.currentCycle);

  let systemPrompt: string;

  if (isNight) {
    systemPrompt = EMOTIONAL_SUPPORT_NIGHT_PROMPT(
      patient.name,
      patient.language,
      cycleDay
    );
  } else {
    const caregiver = await prisma.caregiver.findUnique({ where: { patientId: patient.id } });
    systemPrompt = EMOTIONAL_SUPPORT_DAYTIME_PROMPT(
      patient.name,
      patient.language,
      cycleDay,
      patient.treatmentProtocol,
      patient.currentCycle,
      caregiver?.name ?? null,
      patient.personalNotes ?? null
    );
  }

  const response = await askClaudeWithHistory(systemPrompt, history, 256);

  // Check if Claude flagged a crisis in night mode
  if (response.includes("##CRISIS##")) {
    const cleanResponse = response.replace("##CRISIS##", "").trim();
    await messagingRouter.sendText(patient.id, cleanResponse);
    await handleCrisis(patient);
    return;
  }

  await messagingRouter.sendText(patient.id, response);

  // Store the response
  await prisma.conversation.create({
    data: {
      patientId: patient.id,
      role: "system",
      messageType: "emotional",
      content: response,
      isNightMode: isNight,
      intent: "emotional_support",
    },
  });

  // Track night distress pattern
  if (isNight) {
    await trackNightDistress(patient.id);
  }

  // Extract and store any personal context (things patient shares about their life)
  await extractPersonalContext(patient, text);
}

async function handleCrisis(patient: Patient) {
  const coordinatorNumber = process.env.COORDINATOR_WHATSAPP_NUMBER;
  const lang = patient.language;

  // Immediate warm response to patient
  const crisisMsg =
    lang === "hi"
      ? `Aap jo feel kar rahe hain, wo real hai. Aur aap akele nahi hain. 💙\n\nAbhi ek kaam karein — apne kisi karibi ko call karein, ya humein call karein:\n📞 ${coordinatorNumber || "apne care coordinator ko"}\n\nYe moment guzar jaega. Hum yahan hain.`
      : `What you're feeling is real. And you are not alone. 💙\n\nDo one thing right now — call someone close to you, or call us:\n📞 ${coordinatorNumber || "your care coordinator"}\n\nThis moment will pass. We are here.`;

  await messagingRouter.sendText(patient.id, crisisMsg);

  // Create urgent alert
  await prisma.alert.create({
    data: {
      patientId: patient.id,
      type: "crisis",
      severity: "urgent",
      message: "Patient expressed possible suicidal ideation or crisis state",
    },
  });

  // Notify coordinator immediately
  if (coordinatorNumber) {
    await messagingRouter.sendText(
      coordinatorNumber,
      `🚨 URGENT — CRISIS ALERT\n\nPatient: ${patient.name}\nWhatsApp: +${patient.whatsappNumber}\nTreatment: ${patient.treatmentProtocol} Cycle ${patient.currentCycle}\n\nPatient expressed distress suggesting possible crisis.\nPlease call them within the next 15 minutes.`,
      true
    );
  }

  // Notify caregiver
  const caregiver = await prisma.caregiver.findUnique({ where: { patientId: patient.id } });
  if (caregiver?.isEnrolled) {
    await messagingRouter.sendText(
      caregiver.whatsappNumber,
      `💙 Please check on ${patient.name} right now. They reached out and seem to be having a very difficult time emotionally. A gentle call or visit would mean a lot.`,
      true
    );
  }
}

async function trackNightDistress(patientId: string) {
  // Count night messages in last 3 nights
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const nightMessages = await prisma.conversation.count({
    where: {
      patientId,
      isNightMode: true,
      role: "patient",
      createdAt: { gte: threeDaysAgo },
    },
  });

  if (nightMessages >= 3) {
    // Flag to caregiver (not an alert — just a note)
    const caregiver = await prisma.caregiver.findUnique({ where: { patientId } });
    if (caregiver?.isEnrolled) {
      const existing = await prisma.alert.findFirst({
        where: {
          patientId,
          type: "night_distress",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });

      if (!existing) {
        await prisma.alert.create({
          data: {
            patientId,
            type: "night_distress",
            severity: "info",
            message: "Patient has been awake and messaging for 3+ nights",
            caregiverNotified: true,
          },
        });

        await messagingRouter.sendText(
          caregiver.whatsappNumber,
          `Ek baat — ${(await prisma.patient.findUnique({ where: { id: patientId } }))?.name} pichhle kuch raaton mein neend nahi aa rahi. Agar ho sake to ek baar unse poochhein ke neend kaisi hai. 💙`,
          true
        );
      }
    }
  }
}

async function extractPersonalContext(patient: Patient, text: string) {
  // Simple heuristic: look for mentions of family events, relationships, goals
  const personalMarkers = [
    "shaadi", "wedding", "beti", "beta", "daughter", "son", "bacche",
    "birthday", "janmdin", "retire", "safar", "travel", "school", "exam"
  ];

  const hasPersonalContext = personalMarkers.some((marker) =>
    text.toLowerCase().includes(marker)
  );

  if (hasPersonalContext && text.length > 20) {
    // Append to personal notes (keep last 500 chars)
    const currentNotes = patient.personalNotes || "";
    const newNote = `[${new Date().toLocaleDateString("en-IN")}] ${text.substring(0, 150)}`;
    const updatedNotes = `${currentNotes}\n${newNote}`.slice(-500);

    await prisma.patient.update({
      where: { id: patient.id },
      data: { personalNotes: updatedNotes },
    });
  }
}

function getCycleDay(cycleStartDate: Date, currentCycle: number): number {
  const now = new Date();
  const diffMs = now.getTime() - new Date(cycleStartDate).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return (diffDays % 21) + 1;
}
