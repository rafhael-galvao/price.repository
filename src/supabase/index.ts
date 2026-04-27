import { env } from "@/config/env";
import type { Database } from "@/supabase/database.types";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseClient() {
    return createClient<Database>(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
}
