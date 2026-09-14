# Interior v43 review report preview

- Branch: `interior-v43-review-report`
- Base: `interior-v42-handoff-integration`
- No `main` change.
- No production deploy.
- New non-production route: `docs/interior-cost-preview/quote-review-report/`
- Reads `interior-quote-v5` and the current comparison persistence (`interior-compare-v6`, fallback `interior-compare-v5`).
- Does not write or mutate quote/compare storage.
- Shows saved quote totals/status counts, A/B/C entered totals, per-item values, and review flags for missing/separate/condition differences/entered amount differences.
- Does not judge fair price or recommend a contractor.
- Uses `noindex,nofollow,noarchive,nosnippet` during review.
- Old v20 G2B evidence dependencies are intentionally not restored because those files are absent from the current v42 preview lineage.
- `docs/interior-v43-preview/index.html` is a temporary branch review wrapper.
- Browser regression: `.github/workflows/interior-v43-review-report-qa.yml`.

Promotion rule: keep this work non-production until explicit user approval. Do not merge/promote to `main` from this review step.
