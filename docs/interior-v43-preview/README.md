# Interior v43 review report preview

- Branch: `interior-v43-review-report`
- Base: `interior-v42-handoff-integration`
- No `main` change.
- No production deploy.
- New non-production route: `docs/interior-cost-preview/quote-review-report/`.
- `quote-check` now exposes `검수 리포트 보기`: it saves the current form to `interior-quote-v5` and then opens the report.
- `quote-compare` now exposes `검수 리포트 보기`: it saves the current A/B/C DOM state to both `interior-compare-v5` and `interior-compare-v6` and then opens the report.
- The report page itself is read-only: rendering does not write or mutate quote/compare storage.
- The review route does not create the v42 compare handoff flag and does not put quote values in the URL.
- Shows saved quote totals/status counts, A/B/C entered totals, per-item values, and review flags for missing/separate/condition differences/entered amount differences.
- Does not judge fair price or recommend a contractor.
- Uses `noindex,nofollow,noarchive,nosnippet` during review.
- Old v20 G2B evidence dependencies are intentionally not restored because those files are absent from the current v42 preview lineage.
- `docs/interior-v43-preview/index.html` is a temporary same-origin branch review wrapper for `quote-check`, `quote-compare`, and `quote-review-report`.
- Browser regression: `.github/workflows/interior-v43-review-report-qa.yml` runs report regression plus quote/compare → report integration regression in real Chromium.

Promotion rule: keep this work non-production until explicit user approval. Do not merge/promote to `main` from this review step.
