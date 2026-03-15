import { supabase } from "@/services/supabase";
import { WhatsappChat } from "@/services/whatsapp-chat";
import { parseTemplate } from "@/utils/parse-template";
import type { FastifyInstanceWithZod, FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import z4 from "zod/v4";

const whatsappWebhookPayloadSchema = z4.object({
    entry: z4.array(
        z4.object({
            changes: z4.array(
                z4.object({
                    value: z4.object({
                        messages: z4.array(
                            z4.object({
                                from: z4.string(),
                                text: z4.object({
                                    body: z4.string()
                                }).optional(),
                                id: z4.string().optional(),
                                timestamp: z4.string().optional(),
                                type: z4.string().optional()
                            })
                        ).optional()
                    })
                })
            )
        })
    )
});

const schema = {
    body: whatsappWebhookPayloadSchema
} satisfies FastifySchema

export default async function (app: FastifyInstanceWithZod) {
    return app
        .post('/', { schema }, async (req, rep) => {
            const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
            console.log(`\nWebhook received ${timestamp}\n`);

            const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
            if (!msg) return rep.status(StatusCodes.OK).send();

            const from = msg.from;
            const text = msg.text?.body?.trim().toLowerCase() || "";

            console.log("FROM:", from);
            console.log("TEXT:", text);

            const chat = new WhatsappChat(from)

            const answerChat = async (message: string) => {
                await chat.message({
                    content: message
                });
                return rep.status(StatusCodes.OK).send()
            }

            try {
                // 🔹 Ignorar mensagens muito curtas
                if (text.length < 3) {
                    return answerChat("Digite o nome de um produto para consultar preços 🙂")
                }

                const greetings = ["oi", "oii", "olá", "ola", "bom dia", "boa tarde", "boa noite"];

                if (greetings.includes(text)) {
                    return answerChat(
                        [
                            "Olá! 👋",
                            "Digite o nome do produto que deseja consultar."
                        ].join("\n")
                    )
                }

                const {
                    data: products,
                    error: fetchProductsError
                } = await supabase
                    .from('produtos')
                    .select('id')
                    .ilike('nome', `%${text}%`)
                    .limit(1);

                if (fetchProductsError || !products || products.length === 0) {
                    return answerChat(`Produto "${text}" não encontrado.`)
                }

                const [firstProductFounded] = products

                const {
                    data: metadataForFirstProduct,
                    error: fetchMetadataForFirstProductError
                } = await supabase
                    .from('precos')
                    .select(`
                        preco_normal,
                        preco_promocional,
                        moeda,
                        fonte,
                        url,
                        data_coleta,
                        mercados (
                            nome,
                            bairro,
                            cidade
                        ),
                        produtos (
                            nome
                        )
                    `)
                    .eq('produto_id', firstProductFounded.id);

                if (fetchMetadataForFirstProductError) {
                    console.error(fetchMetadataForFirstProductError);
                    return answerChat("Erro ao consultar preços 😕")
                }

                if (metadataForFirstProduct.length === 0) {
                    return answerChat(`Não encontrei preços para *${text}*`)
                }

                const validPrices = metadataForFirstProduct.filter(p => {
                    const valor = p.preco_promocional ?? p.preco_normal;
                    return valor && Number(valor) > 0;
                });

                if (validPrices.length === 0) {
                    return answerChat(`Não encontrei preços válidos para *${text}*`)
                }

                validPrices.sort((a, b) => {
                    const precoA = a.preco_promocional ?? a.preco_normal;
                    const precoB = b.preco_promocional ?? b.preco_normal;
                    return precoA - precoB;
                });

                const [bestProductPrice] = validPrices;
                const othersBestProductPrices = validPrices.slice(1, 4);

                const bestPrice = bestProductPrice.preco_promocional ?? bestProductPrice.preco_normal;

                const messageTemplate = [
                    "🥇 *Melhor preço para {{BEST_PRODUCT_NAME}}*",
                    "",
                    "🏪 {{STORE_NAME}}",
                    "📍 {{STORE_LOCALIZATION}}",
                    "💰 {{BEST_PRODUCT_PRICE}}",
                    "🔗 Fonte: {{SOURCE}}",
                    "📅 Coletado em: {{LATEST_EXTRACTION_DATE}}"
                ]

                if (othersBestProductPrices.length > 0) {
                    messageTemplate.push("")
                    othersBestProductPrices.forEach((_, i) => {
                        const pos = String(i + 1)
                        messageTemplate.push(
                            `${pos}º {{OTHER_STORE_${pos}_NAME}}`,
                            `💰 {{OTHER_STORE_${pos}_PRODUCT_PRICE}}`
                        )
                    })
                }

                const message = parseTemplate(messageTemplate.join("\n"), {
                    BEST_PRODUCT_NAME: bestProductPrice.produtos.at(0)?.nome || text,
                    STORE_NAME: bestProductPrice.mercados.at(0)?.nome,
                    STORE_LOCALIZATION: `${bestProductPrice.mercados.at(0)?.bairro} - ${bestProductPrice.mercados.at(0)?.cidade}`,
                    BEST_PRODUCT_PRICE: bestPrice,
                    SOURCE: bestProductPrice.fonte,
                    LATEST_EXTRACTION_DATE: bestProductPrice.data_coleta,
                    ...Object.fromEntries(
                        othersBestProductPrices.reduce(
                            (vars, other, i) => {
                                const pos = String(i + 1)
                                vars.set(`OTHER_STORE_${pos}_NAME`, other.mercados.at(0)?.nome)
                                vars.set(`OTHER_STORE_${pos}_PRODUCT_PRICE`, other.preco_promocional ?? other.preco_normal)
                                return vars
                            },
                            new Map
                        ).entries()
                    )
                })

                return answerChat(message)
            }
            catch (e) {
                console.error(e)
                return answerChat("Erro ao consultar preços 😕")
            }
        })
}