import { supabase } from "@/services/supabase";
import { WhatsappSender } from "@/services/whatsapp-sender";
import { parseTemplate } from "@/utils/parse-template";
import type { FastifyInstanceWithZod, FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import z4 from "zod/v4";

const whatsappWebhookPayloadSchema = z4.object({
    object: z4.enum(['whatsapp_business_account']),
    entry: z4.tuple([
        z4.object({
            id: z4.string(),
            changes: z4.tuple([
                z4.object({
                    value: z4.object({
                        messaging_product: z4.literal("whatsapp"),
                        metadata: z4.object({
                            display_phone_number: z4.string(), // Número que recebeu
                            phone_number_id: z4.string()   // ID do número que recebeu
                        }),
                        contacts: z4.array(z4.object({
                            profile: z4.object({ name: z4.string() }),
                            wa_id: z4.string()
                        })),
                        messages: z4.tuple([
                            z4.object({
                                from: z4.string(),
                                text: z4.object({
                                    body: z4.string()
                                }),
                                id: z4.string(),
                                timestamp: z4.string(),
                                type: z4.enum(["text"])
                            })
                        ])
                    }),
                    field: z4.literal("messages")
                })
            ])
        })
    ])
});

const schema = {
    body: whatsappWebhookPayloadSchema
} satisfies FastifySchema

export default async function (app: FastifyInstanceWithZod) {
    return app
        .post('/', { schema }, async (req, rep) => {
            const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
            console.info(`\nWebhook received ${timestamp} with payload: \n`, JSON.stringify(req.body, null, 4));

            const { object, entry } = req.body

            if (object === "whatsapp_business_account") {
                for (const { changes } of entry) {
                    for (const { value } of changes) {
                        if (!value) continue

                        const phoneIdReceived = value.metadata.phone_number_id

                        console.info({
                            phoneIdReceived
                        })

                        for (const message of value.messages) {
                            handleMessage(phoneIdReceived, message)
                        }
                    }
                }
            }

            rep.status(StatusCodes.OK).send()
        })
}

type IncomingMessage = z4.infer<typeof whatsappWebhookPayloadSchema>["entry"][number]["changes"][number]["value"]["messages"][number]
async function handleMessage(phoneIdReceived: string, message: IncomingMessage) {
    const {
        from: recipientPhone,
        type: messageType,
        text: messageContent
    } = message

    const plainTextMessage = messageType === 'text' ? messageContent.body : ""

    const sender = new WhatsappSender(phoneIdReceived, recipientPhone)

    const answerChat = async (message: string) => {
        await sender.message({
            content: message
        });
    }

    try {
        const greetings = ["oi", "oii", "olá", "ola", "bom dia", "boa tarde", "boa noite"];

        if (greetings.includes(plainTextMessage)) {
            return answerChat(
                [
                    "Olá! 👋",
                    "Digite o nome do produto que deseja consultar."
                ].join("\n")
            )
        }

        // 🔹 Ignorar mensagens muito curtas
        if (plainTextMessage.length < 3) {
            return answerChat("Digite o nome de um produto para consultar preços 🙂")
        }

        const {
            data: products,
            error: fetchProductsError
        } = await supabase
            .from('produtos')
            .select('id')
            .ilike('nome', `%${plainTextMessage}%`)
            .limit(1);

        if (fetchProductsError || !products || products.length === 0) {
            return answerChat(`Produto "${plainTextMessage}" não encontrado.`)
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
            return answerChat(`Não encontrei preços para *${plainTextMessage}*`)
        }

        const validPrices = metadataForFirstProduct.filter(p => {
            const valor = p.preco_promocional ?? p.preco_normal;
            return valor && Number(valor) > 0;
        });

        if (validPrices.length === 0) {
            return answerChat(`Não encontrei preços válidos para *${plainTextMessage}*`)
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
            BEST_PRODUCT_NAME: bestProductPrice.produtos.at(0)?.nome || plainTextMessage,
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
}