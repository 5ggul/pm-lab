# v42 integration status

- Review branch: `interior-v42-handoff-integration`
- Base: `interior-v40-preview`
- Draft PR: `#203`
- Main / production: untouched
- Direct branch source integration: YES
- Actual-path review loaders: REMOVED
- Frozen original HTML + one direct v42 script include: YES
- Existing `app-v21-bundle.js` before v42: YES
- Both scripts deferred: YES
- `noindex,nofollow,noarchive,nosnippet` preserved: YES
- v5/v6 comparison persistence compatibility: VERIFIED
- Existing reset clears v5 + v6: VERIFIED
- Chromium DOM integration regression: 29 / 29 PASS
- Manual desktop/mobile approval: REQUIRED BEFORE PR READY / MERGE / PROMOTION

Manual review wrapper:

- `https://raw.githack.com/5ggul/pm-lab/interior-v42-handoff-integration/docs/interior-v42-preview/index.html?page=quote-check`

Direct branch pages:

- `https://raw.githack.com/5ggul/pm-lab/interior-v42-handoff-integration/docs/interior-cost-preview/quote-check/index.html`
- `https://raw.githack.com/5ggul/pm-lab/interior-v42-handoff-integration/docs/interior-cost-preview/quote-compare/index.html`

Current gate:

1. Manually verify desktop handoff / apply / cancel / reload.
2. Manually verify the same flow at about 390px width.
3. Confirm importing one vendor preserves the other two.
4. Confirm saved comparison survives reload and reset clears both persistence keys.
5. Keep PR #203 Draft until explicit approval.
6. Do not merge to `main` or deploy production before approval.
