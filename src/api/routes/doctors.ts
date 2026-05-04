import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";

export function registerDoctorRoutes(fastify: FastifyInstance) {
  const auth = [(fastify as any).authenticate];

  // List all doctors (any coordinator); optional ?hospitalName= filter
  fastify.get("/doctors", { preHandler: auth }, async (request) => {
    const { hospitalName } = request.query as { hospitalName?: string };
    return prisma.doctor.findMany({
      where: hospitalName ? { hospitalName } : undefined,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { patients: true, careTeamMembers: true } },
      },
    });
  });

  // Single doctor detail
  fastify.get("/doctors/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: {
        patients: { select: { id: true, name: true, cancerType: true, stage: true, isActive: true } },
        referralsTo: {
          where: { status: { in: ["pending", "accepted", "seen"] } },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { patient: { select: { id: true, name: true } } },
        },
        _count: { select: { patients: true, careTeamMembers: true } },
      },
    });
    if (!doctor) return reply.status(404).send({ error: "Doctor not found" });
    return doctor;
  });

  // Create doctor — ADMIN only
  fastify.post("/doctors", { preHandler: auth }, async (request, reply) => {
    const user = (request as any).user as { role: string };
    if (user.role !== "ADMIN") return reply.status(403).send({ error: "ADMIN role required" });

    const body = request.body as {
      whatsappNumber: string;
      name: string;
      hospitalName: string;
      specialization?: string;
      registrationNumber?: string;
      qualifications?: string[];
      department?: string;
      experienceYears?: number;
      secondaryPhone?: string;
      email?: string;
      availabilityNotes?: string;
      photoUrl?: string;
      bio?: string;
      isOptedIn?: boolean;
    };

    if (!body.whatsappNumber || !body.name || !body.hospitalName) {
      return reply.status(400).send({ error: "whatsappNumber, name, and hospitalName are required" });
    }

    const doctor = await prisma.doctor.create({
      data: {
        whatsappNumber: body.whatsappNumber,
        name: body.name,
        hospitalName: body.hospitalName,
        specialization: body.specialization ?? "Oncology",
        registrationNumber: body.registrationNumber,
        qualifications: body.qualifications ?? [],
        department: body.department,
        experienceYears: body.experienceYears,
        secondaryPhone: body.secondaryPhone,
        email: body.email,
        availabilityNotes: body.availabilityNotes,
        photoUrl: body.photoUrl,
        bio: body.bio,
        isOptedIn: body.isOptedIn ?? false,
      },
    });
    return reply.status(201).send(doctor);
  });

  // Update doctor — ADMIN only
  fastify.patch("/doctors/:id", { preHandler: auth }, async (request, reply) => {
    const user = (request as any).user as { role: string };
    if (user.role !== "ADMIN") return reply.status(403).send({ error: "ADMIN role required" });

    const { id } = request.params as { id: string };
    const body = request.body as Record<string, any>;

    const doctor = await prisma.doctor.update({
      where: { id },
      data: body,
    });
    return doctor;
  });

  // Link a CareTeamMember to a Doctor profile — ADMIN only
  fastify.patch("/care-team/:memberId/link-doctor", { preHandler: auth }, async (request, reply) => {
    const user = (request as any).user as { role: string };
    if (user.role !== "ADMIN") return reply.status(403).send({ error: "ADMIN role required" });

    const { memberId } = request.params as { memberId: string };
    const { doctorId } = request.body as { doctorId: string };

    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) return reply.status(404).send({ error: "Doctor not found" });

    const member = await prisma.careTeamMember.update({
      where: { id: memberId },
      data: { doctorId, name: doctor.name },
      include: { doctor: true },
    });
    return member;
  });

  // Unlink a CareTeamMember from their Doctor — ADMIN only
  fastify.delete("/care-team/:memberId/link-doctor", { preHandler: auth }, async (request, reply) => {
    const user = (request as any).user as { role: string };
    if (user.role !== "ADMIN") return reply.status(403).send({ error: "ADMIN role required" });

    const { memberId } = request.params as { memberId: string };
    const member = await prisma.careTeamMember.update({
      where: { id: memberId },
      data: { doctorId: null },
    });
    return member;
  });
}
