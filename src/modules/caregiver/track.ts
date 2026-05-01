import { prisma } from "../../db/client";
import { sendText, sendButtonMessage } from "../../webhook/sender";
import { askClaude } from "../../integrations/claude";
import { CAREGIVER_BRIEF_PROMPT } from "../../ai/prompts";
import { evaluateThresholds } from "../symptoms/thresholds";
import type { Caregiver, Patient } from "@prisma/client";

// Called when caregiver sends any message
export async function handleCaregiverMessage(
  caregiver: Caregiver & { patient: Patient },
  text: string,
  rawMessage: any
) {
  const patient = caregiver.patient;

  // Handle enrollment acceptance
  if (!caregiver.isEnrolled) {
    if (text.toLowerCase().match(/^(हाँ|han|yes|haan|ha|ok|okay|ji)/)) {
      await prisma.caregiver.update({
        where: { id: caregiver.id },
        data: { isEnrolled: true },
      });

      await sendText(
        caregiver.whatsappNumber,
        `धन्यवाद! 🙏 आप ${patient.name} जी के care companion से जुड़ गए हैं।\n\nरोज़ सुबह 6:30 बजे मैं आपको ${patient.name} जी का हाल बताऊँगा।\nज़रूरत पड़ने पर तुरंत inform करूँगा।\n\nअगर कोई सवाल हो — बस message करें। 💙`
      );

      // Notify patient
      await sendText(
        patient.whatsappNumber,
        patient.language === "hi"
          ? `${patient.name.split(" ")[0]} जी — आपके caregiver ${caregiver.name} जी जुड़ गए हैं। 💙 अब वो भी आपके updates पाएँगे।`
          : `${patient.name.split(" ")[0]} — your caregiver ${caregiver.name} has joined. 💙 They'll now receive your updates.`
      );
    } else {
      await sendText(
        caregiver.whatsappNumber,
        `Join करने के लिए "हाँ" या "Yes" टाइप करें।`
      );
    }
    return;
  }

  // Store conversation
  await prisma.caregiverConversation.create({
    data: {
      caregiverId: caregiver.id,
      role: "caregiver",
      content: text,
    },
  });

  // Check for weekly emotional check-in response
  if (rawMessage?.context?.id) {
    // This is a reply to a previous message — handle contextually
  }

  // Check if caregiver is reporting a symptom on behalf of patient
  const symptomKeywords = ["bukhar|fever|nausea|ulti|vomiting|dard|pain|breathing|sans|chakkar|dizziness|rash"];
  const isSymptomReport = new RegExp(symptomKeywords.join("|"), "i").test(text);

  if (isSymptomReport) {
    await handleCaregiverSymptomReport(caregiver, patient, text);
    return;
  }

  // Check if it's a wellbeing response (for caregiver's own check-in)
  const lowerText = text.toLowerCase();
  if (lowerText.match(/^(thak|tired|exhaust|nahi|not ok|mushkil|hard|stressed|bura|bad)/)) {
    await sendText(
      caregiver.whatsappNumber,
      `Sunna tha. Aap bahut kuch uthaa rahe hain. 💙\n\nYe zaroor yaad rakhein — agar aap thak jaate hain, to unki care bhi mushkil hogi. Thodi der apne liye bhi lena — bilkul sahi hai.\n\nKya kuch specific hai jo bahut heavy lag raha hai abhi?`
    );
    return;
  }

  // General reply — acknowledge
  await sendText(
    caregiver.whatsappNumber,
    `Shukriya message karne ke liye. 💙 Kya kuch specific help chahiye?`
  );
}

