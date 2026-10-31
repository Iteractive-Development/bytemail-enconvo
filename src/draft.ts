import { EnconvoResponse, type RequestOptions } from "@enconvo/api";
import { appPathOf, callTool, explain, textOf } from "./lib/bridge";

interface Brief {
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    body: string;
}

function splitAddresses(value: string | undefined): string[] | undefined {
    if (!value) return undefined;
    const parts = value.split(/[,;\s]+/).map((part) => part.trim()).filter(Boolean);
    return parts.length ? parts : undefined;
}

/** Accepts JSON {"to":"a@b.c","subject":"...","body":"..."} or lines "to: …", "subject: …", "cc: …", "bcc: …" followed by the body. */
function parseBrief(input: string): Brief {
    const text = input.trim();
    if (text.startsWith("{")) {
        try {
            const parsed = JSON.parse(text) as Record<string, unknown>;
            const to = Array.isArray(parsed.to) ? (parsed.to as string[]) : splitAddresses(typeof parsed.to === "string" ? parsed.to : undefined);
            return {
                to,
                cc: Array.isArray(parsed.cc) ? (parsed.cc as string[]) : splitAddresses(typeof parsed.cc === "string" ? parsed.cc : undefined),
                bcc: Array.isArray(parsed.bcc) ? (parsed.bcc as string[]) : splitAddresses(typeof parsed.bcc === "string" ? parsed.bcc : undefined),
                subject: typeof parsed.subject === "string" ? parsed.subject : undefined,
                body: String(parsed.body ?? parsed.text ?? ""),
            };
        } catch {
            // fall through to line parsing
        }
    }
    const fields: Record<string, string> = {};
    const bodyLines: string[] = [];
    for (const line of text.split("\n")) {
        const match = /^(to|cc|bcc|subject)\s*[:=]\s*(.+)$/i.exec(line.trim());
        if (match && bodyLines.length === 0) {
            fields[match[1].toLowerCase()] = match[2].trim();
            continue;
        }
        bodyLines.push(line);
    }
    return {
        to: splitAddresses(fields.to),
        cc: splitAddresses(fields.cc),
        bcc: splitAddresses(fields.bcc),
        subject: fields.subject,
        body: bodyLines.join("\n").trim(),
    };
}

/** The ByteMail Draft command: write a draft in ByteMail from the text you give. It never sends — the draft opens in ByteMail tagged "Drafted by", for review and sending. */
export default async function main(request: Request) {
    const options = (await request.json()) as RequestOptions;
    const input = String(options.input_text ?? "").trim();
    if (!input) {
        return EnconvoResponse.text('Give me a draft to write. Either JSON: {"to":"a@b.c","subject":"Lunch","body":"Tuesday?"} — or lines:\nto: a@b.c\nsubject: Lunch\nTuesday work for you?');
    }
    const brief = parseBrief(input);
    if (!brief.body) {
        return EnconvoResponse.text("I need a body — the message text itself. Everything else is optional for a reply, but the body is the one thing a draft needs.");
    }
    try {
        const result = await callTool("create_draft", {
            body: brief.body,
            ...(brief.to ? { to: brief.to } : {}),
            ...(brief.cc ? { cc: brief.cc } : {}),
            ...(brief.bcc ? { bcc: brief.bcc } : {}),
            ...(brief.subject ? { subject: brief.subject } : {}),
        }, appPathOf(options as Record<string, unknown>));
        const text = textOf(result);
        return EnconvoResponse.text(text || "Draft written — it is waiting in ByteMail for your review. Nothing was sent.");
    } catch (error) {
        return EnconvoResponse.text(explain(error));
    }
}
