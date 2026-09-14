# Interior v42 handoff final integration QA

Branch: `interior-v42-handoff-integration`
Base review branch: `interior-v40-preview`
Draft PR: `#203`

## Final integration shape

- `main` and production deployment remain untouched.
- The actual v42 branch paths now use the frozen `interior-v40-preview` source HTML directly:
  - `docs/interior-cost-preview/quote-check/index.html`
  - `docs/interior-cost-preview/quote-compare/index.html`
- The temporary loaders have been removed from those two actual branch paths.
- Each page differs from the frozen source only by one direct deferred include added after the existing app bundle:
  - existing: `app-v21-bundle.js`
  - added: `quote-handoff-v42.js?v=20260914-final`
- Both scripts use `defer`, and the existing app bundle appears first, so existing quote/compare initialization is established before v42 attaches.
- Existing page content, metadata, navigation and tool DOM are otherwise preserved.
- `noindex,nofollow,noarchive,nosnippet` remains present.

## Handoff behavior

1. Quote check adds `비교표로 보내기` to the existing result actions.
2. User selects A/B/C.
3. Current quote is saved to the existing `interior-quote-v5` key.
4. Only a target/timestamp handoff flag is stored in `interior-quote-compare-handoff-v42`.
5. URL contains no quote payload.
6. Quote compare opens a preview dialog and does not auto-apply.
7. Apply changes only the selected vendor's state and amount fields.
8. Existing values in the other two vendors remain unchanged.
9. Apply writes the full current comparison DOM to both `interior-compare-v5` and `interior-compare-v6`.
10. Cancel clears only the handoff flag.
11. Handoff flags older than 30 minutes are discarded.

## Existing reset compatibility

The existing compare bundle already has two reset handlers on the same reset button:

- v6 capture handler removes `interior-compare-v6`.
- v5 handler removes `interior-compare-v5` and reloads the page.

Therefore the existing `초기화` action clears both compare persistence layers used by v42.

## Automated regression already completed

JavaScript syntax: PASS

Chromium DOM integration: 29 / 29 PASS

Covered checks include:

- quote button injection and quote data read
- A/B/C target dialog
- quote + handoff persistence
- no quote payload in the navigation contract
- mobile 390px dialog fit and actions
- compare import preview counts and totals
- selected vendor state/amount application
- other two vendors preserved
- v5/v6 persistence parity
- apply/cancel behavior
- stale handoff removal

## Final static integration checks

- actual quote-check loader removed: PASS
- actual quote-compare loader removed: PASS
- exactly one v42 include in quote-check: PASS
- exactly one v42 include in quote-compare: PASS
- existing app bundle precedes v42 include: PASS
- both app and v42 scripts are deferred: PASS
- frozen page body/content restored: PASS
- noindex meta preserved on both pages: PASS
- v42 asset remains a separate file: PASS
- `main` / production unchanged: PASS

## Manual review wrapper

The separate wrapper remains only for convenient manual review:

`https://raw.githack.com/5ggul/pm-lab/interior-v42-handoff-integration/docs/interior-v42-preview/index.html?page=quote-check`

It now reads the current integrated v42 branch HTML, rewrites asset URLs for the branch renderer, sets only the review compare URL, and does not add a second v42 script include.

Direct branch URLs:

- `https://raw.githack.com/5ggul/pm-lab/interior-v42-handoff-integration/docs/interior-cost-preview/quote-check/index.html`
- `https://raw.githack.com/5ggul/pm-lab/interior-v42-handoff-integration/docs/interior-cost-preview/quote-compare/index.html`

raw.githack is a temporary development renderer, not production hosting.

## Remaining gate

Before PR #203 can move out of Draft or any merge/promotion is considered, manually verify:

- desktop: quote check → A/B/C choose → compare preview → apply/cancel → reload
- mobile around 390px: same flow
- importing into one vendor preserves the other two vendors
- saved comparison survives reload
- reset clears both compare persistence keys

Do not merge to `main` or deploy production without explicit approval.
