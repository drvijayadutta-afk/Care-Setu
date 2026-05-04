import { prisma } from "../db/client";
import type { IConversationRepository } from "./types";

export class ConversationRepository implements IConversationRepository {
  async findMany(patientId: string, opts: { take?: number; cursor?: string } = {}) {
    const { take = 50, cursor } = opts;
    // Return all fields — explicit select was excluded triage fields after migration
    return prisma.conversation.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  async create(data: any) {
    return prisma.conversation.create({ data });
  }
}
