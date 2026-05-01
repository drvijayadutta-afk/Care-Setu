"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("./client");
const protocols = [
    {
        name: "AC-T",
        displayName: "AC-T (Doxorubicin + Cyclophosphamide + Paclitaxel)",
        cancerTypes: ["Breast Cancer"],
        totalCycles: 8,
        cycleDays: 21,
        dayProfiles: [
            { day: 1, description: "Infusion day. Feel okay — side effects haven't started.", expectedSymptoms: [], severity: "low" },
            { day: 2, description: "Usually manageable. May feel tired.", expectedSymptoms: ["fatigue"], severity: "low" },
            { day: 3, description: "Hardest days begin. Nausea, fatigue, body aches common.", expectedSymptoms: ["nausea", "fatigue", "weakness"], severity: "high" },
            { day: 4, description: "Continues to be difficult. Nausea peaks.", expectedSymptoms: ["nausea", "fatigue", "appetite_loss"], severity: "high" },
            { day: 5, description: "Still hard. Risk of low white blood cells (neutropenia).", expectedSymptoms: ["fatigue", "weakness"], severity: "high", warningDay: true },
            { dayRange: [6, 8], description: "Slowly improving. Fatigue continues.", expectedSymptoms: ["fatigue"], severity: "medium" },
            { dayRange: [9, 14], description: "Recovery period. Energy gradually returns. Hair loss may start.", expectedSymptoms: ["fatigue"], severity: "low" },
            { dayRange: [15, 21], description: "Near-normal period. Body recovering before next cycle.", expectedSymptoms: [], severity: "low" },
        ],
        medications: [
            {
                name: "Ondansetron",
                genericName: "ondansetron",
                purpose: "Nausea aur ulti rokne ke liye. Chemo ke side effects control karta hai.",
                frequency: "As needed / as prescribed",
                timing: "Chemo se 30 min pehle, ya nausea hone par",
                sideEffects: ["Kabz", "Halki neend"],
                watchFor: ["Zyada kabz"],
            },
            {
                name: "Dexamethasone",
                genericName: "dexamethasone",
                purpose: "Swelling aur nausea kam karta hai. Chemo ke side effects manage karta hai.",
                frequency: "Daily during chemo days",
                timing: "Subah naashte ke saath — raat ko mat lein",
                sideEffects: ["Bhookh zyada lagegi", "Blood sugar thoda badh sakta hai"],
                watchFor: ["Zyada pyaas ya bar bar peshab"],
            },
            {
                name: "Filgrastim (G-CSF)",
                genericName: "filgrastim",
                purpose: "White blood cells badhata hai — infection se bachata hai.",
                frequency: "Days 2-11 post-chemo (as prescribed)",
                timing: "Injection — doctor ke schedule ke according",
                sideEffects: ["Haddi mein dard (normal hai)", "Thodi fever"],
                watchFor: ["38°C se upar bukhaar → emergency call karein"],
            },
        ],
    },
    {
        name: "FOLFOX",
        displayName: "FOLFOX (Oxaliplatin + Leucovorin + 5-Fluorouracil)",
        cancerTypes: ["Colorectal Cancer", "Colon Cancer"],
        totalCycles: 12,
        cycleDays: 14,
        dayProfiles: [
            { dayRange: [1, 2], description: "Infusion days. Cold sensitivity begins — avoid cold drinks and surfaces.", expectedSymptoms: [], severity: "low", coldWarning: true },
            { dayRange: [3, 5], description: "Fatigue peaks. Nausea possible. Cold sensitivity continues.", expectedSymptoms: ["fatigue", "nausea", "appetite_loss"], severity: "medium" },
            { dayRange: [6, 10], description: "Recovery begins. Fatigue slowly improves.", expectedSymptoms: ["fatigue"], severity: "low" },
            { dayRange: [11, 14], description: "Near-normal. Body recovering before next cycle.", expectedSymptoms: [], severity: "low" },
        ],
        medications: [
            {
                name: "Ondansetron",
                genericName: "ondansetron",
                purpose: "Nausea control ke liye.",
                frequency: "As needed",
                timing: "Chemo se pehle ya nausea par",
                sideEffects: ["Kabz"],
                watchFor: [],
            },
            {
                name: "Capecitabine (if applicable)",
                genericName: "capecitabine",
                purpose: "Oral chemo — tablet form mein cancer cells ko todta hai.",
                frequency: "Twice daily",
                timing: "Subah aur shaam — khane ke 30 minute baad",
                sideEffects: ["Haath-pair mein dard ya surkhi (HFS)", "Diarrhea"],
                watchFor: ["Haath ya pair mein chhale → dose hold karein aur call karein", "Din mein 4+ baar diarrhea → call karein"],
            },
        ],
    },
    {
        name: "CARBOPLATIN-PACLITAXEL",
        displayName: "Carboplatin + Paclitaxel",
        cancerTypes: ["Lung Cancer", "Ovarian Cancer", "Cervical Cancer"],
        totalCycles: 6,
        cycleDays: 21,
        dayProfiles: [
            { day: 1, description: "Infusion day. Pre-medications given to prevent reactions.", expectedSymptoms: [], severity: "low" },
            { dayRange: [2, 4], description: "Nausea and fatigue begin.", expectedSymptoms: ["nausea", "fatigue"], severity: "medium" },
            { dayRange: [5, 10], description: "Low white blood cell window. Watch for fever.", expectedSymptoms: ["fatigue", "weakness"], severity: "medium", warningDay: true },
            { dayRange: [11, 14], description: "Recovery. Energy begins to return.", expectedSymptoms: ["fatigue"], severity: "low" },
            { dayRange: [15, 21], description: "Recovery continues. May feel tingling in hands/feet (neuropathy) — mention to doctor.", expectedSymptoms: [], severity: "low" },
        ],
        medications: [
            {
                name: "Ondansetron",
                genericName: "ondansetron",
                purpose: "Nausea control ke liye.",
                frequency: "As prescribed",
                timing: "Chemo se pehle",
                sideEffects: ["Kabz"],
                watchFor: [],
            },
            {
                name: "Dexamethasone",
                genericName: "dexamethasone",
                purpose: "Allergic reaction aur swelling rokne ke liye.",
                frequency: "Chemo days",
                timing: "Subah",
                sideEffects: ["Bhookh zyada"],
                watchFor: ["Zyada blood sugar symptoms"],
            },
        ],
    },
    {
        name: "CHOP",
        displayName: "CHOP (Cyclophosphamide + Doxorubicin + Vincristine + Prednisone)",
        cancerTypes: ["Non-Hodgkin Lymphoma", "Blood Cancer"],
        totalCycles: 6,
        cycleDays: 21,
        dayProfiles: [
            { day: 1, description: "Infusion day.", expectedSymptoms: [], severity: "low" },
            { dayRange: [2, 5], description: "Nausea, fatigue, possible mouth sores.", expectedSymptoms: ["nausea", "fatigue", "mouth_sores"], severity: "high" },
            { dayRange: [6, 14], description: "Low immunity window. Avoid crowds. Watch for fever.", expectedSymptoms: ["fatigue"], severity: "medium", warningDay: true },
            { dayRange: [15, 21], description: "Recovery period.", expectedSymptoms: [], severity: "low" },
        ],
        medications: [
            {
                name: "Prednisone",
                genericName: "prednisone",
                purpose: "Inflammation kam karta hai. Chemo ke saath kaam karta hai.",
                frequency: "Days 1-5 of each cycle",
                timing: "Khane ke saath",
                sideEffects: ["Bhookh zyada", "Blood sugar badh sakta hai", "Mood swings"],
                watchFor: ["Zyada pyaas", "Bar bar peshab"],
            },
        ],
    },
];
async function main() {
    console.log("Seeding treatment protocols...");
    for (const protocol of protocols) {
        await client_1.prisma.treatmentProtocol.upsert({
            where: { name: protocol.name },
            update: {
                displayName: protocol.displayName,
                cancerTypes: protocol.cancerTypes,
                totalCycles: protocol.totalCycles,
                cycleDays: protocol.cycleDays,
                dayProfiles: protocol.dayProfiles,
                medications: protocol.medications,
            },
            create: {
                name: protocol.name,
                displayName: protocol.displayName,
                cancerTypes: protocol.cancerTypes,
                totalCycles: protocol.totalCycles,
                cycleDays: protocol.cycleDays,
                dayProfiles: protocol.dayProfiles,
                medications: protocol.medications,
            },
        });
        console.log(`  ✅ ${protocol.name}`);
    }
    console.log("\nAll protocols seeded successfully.");
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await client_1.prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map