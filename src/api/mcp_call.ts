import { ByteMailError, clampInt, errorResponse, readJson, textOf, withSession, type ToolResult, type ToolSummary } from "../lib/bridge";

const SHARING_OFF_MESSAGE = "isn't sharing mail with AI apps";

interface McpCallParams {
    /** @required A live ByteMail MCP tool name, e.g. send_draft, update_draft, delete_draft, list_drafts, list_rules, create_rule, create_folder, remove_label, unsubscribe, block_sender, mute, mark_done, move, mark_read, flag, remind_if_no_reply, get_message, get_attachment. The live list is in bytemail/status. */
    tool: string;
    /** Arguments matching the tool's input schema (see bytemail/status for the live list) */
    arguments?: Record<string, unknown>;
    /** @default 30000 Timeout in ms. send_draft waits for the user's approval in ByteMail — raise it when sending. */
    timeout_ms?: number;
    /** @default /Applications/ByteMail.app Path to ByteMail.app */
    appPath?: string;
}

/** Run any live ByteMail MCP tool by name — tools/call only, never raw RPC; the name must match ByteMail's own tools/list. ByteMail's in-app approvals still apply: send, rules, label removal, unsubscribe and block ask the user first. @param {Request} request - Request object, body is {@link McpCallParams} */
export default async function main(request: Request) {
    try {
        const params = await readJson<McpCallParams>(request);
        if (!params.tool || typeof params.tool !== "string") {
            return Response.json({ ok: false, error: "tool is required (a ByteMail MCP tool name, see bytemail/status)" }, { status: 400 });
        }
        if (params.arguments !== undefined && (typeof params.arguments !== "object" || params.arguments === null || Array.isArray(params.arguments))) {
            return Response.json({ ok: false, error: "arguments has to be an object matching the tool's input schema" }, { status: 400 });
        }
        const timeoutMs = clampInt(params.timeout_ms, 30000, 5000, 120000);
        return await withSession(params.appPath, async (session) => {
            const listing = await session.call("tools/list", {}, 15000);
            const tools: ToolSummary[] = listing?.tools ?? [];
            const tool = tools.find((candidate) => candidate.name === params.tool);
            if (!tool) {
                return Response.json({
                    ok: false,
                    error: `ByteMail has no tool named "${params.tool}".`,
                    available: tools.map((candidate) => candidate.name),
                }, { status: 400 });
            }
            const result: ToolResult = await session.call("tools/call", { name: params.tool, arguments: params.arguments ?? {} }, timeoutMs);
            const text = textOf(result);
            if (text.includes(SHARING_OFF_MESSAGE)) {
                return Response.json({ ok: false, code: "SHARING_OFF", error: text, hint: "In ByteMail, open Settings › AI and turn on sharing for at least one account." }, { status: 409 });
            }
            if (result?.isError) throw new ByteMailError("TOOL_ERROR", text || `The ByteMail tool "${params.tool}" failed.`);
            return Response.json({ ok: true, tool: params.tool, text, result });
        });
    } catch (error) {
        return errorResponse(error);
    }
}
