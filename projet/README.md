# 7Key Prospecting CRM — v4.3 synoptic

1. Finder 05 finds niche-matched OSM prospects and returns an `enrichment_payload`.
2. CRM imports/deduplicates them with `Needs verification` and `safe_to_outreach=false` by default.
3. User clicks **Enrich prospect**.
4. Workflow 06 verifies linked public data / official website evidence and returns confidence, provenance and `safe_to_outreach`.
5. CRM only unlocks draft generation and outreach when `verification_status=Verified` and `safe_to_outreach=true`.
6. User still manually approves the final Gmail send.
7. Editing identity/contact/location fields invalidates the previous verification and requires enrichment again.

This structure separates technical data validity from commercial verification and prevents "OSM field empty" from being treated as proof that a website does not exist.
