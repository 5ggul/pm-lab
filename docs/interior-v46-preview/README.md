# Interior v46 review progress preview

- Branch: `interior-v46-review-progress`
- Base: `interior-v45-vendor-question-groups`
- No `main` change.
- No production deploy.
- Keeps v43 review report, v44 contractor checklist, and v45 vendor question cards.
- Adds a local-only progress board for vendor answers.
- New storage key: `interior-review-progress-v46`.
- Completion checks and vendor-answer notes are stored only in that key.
- `interior-quote-v5`, `interior-compare-v5`, and `interior-compare-v6` are not modified by v46.
- Shows overall and per-vendor progress.
- Allows copying only unanswered questions per vendor.
- Allows clearing only the v46 progress record.
- No server submission or account sync.
- `docs/interior-v46-preview/index.html` is a temporary non-production wrapper.

Preview:

`https://raw.githack.com/5ggul/pm-lab/interior-v46-review-progress/docs/interior-v46-preview/index.html?page=quote-review-report`

Promotion rule: keep Draft/non-production until explicit user approval. Do not merge or deploy to production from a generic `다음` instruction.
