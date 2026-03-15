import { env } from "@/config/env"
import type { FastifyInstanceWithZod, FastifySchema } from "fastify"
import { StatusCodes } from "http-status-codes"
import z4 from "zod/v4"

const schema = {
    querystring: z4.object({
        'hub.mode': z4.literal('subscribe'),
        'hub.challenge': z4.string(),
        'hub.verify_token': z4.string()
    })
} satisfies FastifySchema

export default async function (app: FastifyInstanceWithZod) {
    return app
        .get('/', { schema }, async (req, rep) => {
            const {
                "hub.challenge": challenge,
                "hub.mode": mode,
                "hub.verify_token": verify_token
            } = req.query

            if (mode !== 'subscribe' || verify_token !== env.META_WEBHOOK_VERIFY_TOKEN) {
                return rep.status(StatusCodes.FORBIDDEN).send()
            }

            console.info('WEBHOOK VERIFIED');
            rep.status(StatusCodes.OK).send(challenge);
        })
}