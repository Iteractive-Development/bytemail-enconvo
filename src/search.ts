import { EnconvoResponse, type RequestOptions } from "@enconvo/api";
import { appPathOf, callTool, explain, textOf } from "./lib/bridge";

/** The ByteMail Search command: find mail across every shared ByteMail account. */
export default async function main(request: Request) {
    const options = (await request.json()) as RequestOptions;
    const query = String(options.input_text ?? "").trim();
    if (!query) {
        return EnconvoResponse.text("Type what to look for. Words, plus ByteMail operators: from: to: subject: file: after: — for example:  invoices from:stripe after:2026-10-01");
    }
    try {
        const result = await callTool("search_messages", { query, limit: 10 }, appPathOf(options as Record<string, unknown>));
        const text = textOf(result);
        return EnconvoResponse.text(text || `Nothing found for “${query}”.`);
    } catch (error) {
        return EnconvoResponse.text(explain(error));
    }
}
