import { env } from "@/config/env";
import { renderWhatsappPreview } from "@/utils/render-whatsapp-preview";

type SendTextMessageOptions = {
    to: string;
    content: string;
};

export class WhatsappClient {
    async markAsRead(messageId: string) {
        await this.dispatch({
            messaging_product: "whatsapp",
            status: "read",
            message_id: messageId,
        }, "markAsRead");
    }

    async sendTypingIndicator(messageId: string) {
        await this.dispatch({
            messaging_product: "whatsapp",
            status: "read",
            message_id: messageId,
            typing_indicator: {
                type: "text",
            },
        }, "sendTypingIndicator");
    }

    async sendText({ to, content }: SendTextMessageOptions) {
        await this.dispatch({
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: content },
        }, "sendText");
    }

    private async dispatch(body: Record<string, unknown>, action: string) {
        if (env.NODE_ENV === 'development') {
            console.info(action, JSON.stringify(body, null, 2));

            if (action === "sendText") {
                const content = typeof body.text === "object" && body.text && "body" in body.text
                    ? body.text.body
                    : "";

                if (typeof content === "string") {
                    console.info(renderWhatsappPreview(content));
                }
            }

            return;
        }

        const url = new URL(`https://graph.facebook.com/v${env.META_GRAPH_API_VERSION}/${env.META_WHATSAPP_PHONE_NUMBER_ID}/messages`);
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.META_GRAPH_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        console.log({
            url,
            res: await res.text()
        })

        if (!res.ok) {
            const errorBody = await res.text();
            throw new Error(`WhatsApp API request failed (${res.status}): ${errorBody}`);
        }
    }
}
