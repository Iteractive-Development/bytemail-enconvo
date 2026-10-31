import { appPathOf, callTool, clampInt, errorResponse, pickDefined, readJson, textOf } from "../lib/bridge";

interface CreateDraftParams {
    /** @required Plain text body, without signature or quoted history */
    body: string;
    /** Recipient addresses (new messages) */
    to?: string[];
    /** Subject (new messages) */
    subject?: string;
    /** CC addresses */
    cc?: string[];
    /** BCC addresses */
    bcc?: string[];
    /** Account email to send from (new messages) */
    account?: string;
    /** Send-from address: the account's own or one of its aliases */
    from?: string;
    /** Paths of files on this Mac to attach (files in the home folder, or ones ByteMail's get_attachment saved) */
    attachments?: string[];
    /** Reply: recipients, subject, quote and signature are filled in from this message */
    reply_to_message_id?: string;
    /** Reply to all recipients */
    reply_all?: boolean;
    /** Forward this message */
    forward_message_id?: string;
    /** @default 30000 Timeout in ms */
    timeout_ms?: number;
    /** @default /Applications/ByteMail.app Path to ByteMail.app */
    appPath?: string;
}

/** Write a draft in ByteMail for the user to review and send. It never sends: the draft opens in ByteMail tagged "Drafted by". To send, use bytemail/mcp_call with tool "send_draft" — ByteMail asks the user first. @param {Request} request - Request object, body is {@link CreateDraftParams} */
export default async function main(request: Request) {
    try {
        const params = await readJson<CreateDraftParams>(request);
        if (!params.body || typeof params.body !== "string") {
            return Response.json({ ok: false, error: "body is required (plain text, without signature or quoted history)" }, { status: 400 });
        }
        const args = pickDefined({
            body: params.body,
            to: params.to,
            subject: params.subject,
            cc: params.cc,
            bcc: params.bcc,
            account: params.account,
            from: params.from,
            attachments: params.attachments,
            reply_to_message_id: params.reply_to_message_id,
            reply_all: params.reply_all,
            forward_message_id: params.forward_message_id,
        });
        const timeoutMs = clampInt(params.timeout_ms, 30000, 5000, 120000);
        const result = await callTool("create_draft", args, appPathOf(params), timeoutMs);
        return Response.json({ ok: true, text: textOf(result), result });
    } catch (error) {
        return errorResponse(error);
    }
}
