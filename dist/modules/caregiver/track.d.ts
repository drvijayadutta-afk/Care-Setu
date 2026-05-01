import type { Caregiver, Patient } from "@prisma/client";
export declare function handleCaregiverMessage(caregiver: Caregiver & {
    patient: Patient;
}, text: string, rawMessage: any): Promise<void>;
export declare function sendCaregiverMorningBrief(patientId: string): Promise<void>;
export declare function sendCaregiverWeeklyCheck(patientId: string): Promise<void>;
