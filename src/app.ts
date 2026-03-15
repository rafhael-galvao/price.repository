import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { env } from '@/config/env';

import webhookVerification from '@/routes/webhook-verification';
import webhookReceiveMessage from '@/routes/webhook-receive-message';

const app = Fastify().withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(webhookVerification)
app.register(webhookReceiveMessage)

app.listen({ port: env.PORT, host: '0.0.0.0' }, (err) => {
    if (err) {
        console.error(err)
        process.exit(1)
    }
    console.info("Servidor no ar 🚀")
    console.info(app.printRoutes())
})