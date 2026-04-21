import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { env } from "@/config/env";
import { startApp } from "@/app";
import { getLocalChannelContext } from "@/services/channel-context";
import { processIncomingWhatsappMessage } from "@/services/webhook-processor";

async function main() {
    await startApp();

    const localContext = getLocalChannelContext();
    const rl = readline.createInterface({ input, output });

    console.info("Modo local iniciado. Digite uma mensagem e pressione Enter. Ctrl+C para sair.");

    let messageCount = 0;
    while (true) {
        const body = await rl.question("> ");
        const trimmedBody = body.trim();

        if (!trimmedBody) {
            continue;
        }

        messageCount += 1;
        await processIncomingWhatsappMessage({
            phoneNumberId: localContext.phoneNumberId,
            context: localContext,
            message: {
                id: `local-message-${messageCount}`,
                from: env.LOCAL_MOCK_RECIPIENT_PHONE,
                timestamp: String(Date.now()),
                type: "text",
                text: {
                    body: trimmedBody,
                },
            },
        });
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
