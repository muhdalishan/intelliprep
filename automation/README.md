# Automation (n8n)

Export each n8n workflow as JSON into `n8n/` so it is versioned with the code.

The backend triggers workflows through webhooks (backlog IP-110, IP-111). Webhook URLs and the
Telegram bot token are secrets: keep them in n8n credentials and the backend `.env`, never in the
exported JSON.

## Who does what

The **backend decides** which reminders are due (the scheduler in
`backend/app/modules/notifications/scheduler.py` runs every minute) and keeps the record of every
attempt. **n8n only delivers** the message. If a flow breaks, the backend retries after 1, 5 and
15 minutes, then marks the reminder failed with the reason; nothing is lost or sent twice.

## Backend settings (`backend/.env`)

| Variable | What it is |
|---|---|
| `N8N_WEBHOOK_URL` | The production URL of the "Reminders" workflow's Webhook node |
| `N8N_WEBHOOK_SECRET` | A long random string, also stored in n8n; signs requests both ways |
| `TELEGRAM_BOT_USERNAME` | The bot's username without `@`, e.g. `IntelliPrepBot` |

With `N8N_WEBHOOK_URL` set, email reminders become available; with the bot username too,
Telegram does. Until then the app shows them as "not set up on this server yet".

## Workflow 1: "Reminders" (backend → n8n → student)

1. **Webhook** node, `POST`, respond "when last node finishes".
2. **Verify signature** (Code node): compute `HMAC-SHA256(N8N_WEBHOOK_SECRET, raw body)` as hex
   and compare it to the `X-IntelliPrep-Signature` header. Stop with HTTP 401 if they differ.
3. **Switch** on `channel`:
   - `telegram` → **Telegram** node, *Send Message*, chat id `{{$json.telegram_chat_id}}`,
     text `{{$json.text}}`.
   - `email` → **Send Email** node (SMTP credential), to `{{$json.email}}`,
     subject "IntelliPrep reminder", body `{{$json.text}}`.
4. **Respond to Webhook**: 200 when sent. Answer 5xx if the send failed for a temporary reason
   (the backend retries), 4xx if it can never work (the backend marks it failed).

Request body the backend sends:

```json
{
  "event": "reminder",
  "reminder_id": "6f1c…",
  "channel": "telegram",
  "text": "⏰ Data Structures: Mock test at 8",
  "telegram_chat_id": 555123,
  "email": null
}
```

## Workflow 2: "Telegram link" (student → bot → n8n → backend)

Settings → Notifications → **Connect Telegram** opens `https://t.me/<bot>?start=<code>`. The
code is sealed by the server and expires after 15 minutes.

1. **Telegram Trigger** on messages to the bot.
2. **IF** the text starts with `/start `: take the code after it, and the chat id from
   `message.chat.id`.
3. **HTTP Request** `POST {backend}/api/notifications/telegram/connect` with body
   `{"code": "<code>", "chat_id": <chat id>}` and header `X-IntelliPrep-Signature` set to
   `HMAC-SHA256(N8N_WEBHOOK_SECRET, body)` as hex (compute it in a Code node first).
4. Reply in Telegram: "Connected. Your IntelliPrep reminders will arrive here."

Only the server can save a chat id on a profile (students can't set it themselves), so nobody
can send their reminders to someone else's Telegram.

## Not built yet

- Daily digest (IP-111): a cron in the backend that sends one message per student with cards due.
- WhatsApp and SMS: possible later as extra branches of the Switch in Workflow 1 (both are paid
  per message and need business registration).
