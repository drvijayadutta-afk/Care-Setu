import type { Patient } from "@prisma/client";
export declare function handleAppointmentRequest(patient: Patient, text: string, preExtractedType?: string): Promise<void>;
