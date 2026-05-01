import type { Patient } from "@prisma/client";
export declare function handleOnboarding(whatsappNumber: string, patient: Patient | null, incomingText: string): Promise<void>;
