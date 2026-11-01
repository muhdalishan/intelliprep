# Automation (n8n)

Export each n8n workflow as JSON into `n8n/` so it is versioned with the code.

The backend triggers workflows through webhooks (backlog IP-110, IP-111). Webhook URLs and the
Telegram bot token are secrets: keep them in n8n credentials and the backend `.env`, never in the
exported JSON.
