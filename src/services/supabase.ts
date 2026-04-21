import { createClient } from "@supabase/supabase-js";

type SupabaseCredentials = {
    url: string;
    serviceRoleKey: string;
};

export function createSupabaseClient({ url, serviceRoleKey }: SupabaseCredentials) {
    return createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
