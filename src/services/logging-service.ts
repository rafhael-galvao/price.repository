import { createSupabaseClient } from "@/services/supabase";
import type { ChannelContext } from "@/services/channel-context";
import type { MessageClassification } from "@/services/message-classifier";

type RegisterIntentInput = {
    context: ChannelContext;
    classification: MessageClassification;
    whatsappMessageId: string;
    recipientPhoneNumberId: string;
    normalizedMessage: string;
    receivedMessage: string;
    userPhone: string;
    identifiedTerm: string | null;
};

type RegisterResponseInput = {
    context: ChannelContext;
    intentId: string;
    totalResults: number;
    results: unknown[];
};

export async function registerIntentLog(input: RegisterIntentInput) {
    const supabase = createSupabaseClient({
        url: input.context.supabaseUrl,
        serviceRoleKey: input.context.supabaseServiceRoleKey,
    });

    const { data, error } = await supabase.rpc("registrar_log_intencao", {
        p_classificacao: input.classification,
        p_id_mensagem_whatsapp: input.whatsappMessageId,
        p_id_telefone_whatsapp_receptor: input.recipientPhoneNumberId,
        p_mensagem_normalizada: input.normalizedMessage,
        p_mensagem_recebida: input.receivedMessage,
        p_telefone_usuario: input.userPhone,
        p_termo_identificado: input.identifiedTerm,
    });

    if (error) {
        throw error;
    }

    return data as string;
}

export async function registerResponseLog(input: RegisterResponseInput) {
    const supabase = createSupabaseClient({
        url: input.context.supabaseUrl,
        serviceRoleKey: input.context.supabaseServiceRoleKey,
    });

    const { error } = await supabase.rpc("registrar_log_resposta", {
        p_id_intencao: input.intentId,
        p_total_resultados_busca: input.totalResults,
        p_resultados: input.results,
    });

    if (error) {
        throw error;
    }
}
