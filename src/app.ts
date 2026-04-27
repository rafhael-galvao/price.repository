import "@/config/env"
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";

import webhookVerification from "@/routes/webhook-verification";
import webhookReceiveMessage from "@/routes/webhook-receive-message";

export const app = Fastify().withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.get("/", async () => ({
    ok: true,
    webhook: "/webhook",
}));

app.register(webhookVerification);
app.register(webhookReceiveMessage);