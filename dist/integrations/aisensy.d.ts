export interface AisensyMessage {
    phoneNumber: string;
    message: string;
    messageId: string;
    timestamp: string;
    type?: string;
}
export declare function fetchNewMessages(): Promise<AisensyMessage[]>;
export declare function sendMessage(phoneNumber: string, message: string): Promise<string | null>;
