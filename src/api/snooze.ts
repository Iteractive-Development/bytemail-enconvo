import { appPathOf, callTool, errorResponse, readJson, textOf } from "../lib/bridge";

const MAX_BATCH = 25;

interface SnoozeParams {
    /** @required Conversation ids (thread_id values from list_threads or search_messages), at most 25 */
    thread_ids: string[];
    /** @required When they come back: ISO 8601 date-time, or YYYY-MM-DD (08:00 that day) */
    until: string;
    /** @default /Applications/ByteMail.app Path to ByteMail.app */
    appPath?: string;
}

/** Snooze conversations in ByteMail until a moment, when they come back to the inbox as new. At most 25 per call. @param {Request} request - Request object, body is {@link SnoozeParams} */
export default async function main(request: Request) {
    try {
        const params = await readJson<SnoozeParams>(request);
        if (!Array.isArray(params.thread_ids) || params.thread_ids.length === 0) {
            return Response.json({ ok: false, error: "thread_ids has to be a non-empty array of conversation ids" }, { status: 400 });
        }
        if (!params.until || typeof params.until !== "string") {
            return Response.json({ ok: false, error: "until is required (ISO 8601 date-time, or YYYY-MM-DD)" }, { status: 400 });
        }
        if (params.thread_ids.length > MAX_BATCH) {
            return Response.json({
                ok: false,
                error: `At most ${MAX_BATCH} conversations per call. ByteMail asks the user about anything bigger, so split the batch.`,
                received: params.thread_ids.length,
            }, { status: 400 });
        }
        const result = await callTool("snooze", { thread_ids: params.thread_ids, until: params.until }, appPathOf(params));
        return Response.json({ ok: true, snoozed: params.thread_ids.length, until: params.until, text: textOf(result), result });
    } catch (error) {
        return errorResponse(error);
    }
}
