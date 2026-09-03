# 7Key n8n Automation Pack

This folder turns n8n into the automation engine behind the 7Key Prospecting CRM.

## Workflows

### 1. Prospect Intake & Personalization
Webhook:
`POST /webhook/7key/prospect`

Input example:
```json
{
  "id": "lead-123",
  "company": "Example Roofing",
  "niche": "Roofing",
  "country": "USA",
  "email": "owner@example.com",
  "website": "",
  "issue": "No dedicated website found"
}
```

Returns a personalized subject + email message with `approval_status: pending`.

### 2. Approved Gmail Sender
Webhook:
`POST /webhook/7key/send-approved`

It only sends when:
- `approved` is `true`
- an email address exists

Connect the Gmail node to the 7KeySolutions Gmail account in n8n before activating.

### 3. Reply Monitor
Runs every 30 minutes, reads unread Gmail messages and classifies:
- `interested`
- `replied`
- `opt_out`

Every detected reply has `stop_followups: true`.

## Recommended safe operating rules

- Start with 5-10 highly qualified emails/day.
- Never send to purchased bulk lists.
- Use business relevance and personalization.
- Stop all follow-ups after a reply.
- Stop immediately for opt-out / do-not-contact.
- Keep initial emails short, plain, and attachment-free.
- Do not add more than one link in a cold first email.
- Increase volume slowly only if deliverability stays healthy.

## Local n8n

```bash
cd n8n
cp .env.example .env
docker compose up -d
```

Open:
`http://localhost:5678`

Import the three JSON files in `n8n/workflows/`.

## What still requires your credentials

I cannot embed account secrets inside the project. In n8n, connect:
1. Gmail OAuth credential.
2. Later: Supabase/Postgres if you want persistent server-side CRM data.
3. Optional AI provider credential if you want LLM-written outreach instead of the included deterministic personalization.

Never commit `.env` or OAuth secrets to GitHub.
