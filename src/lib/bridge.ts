import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

export const DEFAULT_APP_PATH = "/Applications/ByteMail.app";
const PROTOCOL_VERSION = "2025-06-18";
const CLIENT_INFO = { name: "bytemail-enconvo", version: "1.0.0" };
const SHARING_OFF_MESSAGE = "isn't sharing mail with AI apps";

export type ErrorCode = "BAD_INPUT" | "APP_MISSING" | "SHARING_OFF" | "MCP_ERROR" | "TIMEOUT" | "TOOL_ERROR";

const HINTS: Record<ErrorCode, string | undefined> = {
    BAD_INPUT: undefined,
    APP_MISSING: "Install ByteMail from bytemailapp.com, or set the plugin's ByteMail App Path preference to where it lives.",
    SHARING_OFF: "In ByteMail, open Settings › AI and turn on sharing for at least one account.",
    MCP_ERROR: "Open ByteMail and check Settings › AI — the MCP switch and account sharing both have to be on.",
    TIMEOUT: "ByteMail did not answer in time. If you were approving a send in ByteMail, retry with a higher timeout_ms.",
    TOOL_ERROR: undefined,
};

export class ByteMailError extends Error {
    readonly code: ErrorCode;
    readonly detail?: string;
    readonly hint?: string;

    constructor(code: ErrorCode, message: string, detail?: string) {
        super(message);
        this.name = "ByteMailError";
        this.code = code;
        this.detail = detail;
        this.hint = HINTS[code];
    }
}

/** Turns the App Path preference (or any user input) into the binary inside the app bundle. */
export function resolveBinary(appPath?: unknown): string {
    const raw = typeof appPath === "string" && appPath.trim() ? appPath.trim() : DEFAULT_APP_PATH;
    if (raw.includes("/Contents/MacOS/")) return raw;
    const root = raw.replace(/\/+$/, "");
    const name = (root.split("/").pop() || "ByteMail").replace(/\.app$/i, "");
    return root + "/Contents/MacOS/" + name;
}

interface PendingCall {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timer: NodeJS.Timeout;
}

