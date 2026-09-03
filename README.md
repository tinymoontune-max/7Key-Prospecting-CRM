# 7Key CRM v4.3.3

**Fix:** CRM now accepts n8n webhook responses returned either as an object or as a single-item array. This fixes `0 returned` in Live Prospect Finder and also normalizes Enrichment/Draft responses.

# 7Key CRM v4.3

Local CRM for the 7Key prospecting workflow.

## Main changes from v4.2

- Added n8n workflow 06 endpoint: `POST /webhook/7key/enrich-prospect`.
- Added **Enrich prospect** action per prospect.
- Preserves `enrichment_payload` from workflow 05 v1.2.
- Shows verification status, confidence, evidence and discovery notes.
- `Generate draft`, `Approve & Send`, and WhatsApp notice are blocked until the prospect is `Verified` and `safe_to_outreach=true`.
- Editing company/email/phone/website/location automatically resets verification to `Needs verification`.
- Migrates v4.2 localStorage records automatically into v4.3.
- Added request timeouts, stronger duplicate checks, filtering and overview counters.

## Expected n8n workflows

- 01 Prospect Intake & Personalization
- 02 Approved Gmail Sender
- 04 WhatsApp Lead Notification
- 05 Live Prospect Finder v1.2
- 06 Prospect Enrichment Multi-Source v2.1

Keep n8n running at `http://localhost:5678` while using this local CRM.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.


## v4.3.3 — Human verification gate

- Adds a **Verify prospect** button after enrichment.
- Manual verification requires a prospect to be enriched and `contactable=true`.
- Clicking Verify prospect asks for explicit confirmation, then sets `verification_status=Verified` and `safe_to_outreach=true`.
- **Approve & Send** remains locked until the prospect is manually verified and a draft exists.
- Any later edit to key identity/contact fields resets the prospect to Needs verification, preserving the safety gate.
