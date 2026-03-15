import { env } from "@/config/env";

type WhatsappChatMessagePayload = {
    content: string
}
export class WhatsappChat {
    constructor(
        private appPhoneId: string,
        private phoneId: string
    ) { }

    async message({ content }: WhatsappChatMessagePayload) {
        const url = new URL(`https://graph.facebook.com/v18.0/${this.appPhoneId}/messages`);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.META_WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: this.phoneId,
                type: "text",
                text: { body: content }
            })
        });

        if (!res.ok) {
            console.info({
                res
            })
        }
    }
}