import { createSupabaseClient } from "@/supabase";
import type { Database } from "@/supabase/database.types";
import { formatCurrency } from "@/utils/format-currency";
import { formatDate } from "@/utils/format-date";

export type OfferResult = Database["public"]["Functions"]["buscar_ofertas"]["Returns"][number]

export async function searchOffers(term: string, limit = 5) {
    const supabase = createSupabaseClient();

    const { data, error } = await supabase.rpc("buscar_ofertas", {
        p_termo: term,
        p_limite: limit,
    });

    if (error) {
        throw error;
    }

    return (data ?? []) as OfferResult[]
}

function getStoreTypeEmoji(storeType?: string | null) {
    if (storeType === "farmacia") {
        return "💊";
    }

    if (storeType === "posto_combustivel") {
        return "⛽";
    }

    return "🛒";
}

function getPositionEmoji(index: number) {
    const positions = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
    return positions[index] ?? `${index + 1}.`;
}

export function buildOffersResponse(searchTerm: string, offers: OfferResult[]) {
    if (offers.length === 0) {
        return `🔎 Nao encontrei ofertas para *\"${searchTerm}\"*.`;
    }

    const uniqueCities = [...new Set(offers.map((offer) => offer.cidade).filter(Boolean))];
    const locationSuffix = uniqueCities.length === 1 ? ` em ${uniqueCities[0]}` : "";
    const resultLabel = offers.length === 1 ? "oferta" : "ofertas";

    const lines = [`🔎 Encontrei ${offers.length} ${resultLabel} para *\"${searchTerm}\"*${locationSuffix}:`];

    offers.forEach((offer, index) => {
        const position = getPositionEmoji(index);
        const storeEmoji = getStoreTypeEmoji(offer.tipo_estabelecimento);
        const location = offer.bairro ? `${offer.bairro}` : offer.cidade;

        lines.push(
            "",
            `${position} ${offer.produto} - ${formatCurrency(offer.preco)}`,
            `${storeEmoji} ${offer.estabelecimento}${location ? ` (${location})` : ""}`,
        );

        if (offer.logradouro) {
            lines.push(`📍 ${offer.logradouro}`);
        }

        if (offer.observacao) {
            lines.push(`💡 ${offer.observacao}`);
        }

        if (offer.validade_fim) {
            lines.push(`📅 Valido até: ${formatDate(offer.validade_fim)}`);
        }
    });

    return lines.join("\n");
}
