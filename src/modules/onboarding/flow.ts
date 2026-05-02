import { prisma } from "../../db/client";
import { sendText, sendButtonMessage, sendListMessage } from "../../webhook/sender";
import type { Patient } from "@prisma/client";

// Cancer types for list message
const CANCER_TYPES = [
  { id: "breast", title: "Breast Cancer", description: "" },
  { id: "colorectal", title: "Colorectal Cancer", description: "" },
  { id: "cervical", title: "Cervical Cancer", description: "" },
  { id: "lung", title: "Lung Cancer", description: "" },
  { id: "oral", title: "Oral / Head & Neck", description: "" },
  { id: "blood", title: "Blood Cancer / Leukemia", description: "" },
  { id: "stomach", title: "Stomach / Gastric", description: "" },
  { id: "liver", title: "Liver Cancer", description: "" },
  { id: "ovarian", title: "Ovarian Cancer", description: "" },
  { id: "prostate", title: "Prostate Cancer", description: "" },
  { id: "other", title: "Other", description: "" },
];

// Treatment protocols
const PROTOCOLS = [
  { id: "AC-T", title: "AC-T (Breast)", description: "Doxorubicin + Cyclophosphamide + Taxol" },
  { id: "CMF", title: "CMF (Breast)", description: "Cyclophosphamide + Methotrexate + Fluorouracil" },
  { id: "FOLFOX", title: "FOLFOX (Colorectal)", description: "" },
  { id: "FOLFIRI", title: "FOLFIRI (Colorectal)", description: "" },
  { id: "CAPOX", title: "CAPOX (Colorectal)", description: "" },
  { id: "CARBOPLATIN-PACLITAXEL", title: "Carboplatin + Paclitaxel", description: "" },
  { id: "BEP", title: "BEP (Testicular)", description: "" },
  { id: "CHOP", title: "CHOP (Lymphoma)", description: "" },
  { id: "other", title: "Other / I don't know", description: "" },
];

const LANGUAGE_LABELS: Record<string, string> = {
  hi: "हिंदी (Hindi)",
  en: "English",
  mr: "मराठी (Marathi)",
  ta: "தமிழ் (Tamil)",
};

const GREETINGS: Record<string, string> = {
  hi: "नमस्ते! मैं आपका कैंसर केयर साथी हूँ। 💙\n\nमैं आपकी देखभाल, अपॉइंटमेंट बुकिंग, और इस सफर में आपके साथ रहने के लिए यहाँ हूँ।\n\nपहले बताइए — आप किस भाषा में बात करना पसंद करेंगे?",
  en: "Hello! I'm your cancer care companion. 💙\n\nI'm here to support you, book appointments, and walk with you through this journey.\n\nWhich language would you prefer?",
};

export async function handleOnboarding(
  whatsappNumber: string,
  patient: Patient | null,
  incomingText: string
) {
  const step = patient?.onboardingStep ?? 0;
  const data = (patient?.onboardingData as Record<string, any>) ?? {};

  switch (step) {
    case 0:
      return sendStep1_Language(whatsappNumber);

    case 1:
      return processLanguage(whatsappNumber, incomingText, data);

    case 2:
      return processName(whatsappNumber, patient!, incomingText, data);

    case 3:
      return processCancerType(whatsappNumber, patient!, incomingText, data);

    case 4:
      return processProtocol(whatsappNumber, patient!, incomingText, data);

    case 5:
      return processCycleInfo(whatsappNumber, patient!, incomingText, data);

    case 6:
      return processHospital(whatsappNumber, patient!, incomingText, data);

    case 7:
      return processCaregiver(whatsappNumber, patient!, incomingText, data);

    case 8:
      return processConsent(whatsappNumber, patient!, incomingText, data);

    default:
      return;
  }
}

