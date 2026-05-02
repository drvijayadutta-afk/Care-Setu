import type { Patient } from "@prisma/client";
export declare function handleOnboarding(identifier: {
    whatsappNumber: string;
} | {
    telegramChatId: string;
} | {
    patientId: string;
}, patient: Patient | null, incomingText: string): Promise<void>;