export interface Session {
    /** The initialize reply from ByteMail's MCP server (serverInfo, protocolVersion). */
    serverInfo?: Record<string, unknown>;
    call(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<any>;
    close(): void;
}

function appMissing(binary: string, error: unknown): ByteMailError {
    return new ByteMailError("APP_MISSING", `ByteMail was not found at ${binary}.`, String(error));
}

/** Opens one short-lived stdio MCP session: spawns `ByteMail --mcp` and completes the initialize handshake. */
export function openSession(appPath?: unknown, defaultTimeoutMs = 30000): Promise<Session> {
    return new Promise<Session>((resolve, reject) => {
        const binary = resolveBinary(appPath);
        let child: ChildProcess;
        try {
            child = spawn(binary, ["--mcp"], { stdio: ["pipe", "pipe", "pipe"] });
        } catch (error) {
            reject(appMissing(binary, error));
            return;
        }

        const pending = new Map<number, PendingCall>();
        let stderrTail = "";
        let closed = false;

        const failAll = (error: ByteMailError) => {
            for (const pendingCall of pending.values()) {
                clearTimeout(pendingCall.timer);
                pendingCall.reject(error);
            }
            pending.clear();
        };

        child.on("error", (error: NodeJS.ErrnoException) => {
            closed = true;
            const failure = appMissing(binary, error);
            failAll(failure);
            reject(failure);
        });
        child.stderr?.on("data", (chunk) => {
            stderrTail = (stderrTail + String(chunk)).slice(-800);
        });
        child.on("exit", (code) => {
            closed = true;
            failAll(new ByteMailError("MCP_ERROR", `The ByteMail MCP server exited (code ${code ?? "?"}).`, stderrTail));
        });

        const reader = createInterface({ input: child.stdout! });
        reader.on("line", (line) => {
            if (!line.trim()) return;
            let message: any;
            try {
                message = JSON.parse(line);
            } catch {
                return;
            }
            // Server notifications carry no id and get no reply.
            if (message.id === undefined || message.id === null) return;
            const pendingCall = pending.get(message.id);
            if (!pendingCall) return;
            pending.delete(message.id);
            clearTimeout(pendingCall.timer);
            if (message.error) {
                pendingCall.reject(new ByteMailError("MCP_ERROR", String(message.error.message ?? "ByteMail MCP error"), JSON.stringify(message.error.data ?? "")));
            } else {
                pendingCall.resolve(message.result);
            }
        });

        let nextId = 1;
        const session: Session = {
            call(method, params, timeoutMs) {
                return new Promise((resolveCall, rejectCall) => {
                    if (closed) {
                        rejectCall(new ByteMailError("MCP_ERROR", "The ByteMail MCP server is not running.", stderrTail));
                        return;
                    }
                    const id = nextId++;
                    const timer = setTimeout(() => {
                        pending.delete(id);
                        session.close();
                        rejectCall(new ByteMailError("TIMEOUT", `ByteMail did not answer "${method}" in time.`, stderrTail));
                    }, timeoutMs ?? defaultTimeoutMs);
                    pending.set(id, { resolve: resolveCall, reject: rejectCall, timer });
                    try {
                        child.stdin?.write(JSON.stringify({ jsonrpc: "2.0", id, method, params: params ?? {} }) + "\n");
                    } catch (error) {
                        clearTimeout(timer);
                        pending.delete(id);
                        rejectCall(new ByteMailError("MCP_ERROR", "Could not write to the ByteMail MCP server.", String(error)));
                    }
                });
            },
            close() {
                closed = true;
                try { child.stdin?.end(); } catch {}
                try { child.kill(); } catch {}
            },
        };

        session.call("initialize", { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: CLIENT_INFO }, 15000)
            .then((result) => {
                session.serverInfo = result?.serverInfo;
                try {
                    child.stdin?.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
                } catch {}
                resolve(session);
            })
            .catch((error) => {
                session.close();
                reject(error);
            });
    });
}

/** Runs `use` inside one ByteMail MCP session, closing the server process afterwards. */
export async function withSession<T>(appPath: unknown, use: (session: Session) => Promise<T>, defaultTimeoutMs = 30000): Promise<T> {
    const session = await openSession(appPath, defaultTimeoutMs);
    try {
        return await use(session);
    } finally {
        session.close();
    }
}

export interface ToolSummary {
    name: string;
    title?: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
    annotations?: Record<string, unknown>;
}

export interface ToolResult {
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
    [key: string]: unknown;
}

export async function listTools(appPath?: unknown, timeoutMs = 15000): Promise<ToolSummary[]> {
    const result = await withSession(appPath, (session) => session.call("tools/list", {}, timeoutMs));
    return (result?.tools ?? []) as ToolSummary[];
}

function sharingOffError(): ByteMailError {
    return new ByteMailError("SHARING_OFF", "ByteMail isn't sharing mail with AI apps yet.");
}

/** Raises the two tool-level failures worth their own code; a plain tool error keeps ByteMail's words. */
function checkToolResult(result: ToolResult, tool: string): void {
    const text = textOf(result);
    if (text.includes(SHARING_OFF_MESSAGE)) throw sharingOffError();
    if (result?.isError) throw new ByteMailError("TOOL_ERROR", text || `The ByteMail tool "${tool}" failed.`);
}

/** One-shot helper: initialize, call one ByteMail tool, close. */
export async function callTool(name: string, args: Record<string, unknown> | undefined, appPath?: unknown, timeoutMs = 30000): Promise<ToolResult> {
    return withSession(appPath, async (session) => {
        const result: ToolResult = await session.call("tools/call", { name, arguments: args ?? {} }, timeoutMs);
        checkToolResult(result, name);
        return result;
    });
}

export function textOf(result: ToolResult | undefined | null): string {
    const parts = (result?.content ?? [])
        .filter((part) => part?.type === "text")
        .map((part) => String(part.text ?? ""));
    return parts.join("\n").trim();
}

/** Parses the request body, failing bad JSON as BAD_INPUT instead of a 500. */
export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
    try {
        return (await request.json()) as T;
    } catch {
        throw new ByteMailError("BAD_INPUT", "The request body is not valid JSON.");
    }
}

/** A failed route call: 400s for input, 409 sharing, 504 timeout, 500 app missing, 502 for ByteMail's own answers. */
export function errorResponse(error: unknown): Response {
    if (error instanceof ByteMailError) {
        const status = error.code === "BAD_INPUT" ? 400 : error.code === "TIMEOUT" ? 504 : error.code === "APP_MISSING" ? 500 : error.code === "SHARING_OFF" ? 409 : 502;
        return Response.json({ ok: false, code: error.code, error: error.message, hint: error.hint, detail: error.detail }, { status });
    }
    return Response.json({ ok: false, code: "UNEXPECTED", error: error instanceof Error ? error.message : String(error) }, { status: 500 });
}

/** Human-readable one-liner set for commands. */
export function explain(error: unknown): string {
    if (error instanceof ByteMailError) {
        return error.hint ? `${error.message}\n${error.hint}` : error.message;
    }
    return error instanceof Error ? error.message : String(error);
}

export function pickDefined(source: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(source)) {
        if (value !== undefined) out[key] = value;
    }
    return out;
}

export function clampInt(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function appPathOf(options: unknown): string | undefined {
    const value = (options as any)?.appPath;
    return typeof value === "string" && value.trim() ? value : undefined;
}
