import type { Patient } from "@prisma/client";
export declare function sendMedicationContext(patientId: string, medicationId: string): Promise<void>;
export declare function sendMedicationReminder(patientId: string): Promise<void>;
export declare function handleMedicationResponse(patient: Patient, replyId: string): Promise<void>;
export declare function handleMedicationQuery(patient: Patient, text: string): Promise<void>;
