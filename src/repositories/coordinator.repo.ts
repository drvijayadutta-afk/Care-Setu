import { prisma } from "../db/client";
import type { ICoordinatorRepository } from "./types";

export class CoordinatorRepository implements ICoordinatorRepository {
  async findUnique(id: string) {
    return prisma.coordinator.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return prisma.coordinator.findUnique({ where: { email } });
  }

  async create(data: any) {
    return prisma.coordinator.create({ data });
  }

  async update(id: string, data: any) {
    return prisma.coordinator.update({ where: { id }, data });
  }
}
