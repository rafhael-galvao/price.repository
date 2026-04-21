import { createSupabaseClient } from "@/services/supabase";
import type { ChannelContext } from "@/services/channel-context";

export type OfferResult = {
    produto: string;
    preco: number;
    estabelecimento: string;
    bairro: string | null;
    logradouro: string | null;
    cidade: string;
    observacao: string | null;
    validade_fim: string | null;
    categoria: string | null;
};

export async function searchOffers(context: ChannelContext, term: string, limit = 5) {
    const supabase = createSupabaseClient({
        url: context.supabaseUrl,
        serviceRoleKey: context.supabaseServiceRoleKey,
    });

    const { data, error } = await supabase.rpc("buscar_ofertas", {
        p_termo: term,
        p_id_cidade: null,
        p_limite: limit,
    });

    if (error) {
        throw error;
    }

    return (data ?? []) as OfferResult[];
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T00:00:00`));
}

export function buildOffersResponse(searchTerm: string, offers: OfferResult[]) {
    if (offers.length === 0) {
        return `Nao encontrei ofertas para \"${searchTerm}\".`;
    }

    const lines = [`Melhores ofertas para *${offers[0].produto}*:`];

    offers.forEach((offer, index) => {
        const location = [offer.bairro, offer.cidade].filter(Boolean).join(" - ");

        lines.push(
            "",
            `${index + 1}. ${formatCurrency(offer.preco)} - ${offer.estabelecimento}`,
            location || offer.cidade,
        );

        if (offer.logradouro) {
            lines.push(offer.logradouro);
        }

        if (offer.validade_fim) {
            lines.push(`Validade: ${formatDate(offer.validade_fim)}`);
        }

        if (offer.observacao) {
            lines.push(`Obs: ${offer.observacao}`);
        }
    });

    return lines.join("\n");
}
