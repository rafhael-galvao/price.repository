import { env } from "@/config/env";

export type ChannelName = "official" | "test" | "local";
export type DeliveryMode = "real" | "mock";

export type ChannelContext = {
    channel: ChannelName;
    phoneNumberId: string;
    whatsappAccessToken?: string;
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    deliveryMode: DeliveryMode;
};

function assertString(value: string | undefined, label: string): string {
    if (!value) {
        throw new Error(`Missing required environment variable: ${label}`);
    }

    return value;
}

function buildOfficialContext(): ChannelContext | null {
    if (!env.WHATSAPP_OFFICIAL_PHONE_NUMBER_ID) {
        return null;
    }

    return {
        channel: "official",
        phoneNumberId: env.WHATSAPP_OFFICIAL_PHONE_NUMBER_ID,
        whatsappAccessToken: assertString(env.WHATSAPP_OFFICIAL_ACCESS_TOKEN, "WHATSAPP_OFFICIAL_ACCESS_TOKEN"),
        supabaseUrl: assertString(env.OFFICIAL_SUPABASE_URL, "OFFICIAL_SUPABASE_URL"),
        supabaseServiceRoleKey: assertString(env.OFFICIAL_SUPABASE_SERVICE_ROLE_KEY, "OFFICIAL_SUPABASE_SERVICE_ROLE_KEY"),
        deliveryMode: "real",
    };
}

function buildTestContext(): ChannelContext | null {
    if (!env.WHATSAPP_TEST_PHONE_NUMBER_ID) {
        return null;
    }

    return {
        channel: "test",
        phoneNumberId: env.WHATSAPP_TEST_PHONE_NUMBER_ID,
        whatsappAccessToken: assertString(env.WHATSAPP_TEST_ACCESS_TOKEN, "WHATSAPP_TEST_ACCESS_TOKEN"),
        supabaseUrl: assertString(env.TEST_SUPABASE_URL, "TEST_SUPABASE_URL"),
        supabaseServiceRoleKey: assertString(env.TEST_SUPABASE_SERVICE_ROLE_KEY, "TEST_SUPABASE_SERVICE_ROLE_KEY"),
        deliveryMode: "real",
    };
}

export function resolveIncomingChannelContext(phoneNumberId: string): ChannelContext | null {
    const officialContext = buildOfficialContext();
    if (officialContext && officialContext.phoneNumberId === phoneNumberId) {
        return officialContext;
    }

    const testContext = buildTestContext();
    if (testContext && testContext.phoneNumberId === phoneNumberId) {
        return testContext;
    }

    return null;
}

export function getLocalChannelContext(): ChannelContext {
    return {
        channel: "local",
        phoneNumberId: env.LOCAL_MOCK_PHONE_NUMBER_ID,
        supabaseUrl: assertString(env.LOCAL_SUPABASE_URL, "LOCAL_SUPABASE_URL"),
        supabaseServiceRoleKey: assertString(env.LOCAL_SUPABASE_SERVICE_ROLE_KEY, "LOCAL_SUPABASE_SERVICE_ROLE_KEY"),
        deliveryMode: "mock",
    };
}
