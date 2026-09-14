# Interior v46 review progress QA

Branch: `interior-v46-review-progress`
Base: `interior-v45-vendor-question-groups`

## Scope

- Adds completion checks and vendor-answer notes to the existing vendor questions.
- Persists only to `interior-review-progress-v46`.
- Does not mutate quote or comparison storage.
- No server submission.
- `main` and production remain untouched.

## Chromium regression contract

The v46 browser QA must verify:

- A/B/C progress cards render when comparison data exists
- overall and per-vendor progress counts render
- checking a question writes only the v46 progress key
- vendor-answer memo persists after reload
- completed questions are excluded from the vendor's unanswered-copy text
- quote and compare storage are byte-for-byte unchanged
- progress state restores after reload
- print media keeps the progress board but hides action buttons
- 390px mobile has no document-level horizontal overflow
- progress reset removes only `interior-review-progress-v46`
- quote-only/no-comparison state renders an empty progress message
- no browser console/runtime errors

## Promotion gate

Technical QA does not authorize production. Keep the v46 PR Draft and based on the v45 review branch until explicit user approval.
