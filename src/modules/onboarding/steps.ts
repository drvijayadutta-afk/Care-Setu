import type { OnboardingStep, StepContext, StepResult } from "./types";

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

const GREETINGS = {
  en: "Hello! I'm your Care Setu companion. 💙\n\nI'm here to support you, book appointments, and walk with you through this journey.\n\nWhich language would you prefer?",
  hi: "नमस्ते! मैं आपका Care Setu साथी हूँ। 💙\n\nआप किस भाषा में बात करना पसंद करेंगे?",
};

// ─── Step 0: Language Selection ────────────────────────────────────────────────
export const step0_Language: OnboardingStep = {
  id: "language",
  stepNumber: 0,
  prompt: () => GREETINGS.en,
  handle: async (input: string, ctx: StepContext): Promise<StepResult> => {
    const lang =
      input === "lang_hi" || input.includes("हिंदी") || input.toLowerCase().includes("hindi")
        ? "hi"
        : input === "lang_mr" || input.toLowerCase().includes("marathi")
          ? "mr"
          : input === "lang_ta" || input.toLowerCase().includes("tamil")
            ? "ta"
            : "en";

    return {
      nextStepId: "name",
      sideEffects: [
        {
          type: "update_patient",
          data: {
            language: lang,
            onboardingStep: 1,
            onboardingData: { ...ctx.onboardingData, language: lang },
          },
        },
        {
          type: "send_message",
          text:
            lang === "hi"
              ? "अच्छा! आपका पूरा नाम क्या है?"
              : lang === "mr"
                ? "छान! तुमचे पूर्ण नाव काय आहे?"
                : "Great! What is your full name?",
        },
      ],
    };
  },
};

// ─── Step 1: Name Entry ────────────────────────────────────────────────────────
export const step1_Name: OnboardingStep = {
  id: "name",
  stepNumber: 1,
  prompt: (ctx) => {
    const lang = ctx.patient.language || "en";
    return lang === "hi"
      ? "अच्छा! आपका पूरा नाम क्या है?"
      : "Great! What is your full name?";
  },
  handle: async (input: string, ctx: StepContext): Promise<StepResult> => {
    const cleanName = input.trim() || "Friend";
    const lang = ctx.patient.language || "en";

    const intro =
      lang === "hi"
        ? `${cleanName} जी, शुक्रिया। 🙏\n\nआपको कौन सा कैंसर है? नीचे से चुनें:`
        : `Thank you, ${cleanName}. 🙏\n\nWhat type of cancer are you being treated for? Choose below:`;

    return {
      nextStepId: "cancer-type",
      sideEffects: [
        {
          type: "update_patient",
          data: {
            name: cleanName,
            onboardingStep: 2,
            onboardingData: { ...ctx.onboardingData, name: cleanName },
          },
        },
        {
          type: "send_list",
          body: intro,
          sections: [{ title: "Cancer Types", rows: CANCER_TYPES }],
        },
      ],
    };
  },
};

// ─── Step 2: Cancer Type Selection ─────────────────────────────────────────────
export const step2_CancerType: OnboardingStep = {
  id: "cancer-type",
  stepNumber: 2,
  prompt: (ctx) => {
    const lang = ctx.patient.language || "en";
    return lang === "hi"
      ? `आपको कौन सा कैंसर है? नीचे से चुनें:`
      : `What type of cancer are you being treated for? Choose below:`;
  },
  handle: async (input: string, ctx: StepContext): Promise<StepResult> => {
    const cancerType =
      CANCER_TYPES.find((c) => c.id === input || c.title.toLowerCase() === input.toLowerCase())
        ?.title || input;
    const lang = ctx.patient.language || "en";

    const msg =
      lang === "hi"
        ? `ठीक है। आपका treatment protocol क्या है?\nनीचे से चुनें, या type करें:`
        : `Got it. What is your treatment protocol?\nChoose below, or type it:`;

    return {
      nextStepId: "protocol",
      sideEffects: [
        {
          type: "update_patient",
          data: {
            cancerType,
            onboardingStep: 3,
            onboardingData: { ...ctx.onboardingData, cancerType },
          },
        },
        {
          type: "send_list",
          body: msg,
          sections: [{ title: "Treatment Protocols", rows: PROTOCOLS }],
        },
      ],
    };
  },
};

