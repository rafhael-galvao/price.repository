import z4 from "zod/v4";

const optionalUrl = z4
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .pipe(z4.url().optional());

const optionalString = z4
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined);

export const envSchema = z4.object({
    NODE_ENV: z4.enum(["development", "test", "production"]).default("development"),
    PORT: z4.coerce.number().default(3000),

    META_WEBHOOK_VERIFY_TOKEN: z4.string().default("dev-whatsapp-verify-token"),
    META_WHATSAPP_API_VERSION: z4.string().default("21.0"),

    WHATSAPP_OFFICIAL_PHONE_NUMBER_ID: optionalString,
    WHATSAPP_OFFICIAL_ACCESS_TOKEN: optionalString,
    OFFICIAL_SUPABASE_URL: optionalUrl,
    OFFICIAL_SUPABASE_SERVICE_ROLE_KEY: optionalString,

    WHATSAPP_TEST_PHONE_NUMBER_ID: optionalString,
    WHATSAPP_TEST_ACCESS_TOKEN: optionalString,
    TEST_SUPABASE_URL: optionalUrl,
    TEST_SUPABASE_SERVICE_ROLE_KEY: optionalString,

    LOCAL_SUPABASE_URL: optionalUrl,
    LOCAL_SUPABASE_SERVICE_ROLE_KEY: optionalString,
    LOCAL_MOCK_PHONE_NUMBER_ID: z4.string().default("local-dev-phone-number-id"),
    LOCAL_MOCK_RECIPIENT_PHONE: z4.string().default("5511999999999"),
});

export const env = envSchema.parse(process.env);

export type Env = z4.infer<typeof envSchema>;
