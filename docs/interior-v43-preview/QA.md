# Interior v43 review report QA

Branch: `interior-v43-review-report`
Base: `interior-v42-handoff-integration`

## Scope

- New local-only review report route.
- `quote-check` and `quote-compare` expose a minimal `검수 리포트 보기` entry action.
- The entry action persists the current on-screen values before navigation so the report reflects the latest edits.
- The report page itself only reads the current quote and comparison localStorage formats.
- No server submission and no quote values in the URL.
- No v42 compare handoff flag is created by the review route.
- No G2B evidence dependency in v43.
- `main` and production remain untouched.

## Browser regression contract

The dedicated Chromium QA must verify:

- desktop report rendering from seeded quote + A/B/C values
- quote total and included/separate/missing counts
- A/B/C input totals
- review flags for separate, missing, condition differences, amount differences, and partial amount entry
- exactly 12 detail rows
- report rendering leaves quote/compare localStorage byte-for-byte unchanged
- mobile 390px document has no horizontal overflow outside the intended table scroller
- report actions remain visible on mobile
- empty state appears when no saved values exist
- no page/runtime console errors
- `quote-check → quote-review-report` actual navigation works in Chromium
- the quote-check entry saves current form values to `interior-quote-v5`
- the quote-check entry does not change compare-v5/v6 and does not create a v42 handoff flag
- `quote-compare → quote-review-report` actual navigation works in Chromium
- the compare entry saves current A/B/C DOM values and synchronizes `interior-compare-v5` with `interior-compare-v6`
- the compare entry preserves the saved quote and does not create a v42 handoff flag
- the review entry button remains visible without document-level horizontal overflow at 390px on both source pages

## Promotion gate

Technical QA does not authorize production. Keep PR #204 Draft and based on the v42 review branch until the user explicitly approves the preview.
