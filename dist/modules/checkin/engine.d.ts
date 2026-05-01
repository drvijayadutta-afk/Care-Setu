import type { Patient } from "@prisma/client";
export declare function sendCheckinMessage(patientId: string, cycleDay: number, type: "morning" | "afternoon"): Promise<void>;
export declare function handleCheckinResponse(patient: Patient, text: string, preExtractedScore?: number | string | undefined, isSymptomReport?: boolean): Promise<void>;