async function sendStep1_Language(whatsappNumber: string) {
  // Save patient FIRST before sending message
  // If DB fails we know immediately before confusing the user
  try {
    await prisma.patient.upsert({
      where: { whatsappNumber },
      update: { onboardingStep: 1 },
      create: {
        whatsappNumber,
        onboardingStep: 1,
        name: "",
        cancerType: "",
        treatmentProtocol: "",
        cycleStartDate: new Date(),
        hospitalName: "",
        doctorName: "",
      },
    });
    console.log(`✅ Patient record created for ${whatsappNumber}`);
  } catch (err: any) {
    console.error(`❌ Failed to create patient record: ${err?.message}`);
    // Still send the buttons — we will retry upsert on next message
  }

  await sendButtonMessage(
    whatsappNumber,
    GREETINGS.en,
    [
      { id: "lang_hi", title: "हिंदी" },
      { id: "lang_en", title: "English" },
      { id: "lang_mr", title: "मराठी" },
    ]
  );
}

async function processLanguage(
  whatsappNumber: string,
  text: string,
  data: Record<string, any>
) {
  const lang = text.toLowerCase().includes("hindi") || text === "lang_hi" || text.includes("हिंदी")
    ? "hi"
    : text.toLowerCase().includes("marathi") || text === "lang_mr"
    ? "mr"
    : text.toLowerCase().includes("tamil") || text === "lang_ta"
    ? "ta"
    : "en";

  await prisma.patient.update({
    where: { whatsappNumber },
    data: {
      language: lang,
      onboardingStep: 2,
      onboardingData: { ...data, language: lang },
    },
  });

  const msg =
    lang === "hi"
      ? "अच्छा! अब बताइए — आपका पूरा नाम क्या है?"
      : lang === "mr"
      ? "छान! आता सांगा — तुमचे पूर्ण नाव काय आहे?"
      : "Great! What is your full name?";

  await sendText(whatsappNumber, msg);
}

async function processName(
  whatsappNumber: string,
  patient: Patient,
  name: string,
  data: Record<string, any>
) {
  const cleanName = name.trim();
  await prisma.patient.update({
    where: { whatsappNumber },
    data: {
      name: cleanName,
      onboardingStep: 3,
      onboardingData: { ...data, name: cleanName },
    },
  });

  const lang = patient.language || "hi";
  const intro =
    lang === "hi"
      ? `${cleanName} जी, शुक्रिया। 🙏\n\nआपको कौन सा कैंसर है? नीचे से चुनें:`
      : `Thank you, ${cleanName}. 🙏\n\nWhat type of cancer are you being treated for?`;

  await sendListMessage(
    whatsappNumber,
    intro,
    "Select type",
    [{ title: "Cancer Types", rows: CANCER_TYPES }]
  );
}

async function processCancerType(
  whatsappNumber: string,
  patient: Patient,
  text: string,
  data: Record<string, any>
) {
  const cancerType = CANCER_TYPES.find((c) => c.id === text || c.title.toLowerCase() === text.toLowerCase())?.title || text;

  await prisma.patient.update({
    where: { whatsappNumber },
    data: {
      cancerType,
      onboardingStep: 4,
      onboardingData: { ...data, cancerType },
    },
  });

  const lang = patient.language || "hi";
  const msg =
    lang === "hi"
      ? `ठीक है। आपका इलाज (treatment protocol) क्या है?\nडॉक्टर ने जो नाम बताया हो वो बताइए, या नीचे से चुनें:`
      : `Understood. What is your treatment protocol?\nYou can type what your doctor told you, or choose below:`;

  await sendListMessage(
    whatsappNumber,
    msg,
    "Select protocol",
    [{ title: "Treatment Protocols", rows: PROTOCOLS }]
  );
}

async function processProtocol(
  whatsappNumber: string,
  patient: Patient,
  text: string,
  data: Record<string, any>
) {
  const protocol = PROTOCOLS.find((p) => p.id === text)?.id || text.toUpperCase().trim();

  await prisma.patient.update({
    where: { whatsappNumber },
    data: {
      treatmentProtocol: protocol,
      onboardingStep: 5,
      onboardingData: { ...data, protocol },
    },
  });

  const lang = patient.language || "hi";
  const msg =
    lang === "hi"
      ? `समझ गया। आपका पहला cycle कब शुरू हुआ था?\nतारीख बताइए — जैसे: 15 April 2025\n\nऔर आप अभी कौन से cycle में हैं? (1, 2, 3...)`
      : `Got it. When did your first treatment cycle start?\nTell me the date — like: 15 April 2025\n\nAnd which cycle are you currently on? (1, 2, 3...)`;

  await sendText(whatsappNumber, msg);
}

