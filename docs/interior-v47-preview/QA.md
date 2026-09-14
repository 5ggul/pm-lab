# Interior v47 final review summary QA

Branch: `interior-v47-final-review-summary`
Base: `interior-v46-review-progress`

## Scope

- Read-only final summary layered on v43-v46 review flow.
- Reads vendor question rows from v45 and progress entries from `interior-review-progress-v46`.
- Does not mutate `interior-quote-v5`, `interior-compare-v5`, `interior-compare-v6`, or `interior-review-progress-v46`.
- No server submission or account sync.
- `main` and production remain untouched.

## Browser regression contract

Dedicated Chromium QA verifies:

- seeded A/B/C data produces three final-summary cards
- overall completed / pending counts are consistent with v46 progress
- completed answer notes are shown
- pending questions remain visible
- vendor-specific and overall copy text are generated
- output does not claim a recommended contractor, lowest price, fair price, or permission to contract
- quote / compare storage remains byte-for-byte unchanged after v47 rendering
- v46 progress storage remains byte-for-byte unchanged after v47 rendering
- 390px mobile has no document-level horizontal overflow
- print media keeps the final summary visible and hides copy actions
- quote-only / no-compare state shows an explicit empty summary state
- no page/runtime console errors

## Promotion gate

Technical QA does not authorize production. Keep the v47 PR Draft and based on the v46 review branch until the user explicitly approves the preview.
