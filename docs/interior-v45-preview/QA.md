# Interior v45 vendor question group QA

Branch: `interior-v45-vendor-question-groups`
Base: `interior-v44-contractor-checklist`

## Scope

- Preserve v43 review report and v44 common contractor checklist.
- Add A/B/C vendor-specific question cards derived from saved compare values.
- Keep the report read-only: no quote/compare persistence mutation and no server submission.
- Keep price/quality/recommendation judgments out of generated text.
- Keep `main` and production untouched.

## Browser regression contract

The dedicated Chromium QA must verify:

- seeded A/B/C data creates three vendor cards
- each active vendor card contains the expected affected trade groups
- condition differences generate neutral scope-confirmation questions
- amount differences generate neutral quantity/spec/scope questions
- missing vendor amount generates an amount/basis question
- separate state generates a separate-cost/basis question
- vendor-specific copy text names only the selected vendor group and contains no cheapest/recommendation/fair-price judgment
- report + v44 + v45 rendering leaves `interior-quote-v5`, `interior-compare-v5`, and `interior-compare-v6` byte-for-byte unchanged
- desktop and 390px mobile have no unintended document-level horizontal overflow
- vendor cards remain visible in print media while copy buttons are hidden
- quote-only/no-compare state shows no vendor cards and a clear empty message
- no browser console/runtime errors

## Promotion gate

Technical QA does not authorize production. Keep the v45 PR Draft and based on the v44 review branch until the user explicitly approves the preview.
