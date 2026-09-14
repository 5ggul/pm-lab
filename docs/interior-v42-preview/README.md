# Interior v42 Review Preview

- Branch: `interior-v42-handoff-integration`
- Base: `interior-v40-preview`
- Draft PR: `#203`
- No `main` change.
- No production deploy.
- The v42 branch now exposes review loaders at the real branch paths:
  - `docs/interior-cost-preview/quote-check/index.html`
  - `docs/interior-cost-preview/quote-compare/index.html`
- Each loader fetches the frozen review-base HTML from `interior-v40-preview`, reuses the existing branch CSS/JS assets, and then appends `assets/quote-handoff-v42.js`.
- This avoids rewriting the large one-line source pages before manual approval while still testing the real path structure, existing DOM, existing storage keys, and page-to-page handoff.
- `noindex,nofollow,noarchive,nosnippet` remains on the review loaders.
- Quote payload is never placed in the URL.
- Existing A/B/C compare values are preserved except for the selected import target.
- v42 writes both `interior-compare-v5` and `interior-compare-v6`; the existing reset handlers clear both layers.
- See `QA.md` for automated verification and the remaining manual review gate.
