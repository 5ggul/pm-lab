# Daangn cloud clock

Cloudflare Cron provides an independent trigger for the existing GitHub publisher. No local PC or Codex session is needed after deployment and authentication setup.

## Current deployment

- Worker: `daangn-publisher-clock`, private (workers.dev and preview URLs disabled).
- KV: `STATUS`, records sanitized scheduled outcomes for seven days.
- Unit tests: `node --test clock.test.mjs` (five tests).
- The user explicitly approved storing the GitHub credential in this Worker. `GITHUB_DISPATCH_TOKEN` was installed without printing or committing its value.
- Cloudflare cron is enabled every five minutes. Existing GitHub schedule and publisher are unchanged. Natural scheduled execution evidence is recorded in remote KV; deployment alone is not proof of execution.

## Activation after credential approval

Store a GitHub credential in the Worker secret `GITHUB_DISPATCH_TOKEN`. Prefer a token scoped to 5ggul/pm-lab with Actions read/write and Contents read. Do not log or commit the credential. Set `triggers.crons` to `["*/5 * * * *"]` and deploy. Verify at least one actual scheduled event in remote KV and, for an unhandled slot, the corresponding GitHub workflow and publisher ledger result.

## Dispatch rules

Read current main configuration, ledger and active runs. Only KST 08–22 configured slots after minute 7 are eligible. Terminal, uncertain and active publications are not retried. Technical retries respect configured attempt limits. GitHub failures stop dispatch. Existing publisher concurrency and durable reservations remain authoritative. No backlog catch-up or source-quality bypass is performed.

## Monitoring and rollback

`npx wrangler kv key get latest --binding STATUS --remote --config wrangler.jsonc` reads the last native event. `dispatched` confirms a request only, not publication. A successful later `slot_handled` report includes the ledger outcome and URL where available. Disable the Cloudflare cron by setting the trigger list to empty and redeploying; the existing GitHub schedule remains available. Revoke/remove the Worker secret if retiring this clock.
