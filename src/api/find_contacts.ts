import { appPathOf, callTool, clampInt, errorResponse, pickDefined, readJson, textOf } from "../lib/bridge";

interface FindContactsParams {
    /** Part of a name or address; empty lists the contacts the user writes to most */
    query?: string;
    /** @default 10 Maximum results, 1-50 */
    limit?: number;
    /** @default /Applications/ByteMail.app Path to ByteMail.app */
    appPath?: string;
}

/** Read-only: people in the shared ByteMail accounts' mail whose name or address matches, most-written-to first. Turns a name into an address. @param {Request} request - Request object, body is {@link FindContactsParams} */
export default async function main(request: Request) {
    try {
        const params = await readJson<FindContactsParams>(request);
        const args = pickDefined({
            query: params.query,
            limit: params.limit === undefined ? undefined : clampInt(params.limit, 10, 1, 50),
        });
        const result = await callTool("find_contacts", args, appPathOf(params));
        return Response.json({ ok: true, text: textOf(result), result });
    } catch (error) {
        return errorResponse(error);
    }
}