// ─── Step 3: Treatment Protocol ────────────────────────────────────────────────
export const step3_Protocol: OnboardingStep = {
  id: "protocol",
  stepNumber: 3,
  prompt: (ctx) => {
    const lang = ctx.patient.language || "en";
    return lang === "hi"
      ? `आपका treatment protocol क्या है?`
      : `What is your treatment protocol?`;
  },
  handle: async (input: string, ctx: StepContext): Promise<StepResult> => {
    const protocol = PROTOCOLS.find((p) => p.id === input)?.id || input.toUpperCase().trim();
    const lang = ctx.patient.language || "en";

    const msg =
      lang === "hi"
        ? `समझ गया। आपका पहला cycle कब शुरू हुआ?\nजैसे: 15 April 2025\n\nऔर अभी कौन से cycle में हैं? (1, 2, 3...)`
        : `Got it. When did your first treatment cycle start?\nLike: 15 April 2025\n\nAnd which cycle are you on now? (1, 2, 3...)`;

    return {
      nextStepId: "cycle-info",
      sideEffects: [
        {
          type: "update_patient",
          data: {
            treatmentProtocol: protocol,
            onboardingStep: 4,
            onboardingData: { ...ctx.onboardingData, protocol },
          },
        },
        { type: "send_message", text: msg },
      ],
    };
  },
};

// ─── Step 4: Cycle Information ─────────────────────────────────────────────────
export const step4_CycleInfo: OnboardingStep = {
  id: "cycle-info",
  stepNumber: 4,
  prompt: (ctx) => {
    const lang = ctx.patient.language || "en";
    return lang === "hi"
      ? `आपका पहला cycle कब शुरू हुआ?`
      : `When did your first treatment cycle start?`;
  },
  handle: async (input: string, ctx: StepContext): Promise<StepResult> => {
    const cycleMatch = input.match(/\b([1-9]|1[0-2])\b/);
    const currentCycle = cycleMatch ? parseInt(cycleMatch[1]!) : 1;

    const dateMatch = input.match(
      /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)/i
    );
    let cycleStartDate = new Date();
    if (dateMatch) {
      cycleStartDate = new Date(`${dateMatch[1]} ${dateMatch[2]} ${new Date().getFullYear()}`);
      if (cycleStartDate > new Date())
        cycleStartDate.setFullYear(cycleStartDate.getFullYear() - 1);
    }

    const lang = ctx.patient.language || "en";
    const msg =
      lang === "hi"
        ? `Cycle ${currentCycle} — ठीक है। 👍\n\nआप कौन से hospital में treatment ले रहे हैं?\nऔर आपके doctor का नाम क्या है?\n\nजैसे: Kokilaben Hospital, Dr. Priya Sharma`
        : `Cycle ${currentCycle} — noted. 👍\n\nWhich hospital are you receiving treatment at?\nAnd your doctor's name?\n\nExample: Kokilaben Hospital, Dr. Priya Sharma`;

    return {
      nextStepId: "hospital",
      sideEffects: [
        {
          type: "update_patient",
          data: {
            currentCycle,
            cycleStartDate,
            onboardingStep: 5,
            onboardingData: {
              ...ctx.onboardingData,
              currentCycle,
              cycleStartDate: cycleStartDate.toISOString(),
            },
          },
        },
        { type: "send_message", text: msg },
      ],
    };
  },
};

// ─── Step 5: Hospital & Doctor ─────────────────────────────────────────────────
export const step5_Hospital: OnboardingStep = {
  id: "hospital",
  stepNumber: 5,
  prompt: (ctx) => {
    const lang = ctx.patient.language || "en";
    return lang === "hi"
      ? `आप कौन से hospital में treatment ले रहे हैं?`
      : `Which hospital are you receiving treatment at?`;
  },
  handle: async (input: string, ctx: StepContext): Promise<StepResult> => {
    const parts = input.split(/,\s*dr\.?\s*/i);
    const hospitalName = parts[0]?.trim() || input.trim();
    const doctorName = parts[1] ? `Dr. ${parts[1].trim()}` : "Not specified";

    const lang = ctx.patient.language || "en";
    const msg =
      lang === "hi"
        ? `${hospitalName} — नोट किया। 👍\n\nक्या आपके साथ कोई caregiver है जो आपकी देखभाल करते हैं?\n(जैसे पति/पत्नी, बच्चा, माता-पिता)\n\nउनका नाम और phone number बताइए।\nया "Skip" लिखें।`
        : `${hospitalName} — noted. 👍\n\nDo you have a caregiver who looks after you?\n(Like your spouse, child, or parent)\n\nShare their name and phone number.\nOr type "Skip" to continue.`;

    return {
      nextStepId: "caregiver",
      sideEffects: [
        {
          type: "update_patient",
          data: {
            hospitalName,
            doctorName,
            onboardingStep: 6,
            onboardingData: { ...ctx.onboardingData, hospitalName, doctorName },
          },
        },
        { type: "send_message", text: msg },
      ],
    };
  },
};

