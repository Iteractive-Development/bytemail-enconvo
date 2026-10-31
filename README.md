# ByteMail for Enconvo

An Enconvo plugin that puts every ByteMail inbox natively into Enconvo. It wraps [ByteMail](https://bytemailapp.com)'s built-in MCP server — 27 mail tools that run on your Mac, across every account ByteMail holds (Gmail, iCloud, Outlook, Microsoft 365, Yahoo, Fastmail, any IMAP server).

Part of the Iteractive Development plugin series (jev-enconvo, 1password-enconvo, …). This is an independent companion plugin: it is not affiliated with, or endorsed by, ByteMail's developers. Your mail never passes through anyone's servers but your own — ByteMail's MCP server runs locally, and this plugin talks to it on this Mac only.

## What it adds

**An MCP server.** Installing the plugin registers ByteMail's MCP server in Enconvo as `bundled:bytemail-enconvo:bytemail`. Agents in Enconvo get all 27 ByteMail tools — search, read, drafts, archive, snooze, rules, unsubscribe and the rest — natively, with ByteMail's own safety instructions attached.

**Six commands.**

| Command | What it does |
|---|---|
| ByteMail Search | Find mail across every shared account (`from:`, `to:`, `subject:`, `file:`, dates) |
| ByteMail Draft | Write a draft from JSON or `to:` / `subject:` lines; it opens in ByteMail to send |
| ByteMail Inbox Triage | Summarize To Reply, Flagged and Snoozed, and propose what to tidy |
| ByteMail Unsubscribe Finder | Rank newsletter senders carrying unsubscribe links |
| ByteMail Follow-ups | Remind you if nobody answers a conversation you sent |
| ByteMail Doctor | Check the app, the MCP server, sharing and tools; print fixes |

**Ten Local API routes**, for agents and workflows:

| Route | Wraps |
|---|---|
| `bytemail-enconvo/status` | health check: app, MCP server, sharing, tool list, accounts |
| `bytemail-enconvo/search_messages` | search_messages |
| `bytemail-enconvo/list_threads` | list_threads |
| `bytemail-enconvo/get_thread` | get_thread |
| `bytemail-enconvo/find_attachments` | find_attachments |
| `bytemail-enconvo/find_contacts` | find_contacts |
| `bytemail-enconvo/create_draft` | create_draft (never sends) |
| `bytemail-enconvo/archive` | archive (max 25 per call) |
| `bytemail-enconvo/snooze` | snooze (max 25 per call) |
| `bytemail-enconvo/mcp_call` | any live ByteMail tool by name, `tools/call` only |

Everything ByteMail can do that has no curated route — send, rules, folders, mute, move, flag, block, drafts management — goes through `bytemail-enconvo/mcp_call` or the MCP tools directly.

## Setup

1. Install [ByteMail](https://bytemailapp.com) and add your accounts. The MCP server is included in every ByteMail plan, the free trial included.
2. In ByteMail, open **Settings › AI**, switch on **Turn on bytemail MCP**, and pick which accounts to share.
3. Install this plugin. The only preference is **ByteMail App Path**, which defaults to `/Applications/ByteMail.app` and covers the commands and routes. (The registered MCP server uses that standard path; if ByteMail lives elsewhere, adjust the preference and reinstall.)

## Safety

The plugin only calls ByteMail's own tools — never your mail servers directly — and ByteMail stays in charge:

- Sending, new rules, removing a label, unsubscribing and blocking ask you in ByteMail first.
- AI apps can never delete your mail, and never see Spam or Trash (they can delete only drafts an AI app wrote).
- Anything touching more than 25 conversations asks first; this plugin's `archive` and `snooze` routes cap batches at 25.
- One-time codes and password-reset links are blanked before any AI app reads a message.
- Every change is listed in ByteMail › Settings › AI › Activity, with Undo.
- Changes wait until ByteMail is open; searching and reading work any time.
- Message content arrives marked as other people's words — data, never instructions.

## Troubleshooting

Run **ByteMail Doctor**.

- **App not found** — install ByteMail, or set the ByteMail App Path preference.
- **"ByteMail isn't sharing mail with AI apps"** — in ByteMail, open Settings › AI and turn on sharing for at least one account.
- **Changes don't happen** — ByteMail has to be open for drafts and changes to be carried out.
- **A send times out** — `send_draft` waits for your approval in ByteMail; raise `timeout_ms` (up to 120000).

## Developing

```sh
npm install --include=dev
npm run build
```

Routes are tested directly:

```sh
curl --noproxy '*' -X POST http://localhost:54535/api/bytemail-enconvo/status -H "Content-Type: application/json" -d '{}'
```

## Publishing

```sh
npm run validate
npx enconvo plugin publish
```

Raise `version` in `package.json` for every update; a published version can't be replaced.

## License

MIT — see [LICENSE](LICENSE). © 2026 [Iteractive Development](https://iteractive.dev).
