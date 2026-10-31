import { appPathOf, callTool, clampInt, errorResponse, pickDefined, readJson, textOf } from "../lib/bridge";

interface FindAttachmentsParams {
    /** Words that must all match */
    query?: string;
    /** Alternative words: a message matching any one counts, e.g. ["invoice", "receipt", "bill"] */
    any_of?: string[];
    /** @default any pdf, image, spreadsheet, document, archive, or any */
    kind?: "pdf" | "image" | "spreadsheet" | "document" | "archive" | "any";
    /** Part of the file name */
    file_name?: string;
    /** Sender filter */
    from?: string;
    /** Only on or after this day, YYYY-MM-DD (inclusive) */
    after?: string;
    /** Only before this day, YYYY-MM-DD (exclusive) */
    before?: string;
    /** Account email address (see bytemail/status); omit for every account */
    account?: string;
    /** @default 20 Files to list, 1-50 */
    limit?: number;
    /** @default 5 How many files to include themselves, 1-10 (at most 25 MB in all) */
    max_files?: number;
    /** @default true Include the files themselves */
    include_files?: boolean;
    /** @default true Also search older mail on the mail servers */
    search_server?: boolean;
    /** @default /Applications/ByteMail.app Path to ByteMail.app */
    appPath?: string;
}

/** Read-only: find files attached to mail, on this Mac and on the mail servers, newest first (wraps ByteMail's find_attachments tool). @param {Request} request - Request object, body is {@link FindAttachmentsParams} */
export default async function main(request: Request) {
    try {
        const params = await readJson<FindAttachmentsParams>(request);
        const hasFilter = [params.query, params.any_of, params.file_name, params.from, params.after, params.before, params.account].some((value) => value !== undefined);
        if (!hasFilter) {
            return Response.json({ ok: false, error: "Give at least one filter: query, any_of, file_name, from, after or before." }, { status: 400 });
        }
        const args = pickDefined({
            query: params.query,
            any_of: params.any_of,
            kind: params.kind,
            file_name: params.file_name,
            from: params.from,
            after: params.after,
            before: params.before,
            account: params.account,
            limit: params.limit === undefined ? undefined : clampInt(params.limit, 20, 1, 50),
            max_files: params.max_files === undefined ? undefined : clampInt(params.max_files, 5, 1, 10),
            include_files: params.include_files,
            search_server: params.search_server,
        });
        const result = await callTool("find_attachments", args, appPathOf(params));
        return Response.json({ ok: true, text: textOf(result), result });
    } catch (error) {
        return errorResponse(error);
    }
}
