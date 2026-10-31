import { appPathOf, callTool, clampInt, errorResponse, pickDefined, readJson, textOf } from "../lib/bridge";

interface SearchParams {
    /** Query: words (prefix match) and ByteMail operators like from:, to:, subject:, file: */
    query?: string;
    /** Sender filter, address or name */
    from?: string;
    /** Recipient filter, address or name */
    to?: string;
    /** Subject words */
    subject?: string;
    /** @default 20 Maximum results, 1-50 */
    limit?: number;
    /** Only messages on or after this day, YYYY-MM-DD (inclusive) */
    after?: string;
    /** Only messages before this day, YYYY-MM-DD (exclusive) */
    before?: string;
    /** Account email address (see bytemail/status); omit for every account */
    account?: string;
    /** inbox, sent, archive, or a folder name */
    folder?: string;
    /** Only messages with an attachment */
    has_attachment?: boolean;
    /** Only unread messages */
    unread?: boolean;
    /** @default true Also search older mail on the mail servers */
    search_server?: boolean;
    /** @default /Applications/ByteMail.app Path to ByteMail.app */
    appPath?: string;
}

/** Read-only: find messages across every shared ByteMail account, wrapping ByteMail's search_messages tool. All given filters must match. @param {Request} request - Request object, body is {@link SearchParams} */
export default async function main(request: Request) {
    try {
        const params = await readJson<SearchParams>(request);
        const args = pickDefined({
            query: params.query,
            from: params.from,
            to: params.to,
            subject: params.subject,
            limit: params.limit === undefined ? undefined : clampInt(params.limit, 20, 1, 50),
            after: params.after,
            before: params.before,
            account: params.account,
            folder: params.folder,
            has_attachment: params.has_attachment,
            unread: params.unread,
            search_server: params.search_server,
        });
        const result = await callTool("search_messages", args, appPathOf(params));
        return Response.json({ ok: true, text: textOf(result), result });
    } catch (error) {
        return errorResponse(error);
    }
}
