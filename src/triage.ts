import { EnconvoResponse, type RequestOptions } from "@enconvo/api";
import { appPathOf, explain, textOf, withSession } from "./lib/bridge";

const SHARING_OFF_MESSAGE = "isn't sharing mail with AI apps";

function sharingText(): string {
    return "ByteMail isn't sharing mail with AI apps yet.\nIn ByteMail, open Settings › AI and turn on sharing for at least one account.";
}

/** The ByteMail Inbox Triage command: what is waiting — To Reply, Flagged, Snoozed — plus a proposed plan. It only proposes; nothing changes until you say so. */
export default async function main(request: Request) {
    const options = (await request.json()) as RequestOptions;
    try {
        const report = await withSession(appPathOf(options as Record<string, unknown>), async (session) => {
            const parts: string[] = [];
            for (const mailbox of ["to_reply", "flagged", "snoozed"] as const) {
                const result = await session.call("tools/call", { name: "list_threads", arguments: { mailbox, limit: 8 } }, 20000);
                const text = textOf(result);
                if (text.includes(SHARING_OFF_MESSAGE)) return sharingText();
                const header = mailbox === "to_reply" ? "TO REPLY — waiting for your answer" : mailbox === "flagged" ? "FLAGGED" : "SNOOZED";
                parts.push(`${header}\n${text || "(nothing)"}`);
            }
            return parts.join("\n\n");
        });
        const tail = report === sharingText() ? "" : "\n\nNext step: reply to what matters, then say which conversations to archive, snooze or mark done — changes run in batches of at most 25, and everything is undoable in ByteMail › Settings › AI › Activity.";
        return EnconvoResponse.text(report + tail);
    } catch (error) {
        return EnconvoResponse.text(explain(error));
    }
}
