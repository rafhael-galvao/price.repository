import { processIncomingWhatsappMessage, processIncomingWhatsappStatus } from "@/services/webhook-processor";
import type { FastifyInstanceWithZod, FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import z4 from "zod/v4";

const messageSchema = z4.object({
    from: z4.string(),
    id: z4.string(),
    timestamp: z4.string(),
    type: z4.string(),
    text: z4.object({
        body: z4.string(),
    }).optional(),
}).passthrough();

const statusSchema = z4.object({
    id: z4.string(),
    status: z4.string(),
    recipient_id: z4.string().optional(),
}).passthrough();

const whatsappWebhookPayloadSchema = z4.object({
    object: z4.literal("whatsapp_business_account"),
    entry: z4.array(
        z4.object({
            id: z4.string(),
            changes: z4.array(
                z4.object({
                    field: z4.string(),
                    value: z4.object({
                        messaging_product: z4.literal("whatsapp").optional(),
                        metadata: z4.object({
                            display_phone_number: z4.string().optional(),
                            phone_number_id: z4.string(),
                        }),
                        contacts: z4.array(
                            z4.object({
                                profile: z4.object({ name: z4.string() }).optional(),
                                wa_id: z4.string(),
                            }).passthrough()
                        ).optional(),
                        messages: z4.array(messageSchema).optional(),
                        statuses: z4.array(statusSchema).optional(),
                    }).passthrough(),
                }).passthrough()
            ),
        }).passthrough()
    ),
});

const schema = {
    body: whatsappWebhookPayloadSchema,
} satisfies FastifySchema;

export default async function (app: FastifyInstanceWithZod) {
    return app.post("/webhook", { schema }, async (req, rep) => {
        const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
        console.info(`Webhook received ${timestamp}`);

        for (const entry of req.body.entry) {
            for (const change of entry.changes) {
                const value = change.value;
                const phoneNumberId = value.metadata.phone_number_id;

                for (const status of value.statuses ?? []) {
                    await processIncomingWhatsappStatus(phoneNumberId, status);
                }

                for (const message of value.messages ?? []) {
                    await processIncomingWhatsappMessage({
                        phoneNumberId,
                        message,
                    });
                }
            }
        }

        return rep.status(StatusCodes.OK).send({ received: true });
    });
}