// ─── Step 6: Caregiver Information ─────────────────────────────────────────────
export const step6_Caregiver: OnboardingStep = {
  id: "caregiver",
  stepNumber: 6,
  prompt: (ctx) => {
    const lang = ctx.patient.language || "en";
    return lang === "hi"
      ? `क्या आपके साथ कोई caregiver है?`
      : `Do you have a caregiver?`;
  },
  handle: async (input: string, ctx: StepContext): Promise<StepResult> => {
    const effects: any[] = [];

    if (!input.toLowerCase().includes("skip")) {
      const phoneMatch = input.match(/(?:\+91|91)?([6-9]\d{9})/);
      const nameMatch = input.match(/^([^,\n0-9+]+)/);

      if (phoneMatch && nameMatch) {
        const caregiverNumber = `91${phoneMatch[1]}`;
        const caregiverName = nameMatch[1]?.trim() || "Caregiver";

        effects.push({
          type: "create_caregiver",
          caregiverNumber,
          caregiverName,
        });
      }
    }

    const lang = ctx.patient.language || "en";
    const msg =
      lang === "hi"
        ? `आखिरी चीज़ — आपकी privacy:\n\n✅ आपकी जानकारी सिर्फ आपकी care के लिए\n✅ कभी बिना permission share नहीं होगी\n✅ सिर्फ doctor और caregiver को ज़रूरी updates\n\nAgree करके आगे बढ़ें:`
        : `Last step — your privacy:\n\n✅ Your info is only used for your care\n✅ Never shared without your permission\n✅ Only your doctor & caregiver get updates\n\nTap to continue:`;

    effects.push({
      type: "update_patient",
      data: {
        onboardingStep: 7,
        onboardingData: { ...ctx.onboardingData, caregiver: null },
      },
    });

    effects.push({
      type: "send_buttons",
      body: msg,
      buttons: [
        { id: "consent_accept", title: "✅ Accept & Continue" },
        { id: "consent_decline", title: "Not now" },
      ],
    });

    return {
      nextStepId: "consent",
      sideEffects: effects,
    };
  },
};

// ─── Step 7: Consent ────────────────────────────────────────────────────────────
export const step7_Consent: OnboardingStep = {
  id: "consent",
  stepNumber: 7,
  prompt: (ctx) => {
    const lang = ctx.patient.language || "en";
    return lang === "hi"
      ? `आखिरी चीज़ — आपकी privacy`
      : `Last step — your privacy`;
  },
  handle: async (input: string, ctx: StepContext): Promise<StepResult> => {
    if (input === "consent_decline" || input.toLowerCase().includes("not now")) {
      return {
        nextStepId: "consent", // Re-ask for consent
        sideEffects: [
          {
            type: "send_message",
            text: "Okay — whenever you're ready, just message me. I'm here. 💙",
          },
        ],
      };
    }

    const lang = ctx.patient.language || "en";
    const name = ctx.patient.name || "Friend";

    const welcome =
      lang === "hi"
        ? `${name} जी, आपका स्वागत है! 💙\n\nमैं अब आपके साथ हूँ। कल सुबह से रोज़ आपका हाल पूछूँगा।\n\nअगर रात को नींद न आए, या कुछ भी पूछना हो — बस message करें। 🙏\n\nआज के लिए — अच्छे से आराम करें।`
        : `Welcome, ${name}! 💙\n\nI'm here with you now. Starting tomorrow morning, I'll check in with you daily.\n\nIf you can't sleep or need anything — just message me. I'm always here. 🙏\n\nFor today — rest well.`;

    return {
      nextStepId: null, // End of onboarding
      sideEffects: [
        {
          type: "update_patient",
          data: {
            onboardingStep: 8,
            onboardingData: { ...ctx.onboardingData, consentGiven: true },
          },
        },
        { type: "send_message", text: welcome },
        { type: "schedule_checkin", patientId: ctx.patient.id },
      ],
    };
  },
};

// ─── Step Registry ──────────────────────────────────────────────────────────────
export const ONBOARDING_STEPS: Record<string, OnboardingStep> = {
  language: step0_Language,
  name: step1_Name,
  "cancer-type": step2_CancerType,
  protocol: step3_Protocol,
  "cycle-info": step4_CycleInfo,
  hospital: step5_Hospital,
  caregiver: step6_Caregiver,
  consent: step7_Consent,
};

// ─── Step Lookup by Step Number ────────────────────────────────────────────────
const STEPS_BY_NUMBER: Record<number, OnboardingStep> = {
  0: step0_Language,
  1: step1_Name,
  2: step2_CancerType,
  3: step3_Protocol,
  4: step4_CycleInfo,
  5: step5_Hospital,
  6: step6_Caregiver,
  7: step7_Consent,
};

export function getStepByNumber(stepNumber: number): OnboardingStep | undefined {
  return STEPS_BY_NUMBER[stepNumber];
}
