import 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

declare module "fastify" {
    export interface FastifyInstanceWithZod extends FastifyInstance<
        RawServerDefault,
        RawRequestDefaultExpression,
        RawReplyDefaultExpression,
        FastifyBaseLogger,
        ZodTypeProvider
    > { }
}