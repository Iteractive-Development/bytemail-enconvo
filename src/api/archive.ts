import { appPathOf, callTool, errorResponse, readJson, textOf } from "../lib/bridge";

const MAX_BATCH = 25;

interface ArchiveParams {
    /** @required Conversation ids (thread_id values from list_threads or search_messages), at most 25 */
    thread_ids: string[];
    /** @default /Applications/ByteMail.app Path to ByteMail.app */
    appPath?: string;
}

/** Archive conversations in ByteMail. At most 25 per call: ByteMail asks the user about anything bigger, so split large batches. @param {Request} request - Request object, body is {@link ArchiveParams} */
export default async function main(request: Request) {
    try {
        const params = await readJson<ArchiveParams>(request);
        if (!Array.isArray(params.thread_ids) || params.thread_ids.length === 0) {
            return Response.json({ ok: false, error: "thread_ids has to be a non-empty array of conversation ids" }, { status: 400 });
        }
        if (params.thread_ids.length > MAX_BATCH) {
            return Response.json({
                ok: false,
                error: `At most ${MAX_BATCH} conversations per call. ByteMail asks the user about anything bigger, so split the batch.`,
                received: params.thread_ids.length,
            }, { status: 400 });
        }
        const result = await callTool("archive", { thread_ids: params.thread_ids }, appPathOf(params));
        return Response.json({ ok: true, archived: params.thread_ids.length, text: textOf(result), result });
    } catch (error) {
        return errorResponse(error);
    }
}
