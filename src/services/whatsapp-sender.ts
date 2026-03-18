import { env } from "@/config/env";

type WhatsappSenderMessageOptions = {
    content: string
}
export class WhatsappSender {
    constructor(
        private phoneIdReceived: string,
        private recipientPhone: string
    ) { }

    async message({ content }: WhatsappSenderMessageOptions) {
        const url = new URL(`https://graph.facebook.com/v${env.META_WHATSAPP_API_VERSION}/${this.phoneIdReceived}/messages`);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.META_WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: this.recipientPhone,
                type: "text",
                text: { body: content }
            })
        });

        if (!res.ok) {
            console.error({
                res
            })
        }
    }
}