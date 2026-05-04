/**
 * Rich demo seed — Onco Board
 *
 * Adds realistic sample data across 3 hospitals, 8 oncologists, 15 patients,
 * appointments, check-ins, lab results, alerts, tumor-board meetings, referrals,
 * and DoctorUser records so the full app UI renders with meaningful data.
 *
 * Safe to run multiple times — uses upsert where possible and skips if already present.
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "./client";

// ── helpers ────────────────────────────────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── hospitals & coordinators ───────────────────────────────────────────────────

const HOSPITALS = [
  { name: "Apollo Cancer Centre, Chennai", city: "Chennai" },
  { name: "Tata Memorial Hospital, Mumbai", city: "Mumbai" },
  { name: "HCG Oncology, Bangalore", city: "Bangalore" },
];

// ── doctors ────────────────────────────────────────────────────────────────────

const DOCTOR_DEFS = [
  {
    name: "Dr. Ananya Krishnamurthy",
    specialization: "Medical Oncology",
    hospital: "Apollo Cancer Centre, Chennai",
    email: "ananya.k@apollo-cancer.in",
    whatsapp: "919841000001",
    isOptedIn: true,
  },
  {
    name: "Dr. Rajan Mehta",
    specialization: "Radiation Oncology",
    hospital: "Apollo Cancer Centre, Chennai",
    email: "rajan.mehta@apollo-cancer.in",
    whatsapp: "919841000002",
    isOptedIn: true,
  },
  {
    name: "Dr. Sunita Patel",
    specialization: "Surgical Oncology",
    hospital: "Tata Memorial Hospital, Mumbai",
    email: "sunita.patel@tmc.gov.in",
    whatsapp: "912200000003",
    isOptedIn: true,
  },
  {
    name: "Dr. Vikram Nair",
    specialization: "Medical Oncology",
    hospital: "Tata Memorial Hospital, Mumbai",
    email: "vikram.nair@tmc.gov.in",
    whatsapp: "912200000004",
    isOptedIn: true,
  },
  {
    name: "Dr. Meera Iyer",
    specialization: "Gynaecologic Oncology",
    hospital: "HCG Oncology, Bangalore",
    email: "meera.iyer@hcgoncology.in",
    whatsapp: "918012000005",
    isOptedIn: true,
  },
  {
    name: "Dr. Arjun Sharma",
    specialization: "Haematology & BMT",
    hospital: "HCG Oncology, Bangalore",
    email: "arjun.sharma@hcgoncology.in",
    whatsapp: "918012000006",
    isOptedIn: true,
  },
  {
    name: "Dr. Preethi Balan",
    specialization: "Paediatric Oncology",
    hospital: "Apollo Cancer Centre, Chennai",
    email: "preethi.balan@apollo-cancer.in",
    whatsapp: "919841000007",
    isOptedIn: false,
  },
  {
    name: "Dr. Sanjay Kulkarni",
    specialization: "Thoracic Oncology",
    hospital: "Tata Memorial Hospital, Mumbai",
    email: "sanjay.kulkarni@tmc.gov.in",
    whatsapp: "912200000008",
    isOptedIn: true,
  },
];

// ── patients ────────────────────────────────────────────────────────────────────

const PATIENT_DEFS = [
  {
    name: "Kavitha Rajagopal",
    whatsapp: "919500100001",
    cancer: "Breast Cancer",
    stage: "Stage II",
    protocol: "AC-T",
    hospital: "Apollo Cancer Centre, Chennai",
    doctorEmail: "ananya.k@apollo-cancer.in",
    gender: "FEMALE",
    age: 45,
    urgency: "critical",
  },
  {
    name: "Mohan Subramaniam",
    whatsapp: "919500100002",
    cancer: "Colorectal Cancer",
    stage: "Stage III",
    protocol: "FOLFOX",
    hospital: "Apollo Cancer Centre, Chennai",
    doctorEmail: "rajan.mehta@apollo-cancer.in",
    gender: "MALE",
    age: 58,
    urgency: "notable",
  },
  {
    name: "Lakshmi Venkataraman",
    whatsapp: "919500100003",
    cancer: "Cervical Cancer",
    stage: "Stage IIB",
    protocol: "Cisplatin-RT",
    hospital: "Apollo Cancer Centre, Chennai",
    doctorEmail: "ananya.k@apollo-cancer.in",
    gender: "FEMALE",
    age: 38,
    urgency: "stable",
  },
  {
    name: "Ramesh Iyer",
    whatsapp: "919500100004",
    cancer: "Lung Cancer",
    stage: "Stage IIIA",
    protocol: "Carboplatin-Paclitaxel",
    hospital: "Tata Memorial Hospital, Mumbai",
    doctorEmail: "sanjay.kulkarni@tmc.gov.in",
    gender: "MALE",
    age: 62,
    urgency: "critical",
  },
  {
    name: "Deepa Krishnan",
    whatsapp: "919500100005",
    cancer: "Ovarian Cancer",
    stage: "Stage IIIC",
    protocol: "Carboplatin-Paclitaxel",
    hospital: "HCG Oncology, Bangalore",
    doctorEmail: "meera.iyer@hcgoncology.in",
    gender: "FEMALE",
    age: 52,
    urgency: "notable",
  },
  {
    name: "Suresh Nagarajan",
    whatsapp: "919500100006",
    cancer: "Head and Neck Cancer",
    stage: "Stage IVA",
    protocol: "Cetuximab-RT",
    hospital: "Tata Memorial Hospital, Mumbai",
    doctorEmail: "vikram.nair@tmc.gov.in",
    gender: "MALE",
    age: 55,
    urgency: "critical",
  },
  {
    name: "Priya Sundaram",
    whatsapp: "919500100007",
    cancer: "Breast Cancer",
    stage: "Stage I",
    protocol: "CMF",
    hospital: "Apollo Cancer Centre, Chennai",
    doctorEmail: "ananya.k@apollo-cancer.in",
    gender: "FEMALE",
    age: 41,
    urgency: "stable",
  },
  {
    name: "Vijay Anand",
    whatsapp: "919500100008",
    cancer: "Non-Hodgkin Lymphoma",
    stage: "Stage III",
    protocol: "R-CHOP",
    hospital: "HCG Oncology, Bangalore",
    doctorEmail: "arjun.sharma@hcgoncology.in",
    gender: "MALE",
    age: 48,
    urgency: "notable",
  },
  {
    name: "Seetha Devi",
    whatsapp: "919500100009",
    cancer: "Thyroid Cancer",
    stage: "Stage II",
    protocol: "RAI",
    hospital: "HCG Oncology, Bangalore",
    doctorEmail: "meera.iyer@hcgoncology.in",
    gender: "FEMALE",
    age: 34,
    urgency: "stable",
  },
  {
    name: "Karthik Balaji",
    whatsapp: "919500100010",
    cancer: "Gastric Cancer",
    stage: "Stage IIIB",
    protocol: "FLOT",
    hospital: "Tata Memorial Hospital, Mumbai",
    doctorEmail: "sunita.patel@tmc.gov.in",
    gender: "MALE",
    age: 67,
    urgency: "critical",
  },
];

// ── main ────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Onco Board — Rich Demo Seed Starting...\n");

  // 1. Ensure demo coordinator exists
  const coordHash = await bcrypt.hash("CareSetu@2026", 12);
  const coordinator = await prisma.coordinator.upsert({
    where: { email: "coordinator@caresetu.health" },
    update: { passwordHash: coordHash, role: "ADMIN" },
    create: {
      email: "coordinator@caresetu.health",
      passwordHash: coordHash,
      name: "Demo Coordinator",
      role: "ADMIN",
      hospitalName: "Care Setu Demo",
      isActive: true,
    },
  });
  console.log(`✅ Coordinator: ${coordinator.email} (ADMIN)`);

  // 2. Upsert doctors
  console.log("\n🩺 Upserting doctors...");
  const doctorMap: Record<string, string> = {}; // email → id

  for (const def of DOCTOR_DEFS) {
    const existing = await prisma.doctor.findFirst({
      where: { whatsappNumber: def.whatsapp },
    });
    const doctor = existing
      ? await prisma.doctor.update({
          where: { id: existing.id },
          data: {
            name: def.name,
            email: def.email,
            hospitalName: def.hospital,
            specialization: def.specialization,
            isOptedIn: def.isOptedIn,
          },
        })
      : await prisma.doctor.create({
          data: {
            whatsappNumber: def.whatsapp,
            name: def.name,
            email: def.email,
            hospitalName: def.hospital,
            specialization: def.specialization,
            isOptedIn: def.isOptedIn,
            qualifications: ["MBBS", "MD", "DM Oncology"],
            experienceYears: Math.floor(Math.random() * 15) + 5,
          },
        });
    doctorMap[def.email] = doctor.id;
    console.log(`  ✅ ${doctor.name} (${def.specialization})`);
  }

  // 3. Create DoctorUser for opted-in doctors
  console.log("\n🔐 Creating DoctorUser accounts for opted-in doctors...");
  for (const def of DOCTOR_DEFS.filter((d) => d.isOptedIn)) {
    const doctorId = doctorMap[def.email];
    if (!doctorId) continue;
    await prisma.doctorUser.upsert({
      where: { doctorId },
      update: { email: def.email },
      create: { doctorId, email: def.email },
    });
    console.log(`  ✅ DoctorUser → ${def.email}`);
  }

  // 4. Upsert patients + care team
  console.log("\n👤 Upserting patients...");
  const patientIds: string[] = [];

  for (const def of PATIENT_DEFS) {
    const existing = await prisma.patient.findFirst({
      where: { whatsappNumber: def.whatsapp },
    });
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - def.age);

    const patient = existing
      ? await prisma.patient.update({
          where: { id: existing.id },
          data: {
            name: def.name,
            cancerType: def.cancer,
            stage: def.stage,
            treatmentProtocol: def.protocol,
            hospitalName: def.hospital,
            gender: def.gender,
            dateOfBirth: dob,
            isActive: true,
            onboardingStep: 9,
            assignedCoordinatorId: coordinator.id,
          },
        })
      : await prisma.patient.create({
          data: {
            whatsappNumber: def.whatsapp,
            name: def.name,
            cancerType: def.cancer,
            stage: def.stage,
            treatmentProtocol: def.protocol,
            hospitalName: def.hospital,
            gender: def.gender,
            dateOfBirth: dob,
            cycleStartDate: daysAgo(Math.floor(Math.random() * 60) + 10),
            doctorName: DOCTOR_DEFS.find((d) => d.email === def.doctorEmail)?.name || "TBD",
            isActive: true,
            onboardingStep: 9,
            assignedCoordinatorId: coordinator.id,
            language: "en",
          },
        });

    patientIds.push(patient.id);

    // Link doctor to patient's care team
    const doctorId = def.doctorEmail ? doctorMap[def.doctorEmail] : null;
    if (doctorId) {
      const ctExisting = await prisma.careTeamMember.findFirst({
        where: { patientId: patient.id, doctorId },
      });
      if (!ctExisting) {
        await prisma.careTeamMember.create({
          data: {
            patientId: patient.id,
            doctorId,
            role: "MEDICAL_ONCOLOGIST",
            name: DOCTOR_DEFS.find((d) => d.email === def.doctorEmail)?.name || "Unknown",
            hospitalName: def.hospital,
            isPrimary: true,
            isActive: true,
          },
        });
      }
    }

    console.log(
      `  ✅ ${def.name} — ${def.cancer} ${def.stage} [${def.urgency}]`
    );
  }

  // 5. Add check-ins (last 14 days)
  console.log("\n📊 Adding check-in data...");
  let checkinCount = 0;
  for (const patientId of patientIds) {
    const urgency = PATIENT_DEFS[patientIds.indexOf(patientId)]?.urgency;
    for (let daysBack = 14; daysBack >= 0; daysBack -= 2) {
      const baseScore =
        urgency === "critical" ? 3 : urgency === "notable" ? 5 : 7;
      const score = Math.min(10, Math.max(1, baseScore + (Math.random() * 2 - 1)));
      const existing = await prisma.checkin.findFirst({
        where: {
          patientId,
          createdAt: { gte: daysAgo(daysBack + 1), lte: daysAgo(daysBack - 1) },
        },
      });
      if (!existing) {
        const sideEffect =
          urgency === "critical"
            ? rand(["Severe fatigue, unable to eat", "Fever 38.9°C, chills", "Grade 3 mucositis"])
            : rand(["Mild nausea", "Manageable fatigue", "Sleeping well"]);
        await prisma.checkin.create({
          data: {
            patientId,
            score: Math.round(score),
            symptoms: [sideEffect],
            emotionalState: urgency === "critical" ? "anxious" : "okay",
            notes: sideEffect,
            cycleDay: daysBack % 21 || 1,
            createdAt: daysAgo(daysBack),
          },
        });
        checkinCount++;
      }
    }
  }
  console.log(`  ✅ ${checkinCount} check-ins created`);

  // 6. Add lab results
  console.log("\n🧪 Adding lab results...");
  let labCount = 0;
  const labTests = [
    { name: "Absolute Neutrophil Count", category: "HAEMATOLOGY", unit: "cells/μL", normal: [1800, 7800] },
    { name: "Haemoglobin", category: "HAEMATOLOGY", unit: "g/dL", normal: [12, 16] },
    { name: "Platelet Count", category: "HAEMATOLOGY", unit: "cells/μL", normal: [150000, 400000] },
    { name: "Serum Creatinine", category: "RENAL", unit: "mg/dL", normal: [0.6, 1.2] },
    { name: "ALT", category: "HEPATIC", unit: "U/L", normal: [7, 45] },
    { name: "CA-125", category: "TUMOUR_MARKERS", unit: "U/mL", normal: [0, 35] },
  ];

  for (const patientId of patientIds.slice(0, 8)) {
    const urgency = PATIENT_DEFS[patientIds.indexOf(patientId)]?.urgency;
    for (const test of labTests.slice(0, 3)) {
      const [lo, hi] = test.normal;
      const normal = lo + Math.random() * (hi - lo);
      const value = urgency === "critical" ? normal * (Math.random() > 0.5 ? 0.4 : 1.8) : normal * (0.9 + Math.random() * 0.2);
      const isAbnormal = value < lo || value > hi;
      const existing = await prisma.labResult.findFirst({
        where: { patientId, testName: test.name, testDate: { gte: daysAgo(8) } },
      });
      if (!existing) {
        await prisma.labResult.create({
          data: {
            patientId,
            testDate: daysAgo(Math.floor(Math.random() * 7) + 1),
            category: test.category,
            testName: test.name,
            value: parseFloat(value.toFixed(2)),
            unit: test.unit,
            refMin: lo,
            refMax: hi,
            isAbnormal,
            flag: isAbnormal ? (value < lo ? "LOW" : "HIGH") : undefined,
            source: "LAB_REPORT",
            cycleNumber: Math.floor(Math.random() * 4) + 1,
          },
        });
        labCount++;
      }
    }
  }
  console.log(`  ✅ ${labCount} lab results created`);

  // 7. Add alerts for critical patients
  console.log("\n🚨 Adding alerts...");
  let alertCount = 0;
  const criticalPatients = PATIENT_DEFS.filter((p) => p.urgency === "critical");
  for (const def of criticalPatients) {
    const patientId = patientIds[PATIENT_DEFS.indexOf(def)];
    const existing = await prisma.alert.findFirst({
      where: { patientId, severity: "CRITICAL", resolvedAt: null },
    });
    if (!existing) {
      await prisma.alert.create({
        data: {
          patientId,
          type: rand(["FEVER", "NEUTROPENIA", "SEVERE_PAIN", "GRADE3_TOXICITY"]),
          severity: "CRITICAL",
          message: rand([
            "Patient reported fever >38.5°C — possible febrile neutropenia",
            "ANC <500 cells/μL — Grade 4 neutropenia detected",
            "Patient reporting Grade 3 nausea/vomiting — unable to maintain oral intake",
            "Severe dyspnoea reported — O2 saturation 91% at rest",
          ]),
          coordinatorNotified: true,
          createdAt: daysAgo(Math.floor(Math.random() * 3)),
        },
      });
      alertCount++;
    }
  }

  // Notable patients get lower-severity alerts
  const notablePatients = PATIENT_DEFS.filter((p) => p.urgency === "notable");
  for (const def of notablePatients) {
    const patientId = patientIds[PATIENT_DEFS.indexOf(def)];
    const existing = await prisma.alert.findFirst({
      where: { patientId, severity: "MEDIUM", resolvedAt: null },
    });
    if (!existing) {
      await prisma.alert.create({
        data: {
          patientId,
          type: "MISSED_CHECKIN",
          severity: "MEDIUM",
          message: "Patient missed 2 consecutive check-ins — follow-up required",
          coordinatorNotified: false,
          createdAt: daysAgo(1),
        },
      });
      alertCount++;
    }
  }
  console.log(`  ✅ ${alertCount} alerts created`);

  // 8. Add appointments (today + next 7 days)
  console.log("\n📅 Adding appointments...");
  let apptCount = 0;
  for (let i = 0; i < patientIds.length; i++) {
    const patientId = patientIds[i];
    const daysOffset = i % 7; // spread across next week
    const apptDate = daysFromNow(daysOffset);
    apptDate.setHours(9 + (i % 4) * 2, 0, 0, 0);

    const existing = await prisma.appointment.findFirst({
      where: { patientId, scheduledAt: { gte: daysFromNow(-1) } },
    });
    if (!existing) {
      const def = PATIENT_DEFS[i];
      const doctorDef = DOCTOR_DEFS.find((d) => d.email === def?.doctorEmail);
      await prisma.appointment.create({
        data: {
          patientId,
          scheduledAt: apptDate,
          doctorName: doctorDef?.name || "TBD",
          hospitalName: def?.hospital || "Care Setu Demo",
          type: rand(["CHEMOTHERAPY", "REVIEW", "FOLLOW_UP", "CONSULTATION"]),
          status: "SCHEDULED",
          notes: rand([
            "Cycle 4 Day 1 — pre-chemo bloods required",
            "Routine follow-up post Cycle 3",
            "Response assessment — imaging ordered",
            "Side effect review",
          ]),
        },
      });
      apptCount++;
    }
  }
  console.log(`  ✅ ${apptCount} appointments scheduled`);

  // 9. Add tumor-board meetings
  console.log("\n🏛️  Adding tumor-board meetings...");
  const tbExisting = await prisma.tumorBoardMeeting.findFirst({
    where: { createdAt: { gte: daysAgo(30) } },
  });
  if (!tbExisting) {
    for (let i = 0; i < 3; i++) {
      const patientId = patientIds[i];
      await prisma.tumorBoardMeeting.create({
        data: {
          patientId,
          scheduledAt: daysAgo(7 * (i + 1)),
          status: i < 2 ? "COMPLETED" : "SCHEDULED",
          agendaItems: [
            `Review ${PATIENT_DEFS[i].cancer} staging`,
            "Discuss treatment response",
            "Plan next cycle",
          ],
          decisions: i < 2 ? ["Continue current protocol", "Repeat imaging in 6 weeks"] : undefined,
          attendees: [
            DOCTOR_DEFS[0].name,
            DOCTOR_DEFS[1].name,
            "Radiologist",
            "Pathologist",
          ],
        },
      });
    }
    console.log("  ✅ 3 tumor-board meetings created");
  } else {
    console.log("  ⏭️  Tumor-board meetings already present, skipping");
  }

  // 10. Summary
  const counts = await Promise.all([
    prisma.patient.count(),
    prisma.doctor.count(),
    prisma.doctorUser.count(),
    prisma.checkin.count(),
    prisma.labResult.count(),
    prisma.alert.count({ where: { resolvedAt: null } }),
    prisma.appointment.count(),
  ]);

  console.log("\n═══════════════════════════════════════════");
  console.log("  ONCO BOARD — DEMO DATA SUMMARY");
  console.log("═══════════════════════════════════════════");
  console.log(`  Patients:         ${counts[0]}`);
  console.log(`  Doctors:          ${counts[1]}`);
  console.log(`  DoctorUsers:      ${counts[2]}`);
  console.log(`  Check-ins:        ${counts[3]}`);
  console.log(`  Lab Results:      ${counts[4]}`);
  console.log(`  Active Alerts:    ${counts[5]}`);
  console.log(`  Appointments:     ${counts[6]}`);
  console.log("═══════════════════════════════════════════\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
