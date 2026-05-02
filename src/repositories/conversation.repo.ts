import { prisma } from "../db/client";
import type { IConversationRepository } from "./types";

export class ConversationRepository implements IConversationRepository {
  async findMany(patientId: string, opts = {}) {
    return prisma.conversation.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: 100,
      ...opts,
    });
  }

  async create(data: any) {
    return prisma.conversation.create({ data });
  }
}
