import { stat } from "node:fs/promises";
import { readJson, resolveBinary, textOf, withSession, errorResponse, type ToolSummary } from "../lib/bridge";

const SHARING_OFF_MESSAGE = "isn't sharing mail with AI apps";

interface StatusParams {
    /** @default /Applications/ByteMail.app Path to ByteMail.app (the plugin's ByteMail App Path preference) */
    appPath?: string;
}

/** Read-only health check: is ByteMail installed, is its MCP server answering, is mail being shared, and which tools and accounts are live. Body is {@link StatusParams}. @param {Request} request - Request object, body is {@link StatusParams} */
export default async function main(request: Request) {
    const params = await readJson<StatusParams>(request);
    const binary = resolveBinary(params.appPath);
    let installed = false;
    try {
        await stat(binary);
        installed = true;
    } catch {}
    if (!installed) {
        return Response.json({
            ok: false,
            installed: false,
            binary,
            error: `ByteMail was not found at ${binary}.`,
            hint: "Install ByteMail from bytemailapp.com, or set the plugin's ByteMail App Path preference to where it lives.",
        });
    }
    try {
        return await withSession(params.appPath, async (session) => {
            const listing = await session.call("tools/list", {}, 15000);
            const tools: ToolSummary[] = listing?.tools ?? [];
            const accountsCall = await session.call("tools/call", { name: "list_accounts", arguments: {} }, 20000);
            const accountsText = textOf(accountsCall);
            const sharing = !accountsText.includes(SHARING_OFF_MESSAGE);
            const server = (session.serverInfo ?? {}) as Record<string, unknown>;
            return Response.json({
                ok: true,
                installed: true,
                binary,
                server: { name: server.name, title: server.title, version: server.version },
                sharing,
                toolCount: tools.length,
                tools: tools.map((tool) => tool.name),
                accounts: sharing ? accountsText : undefined,
                error: sharing ? undefined : "ByteMail isn't sharing mail with AI apps yet.",
                hint: sharing ? undefined : "In ByteMail, open Settings › AI and turn on sharing for at least one account.",
            });
        });
    } catch (error) {
        return errorResponse(error);
    }
}
