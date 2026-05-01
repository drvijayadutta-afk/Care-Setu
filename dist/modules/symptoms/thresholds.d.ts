import type { Patient, Checkin } from "@prisma/client";
export declare function evaluateThresholds(patient: Patient, checkin: Checkin, score: number, symptoms: string[], cycleDay: number): Promise<void>;
