# Interior v42 handoff integration QA

Branch: `interior-v42-handoff-integration`
Base review branch: `interior-v40-preview`
Draft PR: `#203`

## Scope

- Existing `interior-cost-preview/quote-check/` and `quote-compare/` source pages are not modified in this review step.
- The branch-only loader fetches those review-base HTML files, reuses the existing public CSS/JS assets, then adds only `assets/quote-handoff-v42.js`.
- `?page=quote-check` and `?page=quote-compare` remain on the same preview origin, so the real localStorage behavior can be reviewed without modifying the production pages.
- `main` and production deployment are untouched.

## Handoff behavior

1. Quote check adds `비교표로 보내기` to the existing result actions.
2. User selects A/B/C.
3. Current quote is saved to the existing `interior-quote-v5` key.
4. Only a short target/timestamp handoff flag is stored in `interior-quote-compare-handoff-v42`.
5. URL contains no quote payload.
6. Quote compare opens a preview dialog and does not auto-apply.
7. Apply changes only the selected vendor's state and amount fields.
8. Existing values in the other two vendors remain unchanged.
9. Apply writes the full current comparison DOM to both `interior-compare-v5` and `interior-compare-v6`, matching the existing app's two persistence layers.
10. Cancel clears only the handoff flag.
11. Handoff flags older than 30 minutes are discarded.

## Automated checks

JavaScript syntax: PASS

Chromium DOM integration tests: 29 / 29 PASS

- quote button injection
- quote region read
- quote item/state/amount read
- target selection dialog open
- source quote persistence
- B target handoff persistence
- navigation path contains no quote payload
- mobile dialog visible
- mobile dialog width fits 390px viewport
- mobile dialog actions visible
- compare import dialog open
- target B displayed
- preview entered-count correct
- preview amount total correct
- preview missing-count correct
- B demolition amount applied
- B bathroom amount applied
- A vendor preserved
- C vendor preserved
- handoff cleared after apply
- v5 B persistence
- v6 B persistence
- v5 A/C persistence
- v5/v6 payload parity
- cancel clears handoff
- cancel leaves v5 untouched
- cancel leaves v6 untouched
- stale handoff shows no import dialog
- stale handoff removed

## Temporary manual-review URL

`https://raw.githack.com/5ggul/pm-lab/interior-v42-handoff-integration/docs/interior-v42-preview/index.html?page=quote-check`

This is a branch development preview only. raw.githack may display a one-time repository HTML confirmation before rendering the page.

## Hosting/tool limitations observed

- The available internal Chromium runtime blocks direct URL navigations with `ERR_BLOCKED_BY_ADMINISTRATOR`; DOM-level Chromium tests using `set_content` were therefore used for the 29 checks above.
- Netlify project creation currently returns a false name-collision response for arbitrary unique names.
- The connected Remote Desktop device is offline.
- Vercel deployment creation returned preview deployment URLs, but the same connector could not subsequently resolve those deployments through lookup/access APIs. Those Vercel URLs are therefore not considered verified review links.
- The branch preview uses raw.githack only as a temporary low-traffic development renderer; it is not a production hosting choice.

## Review gate

Do not merge to `main` or replace the existing production preview pages until the temporary branch preview is manually checked for:

- desktop: quote check → A/B/C choose → compare preview → apply/cancel → reload
- mobile: same flow at about 390px width
- A/B/C existing values remain intact when importing into only one vendor
- saved values survive reload through the existing app bundle
- reset behavior removes both existing compare storage keys

After manual approval, the next implementation step is to add the reviewed v42 asset to the real quote-check/quote-compare pages on a non-production integration branch, re-run the same checks, and only then consider merge/promotion.
