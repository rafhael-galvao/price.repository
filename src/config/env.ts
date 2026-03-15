import z4 from "zod/v4";

export const envSchema = z4.object({
    PORT: z4.coerce.number().default(3000),
    META_WEBHOOK_VERIFY_TOKEN: z4.string(),
    META_WHATSAPP_TOKEN: z4.string(),
    META_WHATSAPP_PHONE_ID: z4.string(),

    SUPABASE_URL: z4.url(),
    SUPABASE_KEY: z4.string()
})

export const env = envSchema.parse(process.env)

export type Env = z4.infer<typeof env>