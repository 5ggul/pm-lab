# Interior v42 Review Preview

- Branch: `interior-v42-handoff-integration`
- Base: `interior-v40-preview`
- Draft PR: `#203`
- Purpose: review-only integration of quote-check → quote-compare handoff against the existing page DOM and storage formats.
- No `main` change.
- No production deploy.
- Real `interior-cost-preview/quote-check/` and `quote-compare/` files remain unchanged in this review step.
- `index.html` is a branch-only loader. It fetches the current review-base HTML from GitHub raw content, points CSS/JS assets to the existing public GitHub Pages assets, and then loads the branch-local `quote-handoff-v42.js`.
- `?page=quote-check` and `?page=quote-compare` stay on the same preview origin so localStorage handoff/persistence can be reviewed without putting quote data in the URL.
- `noindex,nofollow,noarchive,nosnippet` remains on the review loader/source pages.
- Temporary branch preview URL:
  `https://raw.githack.com/5ggul/pm-lab/interior-v42-handoff-integration/docs/interior-v42-preview/index.html?page=quote-check`
- raw.githack may show a one-time confirmation screen for HTML from a repository. This is a temporary development preview only, not a production host.
- Vercel preview creation was attempted, but the connected deployment create response could not subsequently be resolved through the deployment lookup/access APIs, so that URL is not treated as verified and is not a review link.
- See `QA.md` for automated verification and the remaining manual review gate.
