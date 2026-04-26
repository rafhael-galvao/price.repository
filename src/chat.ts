import { randomUUID } from "node:crypto";
import { cancel, isCancel, outro, spinner, text } from "@clack/prompts";

import { env } from "@/config/env";

async function main() {
    let shuttingDown = false;

    const shutdown = async () => {
        if (shuttingDown) {
            return;
        }

        shuttingDown = true;
        outro("Modo local encerrado.");
        process.exit(0);
    };

    process.once("SIGINT", () => {
        shutdown().catch((error) => {
            console.error(error);
            process.exit(1);
        });
    });

    console.info("Digite a mensagem para simular o webhook da Meta.");

    let messageCount = 0;
    while (true) {
        const body = await text({
            message: "Mensagem recebida",
            placeholder: "ex.: cerveja",
            validate(value) {
                if (!value.trim()) {
                    return "Digite algum texto para processar.";
                }
            },
        });

        if (isCancel(body)) {
            cancel("Encerrando modo local.");
            await shutdown();
        }

        if (typeof body !== "string") {
            continue;
        }

        const trimmedBody = body.trim();

        if (!trimmedBody) {
            continue;
        }

        messageCount += 1;
        const processing = spinner();
        processing.start("Processando mensagem...");

        try {
            // Montar o payload mock do webhook
            const payload = {
                object: "whatsapp_business_account",
                entry: [
                    {
                        id: "local-entry-id",
                        changes: [
                            {
                                field: "messages",
                                value: {
                                    messaging_product: "whatsapp",
                                    metadata: {
                                        display_phone_number: "1234567890",
                                        phone_number_id: env.META_WHATSAPP_PHONE_NUMBER_ID,
                                    },
                                    contacts: [
                                        {
                                            profile: { name: "Usuário Local" },
                                            wa_id: "local_wa_id",
                                        },
                                    ],
                                    messages: [
                                        {
                                            id: `local-message-${Date.now()}-${messageCount}-${randomUUID()}`,
                                            from: "5511999999999", // Mock wa_id do remetente
                                            timestamp: String(Date.now()),
                                            type: "text",
                                            text: {
                                                body: trimmedBody,
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            };

            // Fazer requisição interna para o endpoint /webhook
            const res = await fetch(`http://localhost:${env.PORT}/webhook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })

            if (!res.ok) {
                console.warn('Problemas ao enviar a mensagem para o webhook.', await res.text())
            }

            processing.stop("Mensagem processada.");
        } catch (error) {
            processing.stop("Falha ao processar mensagem.");
            console.error(error);
        }
    }
}

main().catch((error) => {
    outro("Modo local encerrado com erro.");
    console.error(error);
    process.exit(1);
});
