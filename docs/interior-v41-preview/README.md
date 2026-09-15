# Interior v41 Preview Branch

- Branch: `interior-v40-preview`
- Draft PR: `#201`
- No production/main changes.
- `quote-check/` and `quote-compare/` are intended to be served from the same origin.
- noindex remains on the compare candidate.
- Handoff URL contains no quote payload; localStorage is used for the handoff.
- Source quote data is isolated with the review-only key `interior-quote-source-v41`.
- Applied A/B/C preview state is persisted with the review-only key `interior-quote-compare-state-v41` so reload persistence can be verified without touching existing quote/compare storage keys.
- Handoff flags older than 30 minutes are discarded as stale.
- Incomplete source quote data is rejected before any A/B/C slot is overwritten.
- QA notes are in `QA.md`.
- External preview hosting was not created because no existing Netlify preview project was found and creating a new project requires explicit approval.
