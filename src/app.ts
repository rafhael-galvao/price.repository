import Fastify from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";

import { env } from "@/config/env";
import webhookVerification from "@/routes/webhook-verification";
import webhookReceiveMessage from "@/routes/webhook-receive-message";

export function buildApp() {
    const app = Fastify().withTypeProvider<ZodTypeProvider>();

    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    app.get("/", async () => ({
        ok: true,
        webhook: "/webhook",
    }));

    app.register(webhookVerification);
    app.register(webhookReceiveMessage);

    return app;
}

export async function startApp() {
    const app = buildApp();
    await app.listen({ port: env.PORT, host: "0.0.0.0" });

    console.info("Servidor no ar");
    console.info(app.printRoutes());

    return app;
}
