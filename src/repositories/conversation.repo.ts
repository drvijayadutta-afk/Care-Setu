import { prisma } from "../db/client";
import type { IConversationRepository } from "./types";

export class ConversationRepository implements IConversationRepository {
  async findMany(patientId: string, opts: { take?: number; cursor?: string } = {}) {
    const { take = 50, cursor, ...rest } = opts;
    return prisma.conversation.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        patientId: true,
        role: true,
        messageType: true,
        content: true,
        isNightMode: true,
        intent: true,
        createdAt: true,
      },
    });
  }

  async create(data: any) {
    return prisma.conversation.create({ data });
  }
}
