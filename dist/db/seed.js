"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("./client");
// ─── Treatment Protocols ──────────────────────────────────────────────────────
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
            { name: "Ondansetron", genericName: "ondansetron", purpose: "Anti-nausea — controls chemo side effects.", frequency: "As needed / as prescribed", timing: "30 min before chemo, or when nausea occurs", sideEffects: ["Constipation", "Mild drowsiness"], watchFor: ["Severe constipation"] },
            { name: "Dexamethasone", genericName: "dexamethasone", purpose: "Reduces swelling and nausea.", frequency: "Daily during chemo days", timing: "Morning with breakfast — do not take at night", sideEffects: ["Increased appetite", "Mild blood sugar rise"], watchFor: ["Excessive thirst or frequent urination"] },
            { name: "Filgrastim (G-CSF)", genericName: "filgrastim", purpose: "Boosts white blood cells — prevents infection.", frequency: "Days 2–11 post-chemo (as prescribed)", timing: "Injection per doctor schedule", sideEffects: ["Bone pain (normal)", "Mild fever"], watchFor: ["Temperature above 38°C → call emergency"] },
        ],
    },
    {
        name: "FOLFOX",
        displayName: "FOLFOX (Oxaliplatin + Leucovorin + 5-Fluorouracil)",
        cancerTypes: ["Colorectal Cancer", "Colon Cancer"],
        totalCycles: 12,
        cycleDays: 14,
        dayProfiles: [
            { dayRange: [1, 2], description: "Infusion days. Cold sensitivity begins — avoid cold drinks.", expectedSymptoms: [], severity: "low", coldWarning: true },
            { dayRange: [3, 5], description: "Fatigue peaks. Nausea possible.", expectedSymptoms: ["fatigue", "nausea", "appetite_loss"], severity: "medium" },
            { dayRange: [6, 10], description: "Recovery begins. Fatigue slowly improves.", expectedSymptoms: ["fatigue"], severity: "low" },
            { dayRange: [11, 14], description: "Near-normal. Body recovering.", expectedSymptoms: [], severity: "low" },
        ],
        medications: [
            { name: "Ondansetron", genericName: "ondansetron", purpose: "Nausea control.", frequency: "As needed", timing: "Before chemo or on nausea", sideEffects: ["Constipation"], watchFor: [] },
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
            { dayRange: [15, 21], description: "Recovery continues. May feel tingling in hands/feet.", expectedSymptoms: [], severity: "low" },
        ],
        medications: [
            { name: "Ondansetron", genericName: "ondansetron", purpose: "Nausea control.", frequency: "As prescribed", timing: "Before chemo", sideEffects: ["Constipation"], watchFor: [] },
            { name: "Dexamethasone", genericName: "dexamethasone", purpose: "Prevents allergic reaction and swelling.", frequency: "Chemo days", timing: "Morning", sideEffects: ["Increased appetite"], watchFor: ["Blood sugar symptoms"] },
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
            { name: "Prednisone", genericName: "prednisone", purpose: "Reduces inflammation. Works alongside chemo.", frequency: "Days 1–5 of each cycle", timing: "With food", sideEffects: ["Increased appetite", "Mood swings"], watchFor: ["Excessive thirst", "Frequent urination"] },
        ],
    },
];
// ─── Demo Patients ────────────────────────────────────────────────────────────
async function seedPatients() {
    const today = new Date();
    const daysAgo = (n) => new Date(today.getTime() - n * 86400000);
    // ── Patient 1: Breast Cancer — Stage IIIA, Cycle 3 ──────────────────────────
    const p1 = await client_1.prisma.patient.upsert({
        where: { whatsappNumber: "971501234001" },
        update: {},
        create: {
            whatsappNumber: "971501234001",
            name: "Nadia Al-Mansoori",
            language: "en",
            cancerType: "Breast Cancer",
            treatmentProtocol: "AC-T",
            currentCycle: 3,
            cycleStartDate: daysAgo(7),
            hospitalName: "City Hospital Oncology Centre",
            doctorName: "Dr. Aisha Karim",
            onboardingStep: 9,
            // Clinical identity
            dateOfBirth: new Date("1982-03-14"),
            gender: "F",
            stage: "Stage IIIA",
            diagnosisDate: new Date("2026-01-10"),
            primarySite: "Left Breast",
            histology: "Infiltrating Ductal Carcinoma",
            ecogScore: 1,
            bloodGroup: "B+",
            allergies: ["Penicillin"],
            comorbidities: ["Type 2 Diabetes (controlled)"],
            metastasisSites: [],
        },
    });
    // Lab results — CBC showing chemo-related cytopenias
    const labsP1 = [
        { testName: "Haemoglobin", category: "CBC", value: 8.9, unit: "g/dL", refMin: 12.0, refMax: 16.0, flag: "LOW", isAbnormal: true, testDate: daysAgo(2) },
        { testName: "WBC Count", category: "CBC", value: 2.1, unit: "10³/µL", refMin: 4.5, refMax: 11.0, flag: "LOW", isAbnormal: true, testDate: daysAgo(2) },
        { testName: "Neutrophil Count (ANC)", category: "CBC", value: 0.8, unit: "10³/µL", refMin: 1.8, refMax: 7.7, flag: "CRITICAL", isAbnormal: true, testDate: daysAgo(2) },
        { testName: "Platelet Count", category: "CBC", value: 142, unit: "10³/µL", refMin: 150, refMax: 400, flag: "LOW", isAbnormal: true, testDate: daysAgo(2) },
        { testName: "CA 15-3 (Tumour Marker)", category: "TUMOUR_MARKER", value: 87.4, unit: "U/mL", refMin: 0, refMax: 30.0, flag: "HIGH", isAbnormal: true, testDate: daysAgo(9) },
        { testName: "CA 15-3 (Tumour Marker)", category: "TUMOUR_MARKER", value: 112.0, unit: "U/mL", refMin: 0, refMax: 30.0, flag: "HIGH", isAbnormal: true, testDate: daysAgo(30) },
        { testName: "ALT (SGPT)", category: "LFT", value: 38, unit: "U/L", refMin: 7, refMax: 40, flag: "NORMAL", isAbnormal: false, testDate: daysAgo(9) },
        { testName: "Creatinine", category: "KFT", value: 0.9, unit: "mg/dL", refMin: 0.5, refMax: 1.1, flag: "NORMAL", isAbnormal: false, testDate: daysAgo(9) },
    ];
    for (const lab of labsP1) {
        await client_1.prisma.labResult.create({ data: { patientId: p1.id, source: "manual", ...lab } });
    }
    // Imaging — CT showing partial response
    await client_1.prisma.imagingReport.create({
        data: {
            patientId: p1.id,
            studyDate: daysAgo(14),
            modality: "CT",
            bodyPart: "CHEST",
            indication: "Response assessment after 2 cycles AC-T",
            findings: "Left breast primary lesion measures 2.1 cm (previously 3.4 cm). No new axillary lymphadenopathy. Lung fields clear. No pleural effusion.",
            impression: "Partial response to chemotherapy. Primary lesion reduced by 38% compared to baseline.",
            response: "PR",
            radiologist: "Dr. Mohammed Hassan",
            source: "manual",
        },
    });
    // Pathology — diagnostic biopsy with IHC
    await client_1.prisma.pathologyReport.create({
        data: {
            patientId: p1.id,
            reportDate: new Date("2026-01-08"),
            specimenType: "BIOPSY",
            site: "Left Breast, 10 o'clock position",
            diagnosis: "Invasive Ductal Carcinoma, Grade 2",
            grade: "Grade 2 (Moderately differentiated)",
            stage: "pT2N1M0",
            margins: "not applicable (core biopsy)",
            ihcFindings: { "ER": "Positive 85%", "PR": "Positive 60%", "HER2": "Negative (Score 1+)", "Ki67": "22%" },
            molecularTests: { "BRCA1": "Not tested", "BRCA2": "Not tested" },
            pathologist: "Dr. Layla Nasser",
            labName: "City Hospital Pathology Lab",
            source: "manual",
        },
    });
    // Vitals — weight trending down (chemo side effect)
    const vitalsP1 = [
        { recordedAt: daysAgo(21), weight: 68.5, height: 162, bpSystolic: 118, bpDiastolic: 76, pulseRate: 82, oxygenSat: 98, ecogScore: 1, painScore: 2 },
        { recordedAt: daysAgo(14), weight: 67.2, height: 162, bpSystolic: 114, bpDiastolic: 74, pulseRate: 88, oxygenSat: 97, ecogScore: 1, painScore: 3 },
        { recordedAt: daysAgo(7), weight: 66.0, height: 162, bpSystolic: 110, bpDiastolic: 72, pulseRate: 94, oxygenSat: 96, ecogScore: 1, painScore: 4 },
    ];
    for (const v of vitalsP1) {
        const bmi = parseFloat((v.weight / (v.height / 100) ** 2).toFixed(1));
        await client_1.prisma.vitalSign.create({ data: { patientId: p1.id, source: "manual", bmi, ...v } });
    }
    // Care team
    await client_1.prisma.careTeamMember.createMany({
        data: [
            { patientId: p1.id, role: "MEDICAL_ONCOLOGIST", name: "Dr. Aisha Karim", hospitalName: "City Hospital Oncology Centre", isPrimary: true, isActive: true },
            { patientId: p1.id, role: "RADIATION_ONCOLOGIST", name: "Dr. Sanjay Mehta", hospitalName: "City Hospital Oncology Centre", isPrimary: false, isActive: true },
            { patientId: p1.id, role: "NURSE", name: "Fatima Yusuf", department: "Oncology Ward", isPrimary: false, isActive: true },
            { patientId: p1.id, role: "DIETITIAN", name: "Priya Nair", hospitalName: "City Hospital", isPrimary: false, isActive: true },
        ],
        skipDuplicates: true,
    });
    // Clinical notes
    await client_1.prisma.clinicalNote.createMany({
        data: [
            {
                patientId: p1.id,
                noteDate: daysAgo(14),
                noteType: "MDT_DECISION",
                title: "MDT Review — Cycle 2 Response Assessment",
                content: "Patient reviewed at multidisciplinary tumor board. CT confirms partial response (38% size reduction). Decision: Continue AC × 4 cycles as planned. Reassess with CT after Cycle 4. Recommend dietitian review given 2.5 kg weight loss over 6 weeks. ANC nadir requires dose delay consideration if ANC < 1.0 on Day 1 of next cycle.",
                authorName: "Dr. Aisha Karim",
                authorRole: "MEDICAL_ONCOLOGIST",
                isPrivate: false,
                tags: ["MDT", "response-assessment", "dose-adjustment"],
            },
            {
                patientId: p1.id,
                noteDate: daysAgo(2),
                noteType: "PROGRESS",
                title: "Cycle 3 Day 5 — Neutropenia Alert",
                content: "ANC 0.8 × 10³/µL — Grade 3 neutropenia. Patient afebrile. Filgrastim course initiated. Patient advised to avoid public spaces, report any fever above 38°C immediately. No dose reduction required if ANC recovers before Cycle 4 Day 1.",
                authorName: "Fatima Yusuf",
                authorRole: "NURSE",
                isPrivate: false,
                tags: ["neutropenia", "filgrastim", "urgent"],
            },
        ],
        skipDuplicates: true,
    });
    // Check-ins — 7 days of symptom scores
    const checkinsP1 = [
        { daysBack: 7, score: 2, symptoms: ["fatigue"], emotionalState: "anxious", cycleDay: 1 },
        { daysBack: 6, score: 2, symptoms: ["fatigue", "nausea"], emotionalState: "okay", cycleDay: 2 },
        { daysBack: 5, score: 4, symptoms: ["nausea", "fatigue", "weakness"], emotionalState: "struggling", cycleDay: 3 },
        { daysBack: 4, score: 4, symptoms: ["nausea", "fatigue", "appetite_loss"], emotionalState: "struggling", cycleDay: 4 },
        { daysBack: 3, score: 4, symptoms: ["fatigue", "weakness"], emotionalState: "worried", cycleDay: 5 },
        { daysBack: 2, score: 3, symptoms: ["fatigue"], emotionalState: "okay", cycleDay: 6 },
        { daysBack: 1, score: 3, symptoms: ["fatigue"], emotionalState: "okay", cycleDay: 7 },
    ];
    for (const c of checkinsP1) {
        await client_1.prisma.checkin.create({
            data: {
                patientId: p1.id,
                score: c.score,
                symptoms: c.symptoms,
                emotionalState: c.emotionalState,
                cycleDay: c.cycleDay,
                ecogScore: 1,
                createdAt: daysAgo(c.daysBack),
            },
        });
    }
    // Alert — neutropenia
    await client_1.prisma.alert.create({
        data: {
            patientId: p1.id,
            type: "CRITICAL_LAB",
            severity: "HIGH",
            message: "ANC critically low (0.8 × 10³/µL) — Grade 3 neutropenia on Cycle 3 Day 5. Filgrastim initiated.",
            coordinatorNotified: true,
            doctorNotified: true,
            resolved: false,
            createdAt: daysAgo(2),
        },
    });
    // Appointment
    await client_1.prisma.appointment.create({
        data: {
            patientId: p1.id,
            doctorName: "Dr. Aisha Karim",
            hospitalName: "City Hospital Oncology Centre",
            type: "Cycle 4 Infusion",
            scheduledAt: new Date(today.getTime() + 14 * 86400000),
            status: "confirmed",
            notes: "Confirm ANC recovery before proceeding. Bring latest CBC report.",
        },
    });
    console.log("  ✅ Patient 1: Nadia Al-Mansoori (Breast Cancer, Stage IIIA)");
    // ── Patient 2: Colorectal Cancer — Stage IIB, Cycle 6 ───────────────────────
    const p2 = await client_1.prisma.patient.upsert({
        where: { whatsappNumber: "971501234002" },
        update: {},
        create: {
            whatsappNumber: "971501234002",
            name: "Rajesh Menon",
            language: "en",
            cancerType: "Colorectal Cancer",
            treatmentProtocol: "FOLFOX",
            currentCycle: 6,
            cycleStartDate: daysAgo(4),
            hospitalName: "Gulf Medical Centre",
            doctorName: "Dr. Omar Farouk",
            onboardingStep: 9,
            dateOfBirth: new Date("1968-09-22"),
            gender: "M",
            stage: "Stage IIB",
            diagnosisDate: new Date("2025-10-05"),
            primarySite: "Sigmoid Colon",
            histology: "Moderately Differentiated Adenocarcinoma",
            ecogScore: 1,
            bloodGroup: "O+",
            allergies: [],
            comorbidities: ["Hypertension", "Dyslipidaemia"],
            metastasisSites: [],
        },
    });
    const labsP2 = [
        { testName: "CEA (Tumour Marker)", category: "TUMOUR_MARKER", value: 87.3, unit: "ng/mL", refMin: 0, refMax: 5.0, flag: "HIGH", isAbnormal: true, testDate: daysAgo(5) },
        { testName: "CEA (Tumour Marker)", category: "TUMOUR_MARKER", value: 134.0, unit: "ng/mL", refMin: 0, refMax: 5.0, flag: "HIGH", isAbnormal: true, testDate: daysAgo(26) },
        { testName: "CEA (Tumour Marker)", category: "TUMOUR_MARKER", value: 198.6, unit: "ng/mL", refMin: 0, refMax: 5.0, flag: "HIGH", isAbnormal: true, testDate: daysAgo(54) },
        { testName: "ALT (SGPT)", category: "LFT", value: 72, unit: "U/L", refMin: 7, refMax: 40, flag: "HIGH", isAbnormal: true, testDate: daysAgo(5) },
        { testName: "AST (SGOT)", category: "LFT", value: 58, unit: "U/L", refMin: 10, refMax: 35, flag: "HIGH", isAbnormal: true, testDate: daysAgo(5) },
        { testName: "Haemoglobin", category: "CBC", value: 11.2, unit: "g/dL", refMin: 13.5, refMax: 17.5, flag: "LOW", isAbnormal: true, testDate: daysAgo(5) },
        { testName: "Creatinine", category: "KFT", value: 1.0, unit: "mg/dL", refMin: 0.6, refMax: 1.2, flag: "NORMAL", isAbnormal: false, testDate: daysAgo(5) },
        { testName: "Platelet Count", category: "CBC", value: 198, unit: "10³/µL", refMin: 150, refMax: 400, flag: "NORMAL", isAbnormal: false, testDate: daysAgo(5) },
    ];
    for (const lab of labsP2) {
        await client_1.prisma.labResult.create({ data: { patientId: p2.id, source: "manual", ...lab } });
    }
    await client_1.prisma.imagingReport.create({
        data: {
            patientId: p2.id,
            studyDate: daysAgo(5),
            modality: "CT",
            bodyPart: "ABDOMEN",
            indication: "Response assessment after 5 cycles FOLFOX",
            findings: "Primary sigmoid colon lesion stable at 3.2 cm (previously 3.4 cm). No new hepatic lesions. Retroperitoneal lymph nodes stable. Mild hepatomegaly noted.",
            impression: "Stable disease (SD) by RECIST criteria. CEA trending down suggests biochemical response. Hepatomegaly warrants LFT monitoring.",
            response: "SD",
            radiologist: "Dr. Khalid Ibrahim",
            source: "manual",
        },
    });
    await client_1.prisma.pathologyReport.create({
        data: {
            patientId: p2.id,
            reportDate: new Date("2025-10-03"),
            specimenType: "BIOPSY",
            site: "Sigmoid Colon",
            diagnosis: "Moderately Differentiated Adenocarcinoma",
            grade: "Grade 2",
            stage: "pT3N0M0",
            margins: "not applicable (biopsy)",
            ihcFindings: { "MLH1": "Retained", "MSH2": "Retained", "MSH6": "Retained", "PMS2": "Retained" },
            molecularTests: { "KRAS": "Mutant (codon 12 G12D)", "NRAS": "Wild-type", "BRAF": "Wild-type", "MSI": "Microsatellite Stable (MSS)" },
            pathologist: "Dr. Rania Al-Hajj",
            labName: "Gulf Medical Centre Pathology",
            source: "manual",
        },
    });
    const vitalsP2 = [
        { recordedAt: daysAgo(26), weight: 78.0, height: 174, bpSystolic: 138, bpDiastolic: 88, pulseRate: 76, oxygenSat: 98, ecogScore: 1, painScore: 1 },
        { recordedAt: daysAgo(5), weight: 75.4, height: 174, bpSystolic: 142, bpDiastolic: 90, pulseRate: 80, oxygenSat: 97, ecogScore: 1, painScore: 2 },
    ];
    for (const v of vitalsP2) {
        const bmi = parseFloat((v.weight / (v.height / 100) ** 2).toFixed(1));
        await client_1.prisma.vitalSign.create({ data: { patientId: p2.id, source: "manual", bmi, ...v } });
    }
    await client_1.prisma.careTeamMember.createMany({
        data: [
            { patientId: p2.id, role: "MEDICAL_ONCOLOGIST", name: "Dr. Omar Farouk", hospitalName: "Gulf Medical Centre", isPrimary: true, isActive: true },
            { patientId: p2.id, role: "SURGICAL_ONCOLOGIST", name: "Dr. Hind Al-Zaabi", hospitalName: "Gulf Medical Centre", isPrimary: false, isActive: true },
            { patientId: p2.id, role: "NURSE", name: "Arjun Thomas", department: "GI Oncology", isPrimary: false, isActive: true },
        ],
        skipDuplicates: true,
    });
    await client_1.prisma.clinicalNote.create({
        data: {
            patientId: p2.id,
            noteDate: daysAgo(5),
            noteType: "MDT_DECISION",
            title: "MDT Review — Cycle 5 Completion",
            content: "CEA showing downtrend: 198.6 → 134.0 → 87.3. CT confirms stable disease. KRAS G12D mutation confirms patient is not a candidate for anti-EGFR therapy (cetuximab/panitumumab). Decision: Complete 12-cycle FOLFOX as planned. Surgical resection feasibility to be reviewed at Cycle 8. LFT elevation (ALT 72) — likely oxaliplatin-related hepatotoxicity. Hepatology opinion requested. Monitor LFTs every cycle.",
            authorName: "Dr. Omar Farouk",
            authorRole: "MEDICAL_ONCOLOGIST",
            isPrivate: false,
            tags: ["MDT", "KRAS", "stable-disease", "hepatotoxicity"],
        },
    });
    const checkinsP2 = [
        { daysBack: 4, score: 2, symptoms: ["fatigue"], emotionalState: "okay", cycleDay: 1 },
        { daysBack: 3, score: 2, symptoms: ["fatigue", "nausea"], emotionalState: "okay", cycleDay: 2 },
        { daysBack: 2, score: 3, symptoms: ["fatigue", "nausea", "appetite_loss"], emotionalState: "tired", cycleDay: 3 },
        { daysBack: 1, score: 3, symptoms: ["fatigue", "cold_sensitivity"], emotionalState: "okay", cycleDay: 4 },
    ];
    for (const c of checkinsP2) {
        await client_1.prisma.checkin.create({
            data: { patientId: p2.id, score: c.score, symptoms: c.symptoms, emotionalState: c.emotionalState, cycleDay: c.cycleDay, createdAt: daysAgo(c.daysBack) },
        });
    }
    await client_1.prisma.appointment.create({
        data: {
            patientId: p2.id,
            doctorName: "Dr. Omar Farouk",
            hospitalName: "Gulf Medical Centre",
            type: "Cycle 7 Infusion",
            scheduledAt: new Date(today.getTime() + 10 * 86400000),
            status: "confirmed",
            notes: "Repeat LFTs before infusion. Hepatology review scheduled same day.",
        },
    });
    console.log("  ✅ Patient 2: Rajesh Menon (Colorectal Cancer, Stage IIB)");
    // ── Patient 3: Cervical Cancer — Stage IB2, Cycle 2 ─────────────────────────
    const p3 = await client_1.prisma.patient.upsert({
        where: { whatsappNumber: "971501234003" },
        update: {},
        create: {
            whatsappNumber: "971501234003",
            name: "Sarah Mitchell",
            language: "en",
            cancerType: "Cervical Cancer",
            treatmentProtocol: "CARBOPLATIN-PACLITAXEL",
            currentCycle: 2,
            cycleStartDate: daysAgo(12),
            hospitalName: "Emirates Oncology Hospital",
            doctorName: "Dr. Noura Al-Awadhi",
            onboardingStep: 9,
            dateOfBirth: new Date("1988-06-30"),
            gender: "F",
            stage: "Stage IB2",
            diagnosisDate: new Date("2026-02-20"),
            primarySite: "Cervix",
            histology: "Squamous Cell Carcinoma",
            ecogScore: 2,
            bloodGroup: "A+",
            allergies: ["Sulfa drugs"],
            comorbidities: [],
            metastasisSites: [],
        },
    });
    const labsP3 = [
        { testName: "Neutrophil Count (ANC)", category: "CBC", value: 0.6, unit: "10³/µL", refMin: 1.8, refMax: 7.7, flag: "CRITICAL", isAbnormal: true, testDate: daysAgo(1) },
        { testName: "Haemoglobin", category: "CBC", value: 9.4, unit: "g/dL", refMin: 12.0, refMax: 16.0, flag: "LOW", isAbnormal: true, testDate: daysAgo(1) },
        { testName: "WBC Count", category: "CBC", value: 1.8, unit: "10³/µL", refMin: 4.5, refMax: 11.0, flag: "LOW", isAbnormal: true, testDate: daysAgo(1) },
        { testName: "Platelet Count", category: "CBC", value: 88, unit: "10³/µL", refMin: 150, refMax: 400, flag: "LOW", isAbnormal: true, testDate: daysAgo(1) },
        { testName: "Creatinine", category: "KFT", value: 1.3, unit: "mg/dL", refMin: 0.5, refMax: 1.1, flag: "HIGH", isAbnormal: true, testDate: daysAgo(1) },
        { testName: "SCC Antigen", category: "TUMOUR_MARKER", value: 6.8, unit: "ng/mL", refMin: 0, refMax: 2.5, flag: "HIGH", isAbnormal: true, testDate: daysAgo(12) },
    ];
    for (const lab of labsP3) {
        await client_1.prisma.labResult.create({ data: { patientId: p3.id, source: "manual", ...lab } });
    }
    await client_1.prisma.imagingReport.create({
        data: {
            patientId: p3.id,
            studyDate: new Date("2026-02-18"),
            modality: "MRI",
            bodyPart: "PELVIS",
            indication: "Staging MRI — newly diagnosed cervical cancer",
            findings: "Cervical mass measuring 4.2 × 3.8 cm with invasion into parametrium bilaterally. No bladder or rectal invasion. Enlarged left external iliac lymph nodes (largest 1.4 cm, short axis). No distant metastasis.",
            impression: "Stage IB2 cervical carcinoma with bilateral parametrial invasion and left iliac nodal involvement. Recommend concurrent chemoradiation.",
            response: null,
            radiologist: "Dr. Ahmed Salim",
            source: "manual",
        },
    });
    await client_1.prisma.pathologyReport.create({
        data: {
            patientId: p3.id,
            reportDate: new Date("2026-02-20"),
            specimenType: "BIOPSY",
            site: "Cervix",
            diagnosis: "Squamous Cell Carcinoma, Non-Keratinizing",
            grade: "Grade 2",
            stage: null,
            margins: "not applicable (biopsy)",
            ihcFindings: { "p16": "Strongly positive (block pattern)", "Ki67": "High (>70%)" },
            molecularTests: { "HPV": "HPV 16 positive (high-risk)", "PD-L1 (CPS)": "CPS 15" },
            pathologist: "Dr. Maryam Al-Qassim",
            labName: "Emirates Oncology Hospital Pathology",
            source: "manual",
        },
    });
    const vitalsP3 = [
        { recordedAt: daysAgo(21), weight: 58.0, height: 165, bpSystolic: 108, bpDiastolic: 68, pulseRate: 92, oxygenSat: 97, ecogScore: 2, painScore: 3 },
        { recordedAt: daysAgo(12), weight: 56.5, height: 165, bpSystolic: 104, bpDiastolic: 66, pulseRate: 96, oxygenSat: 96, ecogScore: 2, painScore: 4 },
        { recordedAt: daysAgo(1), weight: 55.2, height: 165, bpSystolic: 100, bpDiastolic: 64, pulseRate: 102, oxygenSat: 95, ecogScore: 2, painScore: 5 },
    ];
    for (const v of vitalsP3) {
        const bmi = parseFloat((v.weight / (v.height / 100) ** 2).toFixed(1));
        await client_1.prisma.vitalSign.create({ data: { patientId: p3.id, source: "manual", bmi, ...v } });
    }
    await client_1.prisma.careTeamMember.createMany({
        data: [
            { patientId: p3.id, role: "MEDICAL_ONCOLOGIST", name: "Dr. Noura Al-Awadhi", hospitalName: "Emirates Oncology Hospital", isPrimary: true, isActive: true },
            { patientId: p3.id, role: "RADIATION_ONCOLOGIST", name: "Dr. Vivek Sharma", hospitalName: "Emirates Oncology Hospital", isPrimary: false, isActive: true },
            { patientId: p3.id, role: "PALLIATIVE", name: "Dr. Zainab Hassan", hospitalName: "Emirates Oncology Hospital", isPrimary: false, isActive: true },
            { patientId: p3.id, role: "NURSE", name: "Maria Santos", department: "Gynaecologic Oncology", isPrimary: false, isActive: true },
            { patientId: p3.id, role: "PSYCHO_ONCOLOGIST", name: "Dr. Lena Fischer", hospitalName: "Emirates Oncology Hospital", isPrimary: false, isActive: true },
        ],
        skipDuplicates: true,
    });
    await client_1.prisma.clinicalNote.createMany({
        data: [
            {
                patientId: p3.id,
                noteDate: daysAgo(12),
                noteType: "MDT_DECISION",
                title: "MDT Decision — Treatment Plan Ratified",
                content: "Case reviewed at multidisciplinary tumor board. Stage IB2, HPV16+, PD-L1 CPS 15. Concurrent chemoradiation (EBRT 45 Gy + weekly carboplatin) followed by brachytherapy agreed as standard of care. Systemic carboplatin-paclitaxel initiated concurrently. Psycho-oncology referral made. Fertility counselling documented — patient does not wish preservation. Palliative care involved for symptom management.",
                authorName: "Dr. Noura Al-Awadhi",
                authorRole: "MEDICAL_ONCOLOGIST",
                isPrivate: false,
                tags: ["MDT", "HPV16", "chemoradiation", "palliative"],
            },
            {
                patientId: p3.id,
                noteDate: daysAgo(1),
                noteType: "PROGRESS",
                title: "Cycle 2 Day 12 — Critical Pancytopenia",
                content: "CBC shows critical ANC 0.6, platelets 88. Patient febrile at 38.4°C. Admitted for IV antibiotics and G-CSF. Cycle 3 to be delayed minimum 1 week pending ANC recovery. Renal function borderline — creatinine 1.3, consider carboplatin dose reduction next cycle (calculate AUC based on adjusted GFR). Urgent nephrology review requested.",
                authorName: "Dr. Noura Al-Awadhi",
                authorRole: "MEDICAL_ONCOLOGIST",
                isPrivate: false,
                tags: ["pancytopenia", "febrile-neutropenia", "dose-reduction", "urgent"],
            },
        ],
        skipDuplicates: true,
    });
    const checkinsP3 = [
        { daysBack: 12, score: 3, symptoms: ["fatigue", "nausea"], emotionalState: "anxious", cycleDay: 1 },
        { daysBack: 10, score: 4, symptoms: ["nausea", "fatigue", "weakness"], emotionalState: "struggling", cycleDay: 3 },
        { daysBack: 7, score: 4, symptoms: ["fatigue", "pain"], emotionalState: "struggling", cycleDay: 6 },
        { daysBack: 4, score: 3, symptoms: ["fatigue"], emotionalState: "tired", cycleDay: 9 },
        { daysBack: 2, score: 4, symptoms: ["fatigue", "fever", "weakness"], emotionalState: "scared", cycleDay: 11 },
        { daysBack: 1, score: 5, symptoms: ["fever", "fatigue", "weakness", "pain"], emotionalState: "very_unwell", cycleDay: 12 },
    ];
    for (const c of checkinsP3) {
        await client_1.prisma.checkin.create({
            data: { patientId: p3.id, score: c.score, symptoms: c.symptoms, emotionalState: c.emotionalState, cycleDay: c.cycleDay, createdAt: daysAgo(c.daysBack) },
        });
    }
    await client_1.prisma.alert.createMany({
        data: [
            {
                patientId: p3.id,
                type: "CRITICAL_LAB",
                severity: "CRITICAL",
                message: "ANC 0.6 × 10³/µL + febrile (38.4°C) — febrile neutropenia. Patient admitted. Cycle 3 delayed.",
                coordinatorNotified: true,
                doctorNotified: true,
                resolved: false,
                createdAt: daysAgo(1),
            },
            {
                patientId: p3.id,
                type: "SYMPTOM_SCORE",
                severity: "HIGH",
                message: "Symptom score 5/5 — patient reports fever, severe fatigue, weakness, and pain.",
                coordinatorNotified: true,
                doctorNotified: true,
                resolved: false,
                createdAt: daysAgo(1),
            },
        ],
        skipDuplicates: true,
    });
    await client_1.prisma.appointment.create({
        data: {
            patientId: p3.id,
            doctorName: "Dr. Noura Al-Awadhi",
            hospitalName: "Emirates Oncology Hospital",
            type: "Cycle 3 Review (Delayed)",
            scheduledAt: new Date(today.getTime() + 7 * 86400000),
            status: "pending",
            notes: "Pending ANC recovery. Repeat CBC on Day 3 of admission. Nephrology review before dose decision.",
        },
    });
    console.log("  ✅ Patient 3: Sarah Mitchell (Cervical Cancer, Stage IB2)");
}
// ─── Coordinator Account ──────────────────────────────────────────────────────
async function seedCoordinator() {
    const email = process.env.SEED_COORDINATOR_EMAIL || "coordinator@caresetu.health";
    const password = process.env.SEED_COORDINATOR_PASSWORD || "CareSetu@2026";
    const passwordHash = await bcryptjs_1.default.hash(password, 12);
    await client_1.prisma.coordinator.upsert({
        where: { email },
        update: { passwordHash },
        create: {
            email,
            passwordHash,
            name: "Demo Coordinator",
            role: "ADMIN",
            hospitalName: "Care Setu Demo",
            isActive: true,
        },
    });
    console.log(`  ✅ Coordinator: ${email} / ${password}`);
}
// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log("\n🌱 Seeding treatment protocols...");
    for (const protocol of protocols) {
        await client_1.prisma.treatmentProtocol.upsert({
            where: { name: protocol.name },
            update: { displayName: protocol.displayName, cancerTypes: protocol.cancerTypes, totalCycles: protocol.totalCycles, cycleDays: protocol.cycleDays, dayProfiles: protocol.dayProfiles, medications: protocol.medications },
            create: { name: protocol.name, displayName: protocol.displayName, cancerTypes: protocol.cancerTypes, totalCycles: protocol.totalCycles, cycleDays: protocol.cycleDays, dayProfiles: protocol.dayProfiles, medications: protocol.medications },
        });
        console.log(`  ✅ Protocol: ${protocol.name}`);
    }
    console.log("\n🌱 Seeding coordinator account...");
    await seedCoordinator();
    console.log("\n🌱 Seeding demo patients...");
    await seedPatients();
    console.log("\n✅ Seed complete.\n");
}
main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await client_1.prisma.$disconnect(); });
//# sourceMappingURL=seed.js.map