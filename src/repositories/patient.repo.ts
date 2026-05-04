import { prisma } from "../db/client";
import type { IPatientRepository } from "./types";

export class PatientRepository implements IPatientRepository {
  async findUnique(id: string) {
    return prisma.patient.findUnique({ where: { id } });
  }

  async findMany(opts: { coordinatorId?: string; take?: number; orderBy?: any } = {}) {
    const { coordinatorId, ...rest } = opts;
    const coordinatorWhere = coordinatorId !== undefined
      ? { OR: [{ assignedCoordinatorId: coordinatorId }, { assignedCoordinatorId: null }] }
      : {};
    return prisma.patient.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      where: { isActive: true, ...coordinatorWhere },
      ...rest,
    });
  }

  async findByWhatsApp(phoneNumber: string) {
    return prisma.patient.findUnique({ where: { whatsappNumber: phoneNumber } });
  }

  async findByTelegram(chatId: string) {
    return prisma.patient.findUnique({ where: { telegramChatId: chatId } });
  }

  async create(data: any) {
    return prisma.patient.create({ data });
  }

  async update(id: string, data: any) {
    return prisma.patient.update({ where: { id }, data });
  }

  async count() {
    return prisma.patient.count();
  }
}
