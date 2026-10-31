import { appPathOf, callTool, errorResponse, readJson, textOf } from "../lib/bridge";

interface GetThreadParams {
    /** @required Conversation id (thread_id from list_threads or search_messages) */
    thread_id: string;
    /** @default /Applications/ByteMail.app Path to ByteMail.app */
    appPath?: string;
}

/** Read-only: every message of one ByteMail conversation, oldest first, quoted history removed (wraps ByteMail's get_thread tool). @param {Request} request - Request object, body is {@link GetThreadParams} */
export default async function main(request: Request) {
    try {
        const params = await readJson<GetThreadParams>(request);
        if (!params.thread_id || typeof params.thread_id !== "string") {
            return Response.json({ ok: false, error: "thread_id is required" }, { status: 400 });
        }
        const result = await callTool("get_thread", { thread_id: params.thread_id }, appPathOf(params));
        return Response.json({ ok: true, text: textOf(result), result });
    } catch (error) {
        return errorResponse(error);
    }
}
