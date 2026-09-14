# Interior v42 Review Preview

- Branch: `interior-v42-handoff-integration`
- Base: `interior-v40-preview`
- Purpose: review-only integration of quote-check → quote-compare handoff against the real existing page DOM.
- No `main` change.
- No production deploy.
- Real `interior-cost-preview/quote-check/` and `quote-compare/` files remain unchanged in this review step.
- `index.html` loads the real quote-check page in a same-origin iframe and injects `assets/quote-handoff-v42.js` after each iframe navigation.
- The iframe naturally navigates to the real quote-compare page, and the wrapper injects the v42 asset again after load.
- `noindex,nofollow,noarchive,nosnippet` is set on the review wrapper.
- Quote payload is never placed in the URL.
- See `QA.md` for automated verification and remaining manual review gate.