async function processCycleInfo(
  whatsappNumber: string,
  patient: Patient,
  text: string,
  data: Record<string, any>
) {
  // Parse date and cycle number from free text using simple patterns
  const cycleMatch = text.match(/\b([1-9]|1[0-2])\b/);
  const currentCycle = cycleMatch ? parseInt(cycleMatch[1]!) : 1;

  // Try to parse date — look for day + month pattern
  const dateMatch = text.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)/i);
  let cycleStartDate = new Date();
  if (dateMatch) {
    cycleStartDate = new Date(`${dateMatch[1]} ${dateMatch[2]} ${new Date().getFullYear()}`);
    if (cycleStartDate > new Date()) cycleStartDate.setFullYear(cycleStartDate.getFullYear() - 1);
  }

  await prisma.patient.update({
    where: { whatsappNumber },
    data: {
      currentCycle,
      cycleStartDate,
      onboardingStep: 6,
      onboardingData: { ...data, currentCycle, cycleStartDate: cycleStartDate.toISOString() },
    },
  });

  const lang = patient.language || "hi";
  const msg =
    lang === "hi"
      ? `Cycle ${currentCycle} — ठीक है। 👍\n\nआप कौन से हॉस्पिटल में treatment ले रहे हैं?\nऔर आपके डॉक्टर का नाम क्या है?\n\nजैसे: "Kokilaben Hospital, Dr. Priya Sharma"`
      : `Cycle ${currentCycle} — noted. 👍\n\nWhich hospital are you receiving treatment at?\nAnd what is your doctor's name?\n\nExample: "Kokilaben Hospital, Dr. Priya Sharma"`;

  await sendText(whatsappNumber, msg);
}

async function processHospital(
  whatsappNumber: string,
  patient: Patient,
  text: string,
  data: Record<string, any>
) {
  // Parse "Hospital Name, Dr. Name" pattern
  const parts = text.split(/,\s*dr\.?\s*/i);
  const hospitalName = parts[0]?.trim() || text.trim();
  const doctorName = parts[1] ? `Dr. ${parts[1].trim()}` : "";

  await prisma.patient.update({
    where: { whatsappNumber },
    data: {
      hospitalName,
      doctorName,
      onboardingStep: 7,
      onboardingData: { ...data, hospitalName, doctorName },
    },
  });

  const lang = patient.language || "hi";
  const msg =
    lang === "hi"
      ? `${hospitalName} — नोट किया। 👍\n\nक्या आपके साथ कोई caregiver है जो आपकी देखभाल करते हैं?\n(जैसे पति/पत्नी, बच्चा, माता-पिता)\n\nउनका नाम और WhatsApp नंबर बताइए।\nया "Skip" लिखें यदि नहीं।`
      : `${hospitalName} — noted. 👍\n\nDo you have a caregiver who looks after you?\n(Like your spouse, child, or parent)\n\nShare their name and WhatsApp number.\nOr type "Skip" to continue.`;

  await sendText(whatsappNumber, msg);
}

