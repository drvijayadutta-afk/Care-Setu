"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMedicationContext = sendMedicationContext;
exports.sendMedicationReminder = sendMedicationReminder;
exports.handleMedicationResponse = handleMedicationResponse;
exports.handleMedicationQuery = handleMedicationQuery;
const client_1 = require("../../db/client");
const sender_1 = require("../../webhook/sender");
// Pre-loaded context for common cancer medications
const MEDICATION_CONTEXTS = {
    ondansetron: {
        purpose: "Nausea ke liye (anti-nausea). Chemotherapy ki wajah se aane wali ulti kam karta hai.",
        timing: "Chemotherapy se 30 minute pehle lein. Khane ke saath ya baad mein bhi le sakte hain.",
        sideEffects: ["Kabz (constipation)", "Halki neend", "Sir dard"],
        watchFor: ["Zyada kabz ho to doctor ko batayein"],
    },
    dexamethasone: {
        purpose: "Swelling aur nausea kam karta hai. Chemo ke side effects ko control karta hai.",
        timing: "Subah naashte ke saath lein. Raat ko lene se neend nahi aati — isliye subah hi lein.",
        sideEffects: ["Bhookh zyada lagegi", "Blood sugar thoda badh sakta hai", "Pani retention"],
        watchFor: ["Zyada pyaas ya bar bar peshab → blood sugar check karein"],
    },
    methotrexate: {
        purpose: "Cancer ki cells ki growth rokta hai. Ek important treatment medicine hai.",
        timing: "Doctor ne jo time bataya hai — usi waqt lein. Meal ke saath lein.",
        sideEffects: ["Thhakan", "Munh mein chhale", "Nausea"],
        watchFor: ["Munh mein chhale 5 din se zyada → doctor ko batayein", "Bukhaar → turant call karein"],
    },
    tamoxifen: {
        purpose: "Hormone-sensitive breast cancer cells ko rokta hai. Daily lena important hai.",
        timing: "Roz ek hi waqt par lein — yaad rakhne mein asaani hogi.",
        sideEffects: ["Hot flashes", "Periods mein badlav", "Mood swings"],
        watchFor: ["Pair mein dard ya sujan → turant call karein (blood clot ka risk)"],
    },
    capecitabine: {
        purpose: "Oral chemotherapy — cancer cells ko todta hai. Tablet form mein chemotherapy hai.",
        timing: "Subah aur shaam — khane ke 30 minute baad. Khane ke bina mat lein.",
        sideEffects: ["Haath-pair mein surkhi ya dard (Hand-Foot Syndrome)", "Diarrhea", "Thhakan"],
        watchFor: [
            "Haath ya pair mein chhale ya dard → dose hold karein aur doctor ko call karein",
            "Din mein 4 se zyada baar diarrhea → call karein",
        ],
    },
    filgrastim: {
        purpose: "White blood cells badhata hai. Infection se bachata hai chemo ke baad.",
        timing: "Doctor ke schedule ke according — aksar injection form mein.",
        sideEffects: ["Haddi mein dard (normal hai)", "Thodi fever"],
        watchFor: ["38°C se upar bukhaar → emergency"],
    },
};
async function sendMedicationContext(patientId, medicationId) {
    const [patient, medication] = await Promise.all([
        client_1.prisma.patient.findUnique({ where: { id: patientId } }),
        client_1.prisma.medication.findUnique({ where: { id: medicationId } }),
    ]);
    if (!patient || !medication || medication.contextSent)
        return;
    const genericName = medication.genericName?.toLowerCase() || medication.name.toLowerCase();
    const preLoaded = Object.entries(MEDICATION_CONTEXTS).find(([key]) => genericName.includes(key));
    const context = preLoaded
        ? preLoaded[1]
        : {
            purpose: medication.purpose,
            timing: medication.timing,
            sideEffects: medication.sideEffects,
            watchFor: medication.watchFor,
        };
    const lang = patient.language;
    const msg = lang === "hi"
        ? `💊 *${medication.name}* ke baare mein:\n\n*Kya karta hai:* ${context.purpose}\n\n*Kab lein:* ${context.timing}\n\n*Normal side effects:*\n${context.sideEffects.map((s) => `• ${s}`).join("\n")}\n\n*Dhyan rakhein:*\n${context.watchFor.map((w) => `• ${w}`).join("\n")}`
        : `💊 About *${medication.name}*:\n\n*What it does:* ${context.purpose}\n\n*When to take:* ${context.timing}\n\n*Normal side effects:*\n${context.sideEffects.map((s) => `• ${s}`).join("\n")}\n\n*Watch for:*\n${context.watchFor.map((w) => `• ${w}`).join("\n")}`;
    await (0, sender_1.sendText)(patient.whatsappNumber, msg);
    await client_1.prisma.medication.update({
        where: { id: medicationId },
        data: { contextSent: true },
    });
}
async function sendMedicationReminder(patientId) {
    const patient = await client_1.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient)
        return;
    const medications = await client_1.prisma.medication.findMany({
        where: { patientId, isActive: true },
    });
    if (medications.length === 0)
        return;
    for (const med of medications) {
        const lang = patient.language;
        const reminderMsg = lang === "hi"
            ? `💊 *${med.name}* — lene ka waqt.\n_${med.purpose.split(".")[0]}._`
            : `💊 *${med.name}* — time to take it.\n_${med.purpose.split(".")[0]}._`;
        await (0, sender_1.sendButtonMessage)(patient.whatsappNumber, reminderMsg, [
            { id: `med_taken_${med.id}`, title: "✅ Le liya" },
            { id: `med_skip_${med.id}`, title: "⏭ Baad mein" },
            { id: `med_question_${med.id}`, title: "❓ Sawaal hai" },
        ]);
    }
}
async function handleMedicationResponse(patient, replyId) {
    if (replyId.startsWith("med_taken_")) {
        const medId = replyId.replace("med_taken_", "");
        await client_1.prisma.medicationLog.create({
            data: { medicationId: medId, patientId: patient.id, taken: true, takenAt: new Date() },
        });
        await (0, sender_1.sendText)(patient.whatsappNumber, patient.language === "hi" ? "✅ Note kar liya. Shukriya!" : "✅ Noted. Thank you!");
    }
    else if (replyId.startsWith("med_skip_")) {
        const medId = replyId.replace("med_skip_", "");
        await client_1.prisma.medicationLog.create({
            data: { medicationId: medId, patientId: patient.id, taken: false },
        });
        await (0, sender_1.sendText)(patient.whatsappNumber, patient.language === "hi"
            ? "Samjha. Isko aaj lena mat bhoolein — kal ke liye remind karunga."
            : "Understood. Try not to miss it today — I'll remind you tomorrow.");
    }
}
async function handleMedicationQuery(patient, text) {
    const medications = await client_1.prisma.medication.findMany({
        where: { patientId: patient.id, isActive: true },
    });
    if (medications.length === 0) {
        await (0, sender_1.sendText)(patient.whatsappNumber, patient.language === "hi"
            ? "Aapki dawaiyon ki list abhi add nahi hui hai. Apne care coordinator se contact karein."
            : "Your medication list hasn't been added yet. Please contact your care coordinator.");
        return;
    }
    const medList = medications.map((m) => `• ${m.name} — ${m.timing}`).join("\n");
    const lang = patient.language;
    await (0, sender_1.sendText)(patient.whatsappNumber, lang === "hi"
        ? `Aapki dawaiyan:\n\n${medList}\n\nKisi specific dawai ke baare mein poochhna hai? Naam likh kar bhejein.`
        : `Your medications:\n\n${medList}\n\nWant to know about a specific one? Just type the name.`);
}
//# sourceMappingURL=context.js.map