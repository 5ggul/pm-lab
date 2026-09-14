# Interior v43 review report QA

Branch: `interior-v43-review-report`
Base: `interior-v42-handoff-integration`

## Scope

- New local-only review report route.
- Reads the current quote and comparison localStorage formats.
- No server submission and no quote/compare mutation.
- No G2B evidence dependency in v43.
- `main` and production remain untouched.

## Browser regression contract

The dedicated Chromium QA must verify:

- desktop report rendering from seeded quote + A/B/C values
- quote total and included/separate/missing counts
- A/B/C input totals
- review flags for separate, missing, condition differences, amount differences, and partial amount entry
- exactly 12 detail rows
- localStorage values are byte-for-byte unchanged after rendering
- mobile 390px document has no horizontal overflow outside the intended table scroller
- report actions remain visible on mobile
- empty state appears when no saved values exist
- no page/runtime console errors

## Promotion gate

Technical QA does not authorize production. Keep any v43 PR Draft and based on the v42 review branch until the user explicitly approves the preview.
