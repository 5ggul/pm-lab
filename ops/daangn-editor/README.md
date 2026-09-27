# Server-side editorial supply

Authenticated Cloudflare Workers AI endpoint used only by the Daangn publisher.
`EDITOR_TOKEN` is stored in Cloudflare; the same dedicated credential is stored as
`DAANGN_EDITOR_TOKEN` in the user-owned GitHub repository. Neither provider's
account credential is sent to the other. The endpoint rejects unauthenticated
requests and accepts only bounded korea.kr article input, with no tools or URL fetching.

Qwen drafts a short Korean post; a separate Llama request reviews the complete
source and draft. The runner additionally checks exact source quotations, numbers,
expiry, style and duplicates. It hashes the complete article and re-fetches it
immediately before publication; any change requires a new review.

The collector rotates household search topics hourly, retains up to 30 reviewed
drafts, and avoids reprocessing rejected articles for a day. It never treats an
official domain alone as proof that an arbitrary generated claim is correct.
AI review remains fallible; policy source summaries are restricted to practical
household information, excluding investment and treatment advice.

Daily 15 is a target and hard maximum, not a guarantee. A no-candidate slot fails
the workflow, and the Actions summary exposes actual posts and remaining supply.
Existing Cloudflare clock continues independently of the user's computer.

Deploy: `npx wrangler whoami` then `npx wrangler deploy`.
No changes to account billing or plan are made by this deployment. Inference uses
the existing Workers AI allowance/billing; generation is bounded to four source
attempts per scheduled run. HTTP errors stop generation instead of retry storms.
