import { buildOffersResponse, searchOffers } from "@/services/offers-service";
import { classifyMessage, normalizeMessage } from "@/services/message-classifier";
import { registerIntentLog, registerResponseLog } from "@/services/logging-service";
import { resolveIncomingChannelContext, type ChannelContext } from "@/services/channel-context";
import { WhatsappClient } from "@/services/whatsapp-client";
import type { IncomingWhatsappStatus, IncomingWhatsappTextMessage } from "@/services/webhook-types";

type ProcessMessageInput = {
    phoneNumberId: string;
    message: IncomingWhatsappTextMessage;
    context?: ChannelContext;
};

export async function processIncomingWhatsappMessage({ phoneNumberId, message, context }: ProcessMessageInput) {
    const resolvedContext = context ?? resolveIncomingChannelContext(phoneNumberId);
    if (!resolvedContext) {
        console.info(`Ignoring message for unknown phone_number_id: ${phoneNumberId}`);
        return;
    }

    const whatsappClient = new WhatsappClient(resolvedContext);
    await whatsappClient.markAsRead(message.id);
    await whatsappClient.sendTypingIndicator(message.id);

    const rawText = message.type === "text" ? message.text?.body ?? "" : `Mensagem do tipo ${message.type}`;
    const normalizedMessage = message.type === "text" ? normalizeMessage(rawText) : "";
    const classification = message.type === "text" ? classifyMessage(normalizedMessage) : "desconhecido";

    let responseMessage = "Envie o nome de um produto para buscar ofertas.";
    let totalResults = 0;
    let results: unknown[] = [];
    const identifiedTerm = classification === "busca" ? normalizedMessage : null;

    if (message.type !== "text") {
        responseMessage = "Formato invalido. Envie apenas mensagens de texto com o nome do produto.";
    } else if (classification === "saudacao") {
        responseMessage = "Ola! Envie o nome de um produto e eu busco as melhores ofertas para voce.";
    } else if (classification === "busca") {
        try {
            const offers = await searchOffers(resolvedContext, normalizedMessage);
            totalResults = offers.length;
            results = offers.map((offer) => ({
                produto: offer.produto,
                preco: offer.preco,
                estabelecimento: offer.estabelecimento,
                bairro: offer.bairro,
                cidade: offer.cidade,
                validade_fim: offer.validade_fim,
            }));
            responseMessage = buildOffersResponse(rawText, offers);
        } catch (error) {
            console.error(error);
            responseMessage = "Nao consegui consultar as ofertas agora. Tente novamente em instantes.";
        }
    }

    const intentId = await registerIntentLog({
        context: resolvedContext,
        classification,
        whatsappMessageId: message.id,
        recipientPhoneNumberId: phoneNumberId,
        normalizedMessage,
        receivedMessage: rawText,
        userPhone: message.from,
        identifiedTerm,
    });

    await whatsappClient.sendText({
        to: message.from,
        content: responseMessage,
    });

    await registerResponseLog({
        context: resolvedContext,
        intentId,
        totalResults,
        results,
    });
}

export async function processIncomingWhatsappStatus(phoneNumberId: string, status: IncomingWhatsappStatus) {
    const context = resolveIncomingChannelContext(phoneNumberId);
    if (!context) {
        return;
    }

    console.info(`[${context.channel}] status received`, status);
}
