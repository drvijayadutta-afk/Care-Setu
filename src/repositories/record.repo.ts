import { prisma } from "../db/client";
import type { IRecordRepository } from "./types";

export class RecordRepository implements IRecordRepository {
  labResults = {
    findMany: (patientId: string) =>
      prisma.labResult.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
    create: (data: any) => prisma.labResult.create({ data }),
    update: (id: string, data: any) => prisma.labResult.update({ where: { id }, data }),
    delete: (id: string) => prisma.labResult.delete({ where: { id } }).then(() => {}),
  };

  imaging = {
    findMany: (patientId: string) =>
      prisma.imagingReport.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
    create: (data: any) => prisma.imagingReport.create({ data }),
    update: (id: string, data: any) => prisma.imagingReport.update({ where: { id }, data }),
    delete: (id: string) => prisma.imagingReport.delete({ where: { id } }).then(() => {}),
  };

  pathology = {
    findMany: (patientId: string) =>
      prisma.pathologyReport.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
    create: (data: any) => prisma.pathologyReport.create({ data }),
    update: (id: string, data: any) => prisma.pathologyReport.update({ where: { id }, data }),
    delete: (id: string) => prisma.pathologyReport.delete({ where: { id } }).then(() => {}),
  };

  vitals = {
    findMany: (patientId: string) =>
      prisma.vitalSign.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
    findLatest: (patientId: string) =>
      prisma.vitalSign.findFirst({
        where: { patientId },
        orderBy: { createdAt: "desc" },
      }),
    create: (data: any) => prisma.vitalSign.create({ data }),
    update: (id: string, data: any) => prisma.vitalSign.update({ where: { id }, data }),
    delete: (id: string) => prisma.vitalSign.delete({ where: { id } }).then(() => {}),
  };

  notes = {
    findMany: (patientId: string) =>
      prisma.clinicalNote.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
    create: (data: any) => prisma.clinicalNote.create({ data }),
    update: (id: string, data: any) => prisma.clinicalNote.update({ where: { id }, data }),
    delete: (id: string) => prisma.clinicalNote.delete({ where: { id } }).then(() => {}),
  };

  documents = {
    findMany: (patientId: string) =>
      prisma.patientDocument.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
    create: (data: any) => prisma.patientDocument.create({ data }),
    update: (id: string, data: any) => prisma.patientDocument.update({ where: { id }, data }),
    delete: (id: string) => prisma.patientDocument.delete({ where: { id } }).then(() => {}),
  };

  careTeam = {
    findMany: (patientId: string) =>
      prisma.careTeamMember.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
    create: (data: any) => prisma.careTeamMember.create({ data }),
    update: (id: string, data: any) => prisma.careTeamMember.update({ where: { id }, data }),
    delete: (id: string) => prisma.careTeamMember.delete({ where: { id } }).then(() => {}),
  };

  checkins = {
    findMany: (patientId: string) =>
      prisma.checkin.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
    create: (data: any) => prisma.checkin.create({ data }),
    update: (id: string, data: any) => prisma.checkin.update({ where: { id }, data }),
    delete: (id: string) => prisma.checkin.delete({ where: { id } }).then(() => {}),
  };

  appointments = {
    findMany: (patientId: string) =>
      prisma.appointment.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
    findUnique: (id: string) => prisma.appointment.findUnique({ where: { id } }),
    create: (data: any) => prisma.appointment.create({ data }),
    update: (id: string, data: any) => prisma.appointment.update({ where: { id }, data }),
    delete: (id: string) => prisma.appointment.delete({ where: { id } }).then(() => {}),
  };
}