async function handleCaregiverSymptomReport(
  caregiver: Caregiver,
  patient: Patient,
  text: string
) {
  // Apply the same threshold logic but from caregiver perspective
  // Map common caregiver descriptions to symptom codes
  const symptomMap: Record<string, string> = {
    bukhar: "fever",
    fever: "fever",
    ulti: "vomiting",
    vomiting: "vomiting",
    nausea: "nausea",
    dard: "pain",
    pain: "pain",
    breathing: "breathing_difficulty",
    sans: "breathing_difficulty",
    chakkar: "dizziness",
    dizziness: "dizziness",
  };

  const detectedSymptoms = Object.entries(symptomMap)
    .filter(([keyword]) => new RegExp(keyword, "i").test(text))
    .map(([, symptom]) => symptom);

  const cycleDay = getCycleDay(patient.cycleStartDate, patient.currentCycle);

  // Send threshold guidance back to caregiver
  if (detectedSymptoms.includes("fever") || detectedSymptoms.includes("breathing_difficulty")) {
    await sendText(
      caregiver.whatsappNumber,
      `⚠️ Ye symptoms check karna zaruri hai.\n\n• Agar fever 38°C se upar hai → aaj hi hospital le jaayein\n• Agar sans lene mein takleef hai → ABHI hospital ya ambulance call karein\n\nHospital: aapka registered hospital\nCare team: ${process.env.COORDINATOR_WHATSAPP_NUMBER || "registered number"}`
    );
  } else if (detectedSymptoms.includes("vomiting")) {
    await sendText(
      caregiver.whatsappNumber,
      `Ulti ho rahi hai — dehydration se bachna zaroori hai.\n\n• Thoda thoda paani ya ORS dete rahen\n• Agar 6 ghante se zyada ho → care team ko call karein\n• Dawai ke saath khaana khilaane ki koshish karein`
    );
  } else {
    await sendText(
      caregiver.whatsappNumber,
      `Samjha. Symptoms note kar liye.\n\nKya abhi unka score kya lagta hai (1 bahut mushkil se 5 theek) agar aap rate karein?`
    );
  }

  // Also create a note on the patient's record
  await prisma.alert.create({
    data: {
      patientId: patient.id,
      type: "caregiver_report",
      severity: detectedSymptoms.some((s) => ["fever", "breathing_difficulty"].includes(s))
        ? "urgent"
        : "info",
      message: `Caregiver reported: ${text.substring(0, 200)}`,
      caregiverNotified: true,
    },
  });
}

// BullMQ job: send daily morning brief to caregiver
export async function sendCaregiverMorningBrief(patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { caregiver: true },
  });

  if (!patient?.caregiver?.isEnrolled) return;

  const yesterday = await prisma.checkin.findFirst({
    where: { patientId },
    orderBy: { createdAt: "desc" },
  });

  const cycleDay = getCycleDay(patient.cycleStartDate, patient.currentCycle);

  // Get protocol day profile
  const protocol = await prisma.treatmentProtocol.findUnique({
    where: { name: patient.treatmentProtocol },
  });

  const dayProfiles = (protocol?.dayProfiles as any[]) || [];
  const todayProfile = dayProfiles.find(
    (d: any) => d.day === cycleDay || (d.dayRange && cycleDay >= d.dayRange[0] && cycleDay <= d.dayRange[1])
  ) || { description: "Monitoring day", expectedSymptoms: [] };

  const brief = await askClaude(
    CAREGIVER_BRIEF_PROMPT(
      patient.name,
      patient.caregiver.name,
      cycleDay,
      patient.treatmentProtocol,
      yesterday?.score ?? null,
      yesterday?.symptoms ?? [],
      todayProfile
    ),
    "Generate the morning brief now.",
    256
  );

  await sendText(patient.caregiver.whatsappNumber, brief);

  await prisma.caregiverConversation.create({
    data: {
      caregiverId: patient.caregiver.id,
      role: "system",
      content: brief,
    },
  });
}

// BullMQ job: weekly emotional check-in for caregiver (Sundays)
export async function sendCaregiverWeeklyCheck(patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { caregiver: true },
  });

  if (!patient?.caregiver?.isEnrolled) return;

  // Count good vs hard days this week
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const checkins = await prisma.checkin.findMany({
    where: { patientId, createdAt: { gte: weekAgo } },
  });

  const goodDays = checkins.filter((c) => c.score >= 4).length;
  const hardDays = checkins.filter((c) => c.score <= 2).length;

  const weeksInCare = Math.floor(
    (Date.now() - new Date(patient.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 7)
  );

  const msg = `Aap ${weeksInCare} hafte se is safar mein hain. Ye asaan nahi hai. 💙\n\nIs hafte ${patient.name} ke:\n✅ ${goodDays} achhe din\n${hardDays > 0 ? `😔 ${hardDays} mushkil din` : ""}\n\nAapne sab sambhala. Ye chhota nahi hai.\n\nKya kuch hai jo abhi bahut heavy lag raha hai?\nMujhe batayein — ye baat sirf hamare beech hai.`;

  await sendText(patient.caregiver.whatsappNumber, msg);
}

function getCycleDay(cycleStartDate: Date, currentCycle: number): number {
  const now = new Date();
  const diffMs = now.getTime() - new Date(cycleStartDate).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return (diffDays % 21) + 1;
}
