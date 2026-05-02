import { prisma } from "../../db/client";
import type { AiPort } from "../../ports/ai";

export async function getMdtSummary(patientId: string, aiPort: AiPort) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      checkins: { orderBy: { createdAt: "desc" }, take: 14 },
      medications: { where: { isActive: true } },
      appointments: { orderBy: { scheduledAt: "desc" }, take: 5 },
      alerts: { where: { resolved: false } },
      labResults: { where: { isDeleted: false }, orderBy: { testDate: "desc" }, take: 30 },
      imagingReports: { orderBy: { studyDate: "desc" }, take: 5 },
      pathologyReports: { orderBy: { reportDate: "desc" }, take: 3 },
      vitalSigns: { orderBy: { recordedAt: "desc" }, take: 5 },
      clinicalNotes: { where: { noteType: "MDT_DECISION" }, orderBy: { noteDate: "desc" }, take: 5 },
      careTeamMembers: { where: { isActive: true } },
    },
  });

  if (!patient) throw new Error("Patient not found");

  const summary = await aiPort.generateMdtSummary(patient as any);
  return summary;
}
