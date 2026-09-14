# Interior v42 handoff integration QA

Branch: `interior-v42-handoff-integration`
Base review branch: `interior-v40-preview`
Draft PR: `#203`

## Current scope

- `main` and production deployment remain untouched.
- The v42 review branch now integrates the handoff at the real branch paths:
  - `docs/interior-cost-preview/quote-check/index.html`
  - `docs/interior-cost-preview/quote-compare/index.html`
- To avoid rewriting the large one-line source pages during review, those two branch-only files are small review loaders.
- Each loader fetches the frozen review-base HTML from `interior-v40-preview`, rewrites only the review asset / quote-check / quote-compare URLs to the v42 branch renderer, then appends `assets/quote-handoff-v42.js`.
- The review pages remain `noindex,nofollow,noarchive,nosnippet`.
- The real production files on `main` have not been replaced.

## Script ordering and compatibility

- The frozen base HTML already loads `app-v21-bundle.js` with `defer` near the end of the document.
- The loader injects the v42 script after that existing app script, also with `defer`.
- Therefore the existing quote / compare initialization runs first and v42 attaches after the existing DOM and storage handlers are initialized.
- The inline review configuration is parsed before deferred scripts execute and sets a branch-only compare URL, so raw.githack review navigation stays on the same origin.

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

## Existing reset compatibility

The existing compare bundle has two reset handlers:

- v6 reset handler runs in capture phase and removes `interior-compare-v6`.
- v5 reset handler removes `interior-compare-v5` and reloads the page.

Therefore the existing `초기화` button clears both compare persistence layers used by v42.

## Automated checks already completed

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

## Branch integration checks

- quote-check branch path replaced only on v42 review branch: PASS
- quote-compare branch path replaced only on v42 review branch: PASS
- both loaders keep noindex: PASS
- both loaders fetch frozen `interior-v40-preview` HTML: PASS
- existing CSS / app bundle are loaded from the same v42 branch renderer: PASS
- quote-check and quote-compare review URLs share one raw.githack origin: PASS
- branch compare URL is explicit and contains no quote payload: PASS
- v42 branch is ahead of `interior-v40-preview`; base branch itself is unchanged: PASS

## Temporary manual-review URLs

Quote check:
`https://raw.githack.com/5ggul/pm-lab/interior-v42-handoff-integration/docs/interior-cost-preview/quote-check/index.html`

Quote compare:
`https://raw.githack.com/5ggul/pm-lab/interior-v42-handoff-integration/docs/interior-cost-preview/quote-compare/index.html`

These are branch development previews only. raw.githack may display a one-time repository HTML confirmation before rendering the first page.

## Hosting/tool limitations observed

- The available internal Chromium runtime blocks direct URL navigations with `ERR_BLOCKED_BY_ADMINISTRATOR`; DOM-level Chromium tests using `set_content` were therefore used for the 29 checks above.
- Netlify project creation currently returns a false name-collision response for arbitrary unique names.
- The connected Remote Desktop device is offline.
- Vercel deployment creation returned preview deployment URLs, but the same connector could not subsequently resolve those deployments through lookup/access APIs. Those Vercel URLs are therefore not considered verified review links.
- The branch preview uses raw.githack only as a temporary low-traffic development renderer; it is not a production hosting choice.

## Review gate

Do not merge to `main` until the direct v42 branch paths are manually checked for:

- desktop: quote check → A/B/C choose → compare preview → apply/cancel → reload
- mobile: same flow at about 390px width
- A/B/C existing values remain intact when importing into only one vendor
- saved values survive reload through the existing app bundle
- reset removes both compare storage keys

After manual approval, replace the two review loaders with the minimal production-ready integration (the reviewed v42 asset linked directly from the real HTML), then run one final non-production regression before any merge/promotion.
