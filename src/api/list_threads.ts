import { appPathOf, callTool, clampInt, errorResponse, pickDefined, readJson, textOf } from "../lib/bridge";

interface ListThreadsParams {
    /** @default inbox inbox, to_reply (waiting for your answer), flagged, snoozed, sent, archive, or a folder name */
    mailbox?: string;
    /** @default 25 Maximum conversations, 1-100 */
    limit?: number;
    /** Account email address (see bytemail/status); omit for every account */
    account?: string;
    /** Only conversations with unread messages */
    unread_only?: boolean;
    /** Inbox only: one of its tabs, Primary, Updates, Promos or a tab the user made */
    tab?: string;
    /** @default /Applications/ByteMail.app Path to ByteMail.app */
    appPath?: string;
}

/** Read-only: conversations in a ByteMail mailbox, newest first (wraps ByteMail's list_threads tool). @param {Request} request - Request object, body is {@link ListThreadsParams} */
export default async function main(request: Request) {
    try {
        const params = await readJson<ListThreadsParams>(request);
        const args = pickDefined({
            mailbox: params.mailbox,
            limit: params.limit === undefined ? undefined : clampInt(params.limit, 25, 1, 100),
            account: params.account,
            unread_only: params.unread_only,
            tab: params.tab,
        });
        const result = await callTool("list_threads", args, appPathOf(params));
        return Response.json({ ok: true, text: textOf(result), result });
    } catch (error) {
        return errorResponse(error);
    }
}
