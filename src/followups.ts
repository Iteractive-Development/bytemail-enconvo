import { EnconvoResponse, type RequestOptions } from "@enconvo/api";
import { appPathOf, callTool, explain, textOf } from "./lib/bridge";

function defaultDay(): string {
    const then = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return then.toLocaleDateString("en-CA"); // local YYYY-MM-DD, not UTC
}

/** The ByteMail Follow-ups command: remind yourself if nobody answers a conversation you sent. Input "query | YYYY-MM-DD" lists matching sent conversations; input with a thread_id ("thread_id: … | YYYY-MM-DD", date optional, default three days out) sets the reminder. */
export default async function main(request: Request) {
    const options = (await request.json()) as RequestOptions;
    const input = String(options.input_text ?? "").trim();
    if (!input) {
        return EnconvoResponse.text("Give me a sent conversation to watch, for example:\n  print run | 2026-11-05     (list matches; date optional)\n  thread_id: <id> | 2026-11-05   (set the reminder, default three days out)");
    }
    const [left, right] = input.split("|").map((part) => part.trim());
    const at = right || defaultDay();
    const threadMatch = /thread_id\s*[:=]\s*(\S+)/i.exec(left);
    try {
        if (threadMatch) {
            const result = await callTool("remind_if_no_reply", { thread_ids: [threadMatch[1]], at }, appPathOf(options as Record<string, unknown>));
            return EnconvoResponse.text(textOf(result) || `Reminder set: if nobody answers by ${at}, the conversation comes back to the top of your inbox.`);
        }
        const result = await callTool("search_messages", { query: left, folder: "sent", limit: 5 }, appPathOf(options as Record<string, unknown>));
        const text = textOf(result);
        if (!text) {
            return EnconvoResponse.text(`Nothing sent matches “${left}”.`);
        }
        return EnconvoResponse.text(`MATCHING SENT CONVERSATIONS\n${text}\n\nTo watch one, run this again with its id:\n  thread_id: <id> | ${at}`);
    } catch (error) {
        return EnconvoResponse.text(explain(error));
    }
}
