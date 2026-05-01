export declare function sendText(to: string, body: string): Promise<string | null>;
export declare function sendButtonMessage(to: string, body: string, buttons: {
    id: string;
    title: string;
}[]): Promise<string | null>;
export declare function sendListMessage(to: string, body: string, buttonLabel: string, sections: {
    title: string;
    rows: {
        id: string;
        title: string;
        description?: string;
    }[];
}[]): Promise<string | null>;
export declare function sendTemplate(to: string, templateName: string, languageCode: string, components?: object[]): Promise<string | null>;
export declare function markRead(messageId: string): Promise<void>;
export declare function downloadMediaUrl(mediaId: string): Promise<string>;
