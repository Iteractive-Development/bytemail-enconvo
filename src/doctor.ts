import { stat } from "node:fs/promises";
import { EnconvoResponse, type RequestOptions } from "@enconvo/api";
import { DEFAULT_APP_PATH, appPathOf, explain, resolveBinary, textOf, withSession, type ToolSummary } from "./lib/bridge";

const SHARING_OFF_MESSAGE = "isn't sharing mail with AI apps";

/** The ByteMail Doctor command: checks the ByteMail app, its MCP server, account sharing and tools, and prints what to fix when something is off. */
export default async function main(request: Request) {
    const options = (await request.json()) as RequestOptions;
    const appPath = appPathOf(options as Record<string, unknown>);
    const binary = resolveBinary(appPath);
    const lines: string[] = ["ByteMail Doctor", ""];

    let installed = false;
    try {
        await stat(binary);
        installed = true;
    } catch {}
    lines.push(installed ? `✓ ByteMail app found at ${binary}` : `✗ ByteMail was not found at ${binary}\n  Fix: install ByteMail from bytemailapp.com, or set the ByteMail App Path preference${appPath ? "" : ` (currently the default, ${DEFAULT_APP_PATH})`} to where it lives.`);

    if (!installed) {
        return EnconvoResponse.text(lines.join("\n"));
    }

    try {
        const report = await withSession(appPath, async (session) => {
            const listing = await session.call("tools/list", {}, 15000);
            const tools: ToolSummary[] = listing?.tools ?? [];
            const server = (session.serverInfo ?? {}) as Record<string, unknown>;
            lines.push(`✓ MCP server answering — ${String(server.title ?? "ByteMail")} ${String(server.version ?? "?")}, ${tools.length} tools`);
            const accountsCall = await session.call("tools/call", { name: "list_accounts", arguments: {} }, 20000);
            const accountsText = textOf(accountsCall);
            if (accountsText.includes(SHARING_OFF_MESSAGE)) {
                lines.push("✗ Account sharing is off\n  Fix: in ByteMail, open Settings › AI and turn on sharing for at least one account.");
            } else {
                lines.push(`✓ Mail is being shared\n${accountsText}`);
            }
            return lines.join("\n");
        });
        return EnconvoResponse.text(`${report}\n\nTry “ByteMail Search” with a query, or point any agent at the bytemail-enconvo/status route.`);
    } catch (error) {
        lines.push(`✗ ByteMail's MCP server did not answer\n  ${explain(error)}`);
        return EnconvoResponse.text(lines.join("\n"));
    }
}
