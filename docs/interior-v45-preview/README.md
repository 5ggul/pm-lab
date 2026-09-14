# Interior v45 vendor question groups preview

- Branch: `interior-v45-vendor-question-groups`
- Base: `interior-v44-contractor-checklist`
- No `main` change.
- No production deploy.
- v43 review report and v44 common contractor checklist remain intact.
- v45 adds vendor-specific A/B/C question groups below the common checklist.
- Only vendors with actual comparison data receive cards.
- Questions are derived from each vendor's saved state/amount and cross-vendor condition or amount differences.
- Each active vendor gets a dedicated copy button.
- No fair-price, cheapest-vendor, contractor-quality, or recommendation judgment.
- Rendering and copying do not mutate `interior-quote-v5`, `interior-compare-v5`, or `interior-compare-v6`.
- `noindex,nofollow,noarchive,nosnippet` remains in the review route.
- Real Chromium regression: `.github/workflows/interior-v45-vendor-question-qa.yml`.

Review wrapper:

`https://raw.githack.com/5ggul/pm-lab/interior-v45-vendor-question-groups/docs/interior-v45-preview/index.html?page=quote-review-report`

Promotion rule: keep this work non-production until explicit user approval. Do not merge/promote to `main` from this review step.
