import { EnconvoResponse, type RequestOptions } from "@enconvo/api";
import { appPathOf, callTool, explain, textOf } from "./lib/bridge";

const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;

function senderTally(text: string): string[] {
    const counts = new Map<string, number>();
    for (const match of text.matchAll(EMAIL_PATTERN)) {
        const address = match[0].toLowerCase();
        counts.set(address, (counts.get(address) ?? 0) + 1);
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([address, count]) => `  ${address} — ${count} message${count === 1 ? "" : "s"}`);
}

/** The ByteMail Unsubscribe Finder command: find messages carrying unsubscribe links and rank the senders, so you can pick who to leave. Unsubscribing always asks in ByteMail first. */
export default async function main(request: Request) {
    const options = (await request.json()) as RequestOptions;
    const query = String(options.input_text ?? "").trim() || "unsubscribe";
    try {
        const result = await callTool("search_messages", { query, limit: 50 }, appPathOf(options as Record<string, unknown>));
        const text = textOf(result);
        if (!text) {
            return EnconvoResponse.text(`Nothing with "${query}" came up — that may be every newsletter already dealt with.`);
        }
        const tally = senderTally(text);
        const summary = tally.length ? `MOST FREQUENT SENDERS IN THE MATCHES\n${tally.join("\n")}\n\n` : "";
        return EnconvoResponse.text(
            `${summary}THE MATCHES\n${text}\n\nTo leave a list: name the conversation and run the bytemail-enconvo/mcp_call route with tool "unsubscribe" and its thread_id — ByteMail shows you the request and asks before it sends anything.`,
        );
    } catch (error) {
        return EnconvoResponse.text(explain(error));
    }
}
