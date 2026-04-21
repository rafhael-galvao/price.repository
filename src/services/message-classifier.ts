export type MessageClassification = "saudacao" | "busca" | "desconhecido";

const greetings = new Set([
    "oi",
    "oii",
    "ola",
    "olaa",
    "bom dia",
    "boa tarde",
    "boa noite",
    "e ai",
    "opa",
    "hello",
]);

export function normalizeMessage(message: string) {
    return message
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

export function classifyMessage(message: string): MessageClassification {
    if (!message) {
        return "desconhecido";
    }

    if (greetings.has(message)) {
        return "saudacao";
    }

    const lettersAndNumbers = message.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
    if (lettersAndNumbers.length < 3) {
        return "desconhecido";
    }

    return "busca";
}
