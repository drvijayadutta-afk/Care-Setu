import type { Patient } from "@prisma/client";
export declare function handleEmotionalSupport(patient: Patient, text: string, isNight: boolean, recentConversations: {
    role: string;
    content: string;
    createdAt: Date;
}[]): Promise<void>;
