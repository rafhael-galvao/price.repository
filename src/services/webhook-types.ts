export type IncomingWhatsappTextMessage = {
    id: string;
    from: string;
    timestamp: string;
    type: string;
    text?: {
        body: string;
    };
};

export type IncomingWhatsappStatus = {
    id: string;
    status: string;
    recipient_id?: string;
};
