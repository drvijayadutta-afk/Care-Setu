"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateThresholds = evaluateThresholds;
const client_1 = require("../../db/client");
const sender_1 = require("../../webhook/sender");
// The 10 core threshold rules, protocol-informed
const THRESHOLD_RULES = [
    {
        id: "fever_post_chemo",
        description: "Fever with chills post-chemo (possible neutropenia)",
        check: ({ symptoms, cycleDay }) => cycleDay >= 5 && cycleDay <= 14 && symptoms.includes("fever") && symptoms.includes("chills"),
        severity: "urgent",
        patientMessage: (lang) => lang === "hi"
            ? "⚠️ Chemotherapy के बाद बुखार + ठंड लगना गंभीर हो सकता है।\n\nABHI thermometer से check करें:\n• 38°C (100.4°F) से ऊपर → आज hospital जाएं\n• नीचे है → 2 घंटे में दोबारा check करें\n\nआपके caregiver और care team को inform कर दिया है।"
            : "⚠️ Fever with chills after chemotherapy can sometimes be serious.\n\nCheck with a thermometer NOW:\n• Above 38°C (100.4°F) → Go to hospital today\n• Below → Check again in 2 hours\n\nYour caregiver and care team have been informed.",
        caregiverMessage: "⚠️ URGENT: Patient reported fever + chills (possible neutropenia after chemo).\nPlease check their temperature. If above 38°C, take them to the hospital TODAY.",
        notifyCoordinator: true,
        notifyDoctor: true,
    },
    {
        id: "prolonged_vomiting",
        description: "Vomiting reported 3+ consecutive days",
        check: ({ symptoms, recentCheckins }) => {
            if (!symptoms.includes("vomiting"))
                return false;
            const last3 = recentCheckins.slice(0, 3);
            return last3.length >= 3 && last3.every((c) => c.symptoms.includes("vomiting"));
        },
        severity: "caution",
        patientMessage: (lang) => lang === "hi"
            ? "3 दिनों से उल्टी हो रही है — ये dehydration का sign हो सकता है।\n\nज़रूरी है:\n• थोड़ा-थोड़ा ORS पीते रहें\n• खाना force मत करें\n• अगर पानी भी नहीं रह रहा → आज care team को call करें\n\nHospital नंबर: [HOSPITAL_NUMBER]"
            : "Vomiting for 3+ days may lead to dehydration.\n\nImportant:\n• Keep sipping ORS in small amounts\n• Don't force food\n• If unable to keep water down → call your care team today\n\nHospital: [HOSPITAL_NUMBER]",
        caregiverMessage: "Patient has reported vomiting for 3 consecutive days. Please monitor hydration. If they cannot keep water down, take them to the hospital today.",
        notifyCoordinator: true,
        notifyDoctor: false,
    },
    {
        id: "consistently_low_score",
        description: "Score 1 or 2 for 5+ consecutive days",
        check: ({ recentCheckins }) => {
            const last5 = recentCheckins.slice(0, 5);
            return last5.length >= 5 && last5.every((c) => c.score <= 2);
        },
        severity: "caution",
        patientMessage: (lang) => lang === "hi"
            ? "5 दिनों से बहुत मुश्किल चल रहा है — ये जानना ज़रूरी था।\n\nआपके doctor को इस बारे में बताना होगा। हमने उनके लिए एक note तैयार किया है।\n\nआप अकेले नहीं हैं। 💙"
            : "5 difficult days in a row — it was important to know this.\n\nYour doctor needs to hear about this. We've prepared a note for them.\n\nYou are not alone. 💙",
        caregiverMessage: "Patient has scored 1-2 for 5 consecutive days. This pattern suggests significant distress or poor symptom control. Please check in with them and consider contacting the care team.",
        notifyCoordinator: true,
        notifyDoctor: true,
    },
    {
        id: "prolonged_mouth_sores",
        description: "Mouth sores for 5+ days",
        check: ({ symptoms, recentCheckins }) => {
            if (!symptoms.includes("mouth_sores"))
                return false;
            const withSores = recentCheckins.filter((c) => c.symptoms.includes("mouth_sores"));
            return withSores.length >= 5;
        },
        severity: "caution",
        patientMessage: (lang) => lang === "hi"
            ? "5 दिनों से मुँह के छाले हैं — इसके बारे में doctor को बताना ज़रूरी है।\n\nअभी के लिए:\n• ठंडा पानी या ice chips राहत दे सकते हैं\n• नमक-पानी से कुल्ला करें\n• मसालेदार खाना avoid करें"
            : "Mouth sores for 5+ days need to be discussed with your doctor.\n\nFor now:\n• Cold water or ice chips may help\n• Rinse with salt water\n• Avoid spicy food",
        caregiverMessage: "Patient has reported mouth sores for 5+ days. Please ensure they're eating and staying hydrated. This should be mentioned at the next visit.",
        notifyCoordinator: false,
        notifyDoctor: false,
    },
    {
        id: "breathing_difficulty",
        description: "Breathing difficulty reported",
        check: ({ symptoms }) => symptoms.includes("breathing_difficulty"),
        severity: "urgent",
        patientMessage: (lang) => lang === "hi"
            ? "⚠️ साँस लेने में तकलीफ को नज़रअंदाज़ नहीं करना चाहिए।\n\nअगर:\n• साँस चढ़ रही है → ABHI hospital जाएं या ambulance call करें\n• थोड़ी तकलीफ है → अगले 1 घंटे में care team को call करें\n\nEmergency: [COORDINATOR_NUMBER]"
            : "⚠️ Breathing difficulty should not be ignored.\n\nIf:\n• Severe shortness of breath → Go to hospital NOW or call ambulance\n• Mild difficulty → Call your care team within the hour\n\nEmergency: [COORDINATOR_NUMBER]",
        caregiverMessage: "⚠️ URGENT: Patient reported breathing difficulty. Please check on them immediately. If severe, take them to hospital or call an ambulance now.",
        notifyCoordinator: true,
        notifyDoctor: true,
    },
    {
        id: "severe_single_day",
        description: "Score 1 with fever or vomiting",
        check: ({ score, symptoms }) => score === 1 && (symptoms.includes("fever") || symptoms.includes("vomiting")),
        severity: "caution",
        patientMessage: (lang) => lang === "hi"
            ? "आज बहुत मुश्किल दिन है। 💙 आपके caregiver को बता दिया है।\n\nThermometer पास है तो temperature check करें।"
            : "Today is very hard. 💙 Your caregiver has been notified.\n\nIf you have a thermometer nearby, please check your temperature.",
        caregiverMessage: "Patient scored 1 today and is reporting fever or vomiting. Please check on them.",
        notifyCoordinator: false,
        notifyDoctor: false,
    },
    {
        id: "missed_checkins_3days",
        description: "No check-in for 3+ days",
        check: ({ recentCheckins }) => {
            if (recentCheckins.length === 0)
                return true;
            const latest = recentCheckins[0];
            if (!latest)
                return false;
            const daysSince = Math.floor((Date.now() - new Date(latest.createdAt).getTime()) / (1000 * 60 * 60 * 24));
            return daysSince >= 3;
        },
        severity: "info",
        patientMessage: (lang) => lang === "hi"
            ? "कुछ दिनों से आपकी कोई खबर नहीं थी। 💙\nकोई बात नहीं — जब भी तैयार हों, मैं यहाँ हूँ।"
            : "We haven't heard from you in a few days. 💙\nNo pressure — I'm here whenever you're ready.",
        caregiverMessage: "Patient hasn't responded to check-ins for 3 days. You may want to check in with them.",
        notifyCoordinator: false,
        notifyDoctor: false,
    },
    {
        id: "increasing_pain",
        description: "Pain symptom 5+ days in a row",
        check: ({ symptoms, recentCheckins }) => {
            if (!symptoms.includes("pain"))
                return false;
            const withPain = recentCheckins.slice(0, 5).filter((c) => c.symptoms.includes("pain"));
            return withPain.length >= 5;
        },
        severity: "caution",
        patientMessage: (lang) => lang === "hi"
            ? "5 दिनों से दर्द है — ये doctor को बताना ज़रूरी है।\n\nअगली visit से पहले हम इसे brief में note करेंगे।"
            : "Pain reported for 5+ days — your doctor needs to know about this.\n\nWe'll note this in your pre-visit brief.",
        caregiverMessage: "Patient has reported pain for 5 consecutive days. Please note this for the upcoming doctor visit.",
        notifyCoordinator: false,
        notifyDoctor: true,
    },
    {
        id: "appetite_loss_extended",
        description: "Appetite loss for 4+ days with low score",
        check: ({ symptoms, score, recentCheckins }) => {
            if (!symptoms.includes("appetite_loss") || score > 2)
                return false;
            const withLoss = recentCheckins.slice(0, 4).filter((c) => c.symptoms.includes("appetite_loss"));
            return withLoss.length >= 4;
        },
        severity: "caution",
        patientMessage: (lang) => lang === "hi"
            ? "4 दिनों से खाना नहीं जा रहा — ये महत्वपूर्ण है।\n\nछोटी-छोटी चीज़ें try करें:\n• दही-भात, खिचड़ी\n• Protein shake अगर available हो\n• Care team को बताएं — इसके लिए medicines भी होती हैं"
            : "Appetite loss for 4+ days — this matters.\n\nTry small things:\n• Dahi-bhaat, khichdi\n• Protein shake if available\n• Tell your care team — there are medications for this",
        caregiverMessage: "Patient has had appetite loss for 4+ days with a low score. Please try to encourage small meals. Mention to the care team.",
        notifyCoordinator: true,
        notifyDoctor: false,
    },
    {
        id: "sudden_severe_score_drop",
        description: "Score drops from 4-5 to 1 overnight",
        check: ({ score, recentCheckins }) => {
            if (score > 1)
                return false;
            const previous = recentCheckins[0];
            return previous ? previous.score >= 4 : false;
        },
        severity: "caution",
        patientMessage: (lang) => lang === "hi"
            ? "कल अच्छा था, आज बहुत मुश्किल है — ये अचानक बदलाव था।\n\nकुछ खास हुआ? कोई नई दवा, खाना, या feeling?\nMujhe bataiye — यहाँ type करें।"
            : "Yesterday felt okay, today is very hard — that's a sudden change.\n\nDid anything specific happen? New medication, food, or feeling?\nTell me — type here.",
        caregiverMessage: "Patient's score dropped sharply from 4-5 yesterday to 1 today. Please check in with them.",
        notifyCoordinator: false,
        notifyDoctor: false,
    },
];
async function evaluateThresholds(patient, checkin, score, symptoms, cycleDay) {
    const recentCheckins = await client_1.prisma.checkin.findMany({
        where: { patientId: patient.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { score: true, symptoms: true, createdAt: true },
    });
    const params = { symptoms, score, cycleDay, recentCheckins };
    for (const rule of THRESHOLD_RULES) {
        if (!rule.check(params))
            continue;
        // Check if this rule already fired recently (avoid duplicate alerts)
        const recentAlert = await client_1.prisma.alert.findFirst({
            where: {
                patientId: patient.id,
                type: rule.id,
                resolved: false,
                createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
        });
        if (recentAlert)
            continue;
        // Create alert record
        const alert = await client_1.prisma.alert.create({
            data: {
                patientId: patient.id,
                checkinId: checkin.id,
                type: rule.id,
                severity: rule.severity,
                message: rule.description,
            },
        });
        // Send message to patient (replace placeholders)
        const patientMsg = rule
            .patientMessage(patient.language)
            .replace("[COORDINATOR_NUMBER]", process.env.COORDINATOR_WHATSAPP_NUMBER || "your care team")
            .replace("[HOSPITAL_NUMBER]", "your hospital helpline");
        await (0, sender_1.sendText)(patient.whatsappNumber, patientMsg);
        // Notify caregiver
        const caregiver = await client_1.prisma.caregiver.findUnique({
            where: { patientId: patient.id },
        });
        if (caregiver?.isEnrolled) {
            await (0, sender_1.sendText)(caregiver.whatsappNumber, rule.caregiverMessage);
            await client_1.prisma.alert.update({
                where: { id: alert.id },
                data: { caregiverNotified: true },
            });
        }
        // Notify coordinator for urgent/caution with flag
        if (rule.notifyCoordinator && process.env.COORDINATOR_WHATSAPP_NUMBER) {
            const coordMsg = `🚨 Alert [${rule.severity.toUpperCase()}]\nPatient: ${patient.name} (${patient.whatsappNumber})\nTreatment: ${patient.treatmentProtocol} Cycle ${patient.currentCycle} Day ${cycleDay}\nRule: ${rule.description}\nSymptoms: ${symptoms.join(", ")}\nScore: ${score}/5`;
            await (0, sender_1.sendText)(process.env.COORDINATOR_WHATSAPP_NUMBER, coordMsg);
            await client_1.prisma.alert.update({
                where: { id: alert.id },
                data: { coordinatorNotified: true },
            });
        }
    }
}
//# sourceMappingURL=thresholds.js.map