async function processCaregiver(
  whatsappNumber: string,
  patient: Patient,
  text: string,
  data: Record<string, any>
) {
  let caregiverData = null;

  if (!text.toLowerCase().includes("skip")) {
    // Parse "Name, +91XXXXXXXXXX" or "Name: 9876543210"
    const phoneMatch = text.match(/(?:\+91|91)?([6-9]\d{9})/);
    const nameMatch = text.match(/^([^,\n0-9+]+)/);

    if (phoneMatch && nameMatch) {
      const caregiverNumber = `91${phoneMatch[1]}`;
      const caregiverName = nameMatch[1]?.trim() || "Caregiver";

      await prisma.caregiver.upsert({
        where: { whatsappNumber: caregiverNumber },
        update: { name: caregiverName, patientId: patient.id },
        create: {
          whatsappNumber: caregiverNumber,
          name: caregiverName,
          relationToPatient: "family",
          patientId: patient.id,
          isEnrolled: false,
        },
      });

      caregiverData = { name: caregiverName, number: caregiverNumber };

      // Send enrollment invitation to caregiver
      await sendText(
        caregiverNumber,
        `नमस्ते ${caregiverName} जी! 🙏\n\n${patient.name} जी ने आपको अपने Cancer Care Companion से जोड़ा है।\n\nमैं रोज़ आपको बताऊँगा कि वो कैसे हैं, और ज़रूरत पड़ने पर आपको inform करूँगा।\n\nJoin करने के लिए "हाँ" या "Yes" टाइप करें।`
      );
    }
  }

  await prisma.patient.update({
    where: { whatsappNumber },
    data: {
      onboardingStep: 8,
      onboardingData: { ...data, caregiver: caregiverData },
    },
  });

  await sendConsentMessage(whatsappNumber, patient.language);
}

async function sendConsentMessage(whatsappNumber: string, lang: string) {
  const msg =
    lang === "hi"
      ? `आखिरी चीज़ — आपकी privacy के बारे में:\n\n✅ आपकी जानकारी सिर्फ आपकी care के लिए use होगी\n✅ कभी भी बिना permission के share नहीं होगी\n✅ सिर्फ आपके doctor और caregiver को ज़रूरी updates मिलेंगे\n\n"Accept" करके आगे बढ़ें:`
      : `One last thing — about your privacy:\n\n✅ Your information is only used for your care\n✅ It is never shared without your permission\n✅ Only your doctor and caregiver receive necessary updates\n\nTap Accept to continue:`;

  await sendButtonMessage(whatsappNumber, msg, [
    { id: "consent_accept", title: "✅ Accept & Continue" },
    { id: "consent_decline", title: "❌ Not now" },
  ]);
}

async function processConsent(
  whatsappNumber: string,
  patient: Patient,
  text: string,
  data: Record<string, any>
) {
  if (text === "consent_decline" || text.toLowerCase().includes("not now")) {
    await sendText(
      whatsappNumber,
      "Okay — whenever you are ready, just message us again. We are here. 💙"
    );
    return;
  }

  // Complete onboarding
  await prisma.patient.update({
    where: { whatsappNumber },
    data: {
      onboardingStep: 9,
      onboardingData: { ...data, consentGiven: true },
    },
  });

  const lang = patient.language || "hi";
  const welcome =
    lang === "hi"
      ? `${patient.name} जी, आपका स्वागत है! 💙\n\nमैं अब आपके साथ हूँ।\n\nकल सुबह से मैं रोज़ आपका हाल पूछूँगा। अगर कभी रात को नींद न आए, या कुछ भी पूछना हो — बस message करें। मैं हमेशा यहाँ हूँ।\n\nआज के लिए — बस एक बात: अच्छे से आराम करें। 🙏`
      : `Welcome, ${patient.name}! 💙\n\nI'm here with you now.\n\nStarting tomorrow morning, I'll check in with you daily. If you can't sleep, or need anything at all — just message me. I'm always here.\n\nFor today — just one thing: rest well. 🙏`;

  await sendText(whatsappNumber, welcome);

  // Trigger first-day setup jobs
  await schedulePatientJobs(patient);
}

async function schedulePatientJobs(patient: Patient) {
  const { checkinQueue } = await import("../../jobs/queue");

  // Schedule first morning check-in for tomorrow 8 AM
  const tomorrow8am = new Date();
  tomorrow8am.setDate(tomorrow8am.getDate() + 1);
  tomorrow8am.setHours(8, 0, 0, 0);

  await checkinQueue.add(
    "morning-checkin",
    { patientId: patient.id, cycleDay: 1, type: "morning" },
    { delay: tomorrow8am.getTime() - Date.now(), repeat: { pattern: "0 8 * * *" } }
  );
}
