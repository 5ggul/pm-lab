# Interior v41 Preview Branch

- Branch: `interior-v40-preview`
- Draft PR: `#201`
- No production/main changes.
- `quote-check/` and `quote-compare/` are intended to be served from the same origin.
- noindex remains on the review pages.
- Handoff URL contains no quote payload; localStorage is used for the handoff.
- The compare destination is resolved relatively (`../quote-compare/`) so the review flow is not tied to `/pm-lab/` and can run under GitHub Pages, Netlify, Vercel, or another same-origin preview base path.
- Source quote data is isolated with the review-only key `interior-quote-source-v41`.
- Each source/handoff pair uses the same v2 `transferId` and `createdAt`; mismatched or incomplete pairs are rejected before A/B/C is touched.
- A partial localStorage write is cleaned up instead of leaving a stale source/handoff pair.
- Temporary source/handoff data is removed after successful apply, cancel, stale rejection, mismatch rejection, or orphan-source detection. The persisted compare state remains separate.
- Applied A/B/C preview state is persisted with the review-only key `interior-quote-compare-state-v41` so reload persistence can be verified without touching `interior-quote-v5`, `interior-compare-v5`, or `interior-compare-v6`.
- Handoff flags older than 30 minutes are discarded as stale.
- Incomplete source quote data is rejected before any A/B/C slot is overwritten.
- The quote-check harness now mirrors the production six context fields (`supply`, `exclusive`, `building`, `region`, `scope`, `bathrooms`) plus the same 12 core item ids and detailed fields.
- Logic QA is in `QA.md`; Chromium layout/interaction QA is in `BROWSER-QA.md`.
- External preview hosting was not created because creating a new preview project requires explicit approval.
