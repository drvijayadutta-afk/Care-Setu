"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPreVisitBrief = sendPreVisitBrief;
exports.sendAppointmentReminder = sendAppointmentReminder;
const client_1 = require("../../db/client");
const router_1 = require("../../messaging/router");
const claude_1 = require("../../integrations/claude");
const prompts_1 = require("../../ai/prompts");
async function sendPreVisitBrief(appointmentId, patientId) {
    const [patient, appointment] = await Promise.all([
        client_1.prisma.patient.findUnique({ where: { id: patientId }, include: { caregiver: true } }),
        client_1.prisma.appointment.findUnique({ where: { id: appointmentId } }),
    ]);
    if (!patient || !appointment)
        return;
    // Get last 21 days of check-ins
    const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
    const checkins = await client_1.prisma.checkin.findMany({
        where: { patientId, createdAt: { gte: threeWeeksAgo } },
        orderBy: { createdAt: "asc" },
        select: { score: true, symptoms: true, emotionalState: true, cycleDay: true, createdAt: true },
    });
    // Calculate medication adherence
    const totalLogs = await client_1.prisma.medicationLog.count({ where: { patientId } });
    const takenLogs = await client_1.prisma.medicationLog.count({ where: { patientId, taken: true } });
    const adherencePct = totalLogs > 0 ? Math.round((takenLogs / totalLogs) * 100) : 100;
    // Extract questions patient has asked/mentioned
    const recentConvos = await client_1.prisma.conversation.findMany({
        where: { patientId, role: "patient", createdAt: { gte: threeWeeksAgo } },
        select: { content: true },
        take: 30,
    });
    const questionKeywords = ["kyun", "why", "kya", "what", "kab", "when", "doctor", "poochhna", "ask"];
    const patientQuestions = recentConvos
        .filter((c) => questionKeywords.some((kw) => c.content.toLowerCase().includes(kw)))
        .map((c) => c.content.substring(0, 80))
        .slice(0, 3);
    const brief = await (0, claude_1.askClaude)((0, prompts_1.PRE_VISIT_BRIEF_PROMPT)(patient.name, patient.cancerType, patient.treatmentProtocol, patient.currentCycle, checkins.map((c) => ({
        date: c.createdAt.toLocaleDateString("en-IN"),
        score: c.score,
        symptoms: c.symptoms,
        cycleDay: c.cycleDay,
    })), patientQuestions, adherencePct), "Generate the brief now.", 400);
    // Send to patient
    const patientMsg = patient.language === "hi"
        ? `📋 Kal ka appointment — aapka summary ready hai:\n\n${brief}\n\nYe apne doctor ko dikha saktein hain apne phone se. 🙏`
        : `📋 Tomorrow's visit — your summary is ready:\n\n${brief}\n\nYou can show this to your doctor from your phone. 🙏`;
    await router_1.messagingRouter.sendText(patient.id, patientMsg);
    // Send to doctor if opted in
    const doctor = await client_1.prisma.doctor.findFirst({
        where: {
            name: { contains: patient.doctorName, mode: "insensitive" },
            isOptedIn: true,
        },
    });
    if (doctor?.whatsappNumber) {
        await router_1.messagingRouter.sendText(doctor.whatsappNumber, `📋 Pre-visit brief — ${patient.name}\n(Tomorrow ${appointment.scheduledAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })})\n\n${brief}`, true);
    }
    // Update appointment record
    await client_1.prisma.appointment.update({
        where: { id: appointmentId },
        data: { briefSent: true },
    });
}
async function sendAppointmentReminder(appointmentId, patientId, type) {
    const [patient, appointment] = await Promise.all([
        client_1.prisma.patient.findUnique({ where: { id: patientId }, include: { caregiver: true } }),
        client_1.prisma.appointment.findUnique({ where: { id: appointmentId } }),
    ]);
    if (!patient || !appointment)
        return;
    const lang = patient.language;
    const apptTime = appointment.scheduledAt.toLocaleString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
    switch (type) {
        case "48h": {
            const msg = lang === "hi"
                ? `📅 Yaad dilana — parson aapka appointment hai:\n${appointment.doctorName} — ${appointment.hospitalName}\n${apptTime}\n\nKoi documents ya reports taiyaar kar lein.`
                : `📅 Reminder — your appointment is in 2 days:\n${appointment.doctorName} — ${appointment.hospitalName}\n${apptTime}\n\nGet any reports or documents ready.`;
            await router_1.messagingRouter.sendText(patient.id, msg);
            break;
        }
        case "24h": {
            const msg = lang === "hi"
                ? `📅 Kal appointment hai:\n${appointment.doctorName} — ${appointment.hospitalName}\n${apptTime}\n\nLe jaayein:\n• Purani reports (x-ray, blood tests, scans)\n• Dawaiyon ki list\n• Koi bhi sawaal jo poochhna ho`
                : `📅 Appointment tomorrow:\n${appointment.doctorName} — ${appointment.hospitalName}\n${apptTime}\n\nBring:\n• Previous reports (x-ray, blood tests, scans)\n• Your medication list\n• Any questions you want to ask`;
            await router_1.messagingRouter.sendText(patient.id, msg);
            break;
        }
        case "2h": {
            const msg = lang === "hi"
                ? `📅 2 ghante mein appointment hai.\n\n${appointment.doctorName} — ${appointment.hospitalName}\n\nAapka summary doctor ko dikhane ke liye ready hai — neche scroll karein usse dhundne ke liye.\n\nKoi extra sawaal add karna hai? Abhi type karein.`
                : `📅 Your appointment is in 2 hours.\n\n${appointment.doctorName} — ${appointment.hospitalName}\n\nYour summary is ready to show the doctor — scroll up to find it.\n\nAnything to add before you go? Type it now.`;
            await router_1.messagingRouter.sendText(patient.id, msg);
            break;
        }
        case "post_visit": {
            const msg = lang === "hi"
                ? `Aapki visit kaisi rahi? 💙\n\n1 – Achhi khabar, rahat mili\n2 – Theek thaak, kuch process karna hai\n3 – Mushkil khabar, samay chahiye\n4 – Confuse hun, poori baat samajh nahi aayi\n5 – Kuch aur`
                : `How did your visit go? 💙\n\n1 – Good news, feeling relieved\n2 – Okay, some things to process\n3 – Difficult news, need some time\n4 – Confused, didn't fully understand\n5 – Something else`;
            await router_1.messagingRouter.sendText(patient.id, msg);
            await client_1.prisma.appointment.update({
                where: { id: appointmentId },
                data: { status: "completed", postVisitSent: true },
            });
            break;
        }
    }
}
//# sourceMappingURL=brief.js.map