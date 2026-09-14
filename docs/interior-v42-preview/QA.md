# Interior v42 handoff integration QA

Branch: `interior-v42-handoff-integration`
Base review branch: `interior-v40-preview`

## Scope

- Existing `interior-cost-preview/quote-check/` and `quote-compare/` source pages are not modified in this review step.
- `assets/quote-handoff-v42.js` is injected only by `interior-v42-preview/index.html` after the real page finishes loading.
- This keeps the review isolated while exercising the existing page DOM and existing localStorage formats.
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

## Browser/environment limitation

The available Chromium runtime blocks all navigations (`http`, `https`, `file`, and `data`) with `ERR_BLOCKED_BY_ADMINISTRATOR`. DOM-level Chromium tests using `set_content` work and were used for the checks above, but full URL navigation screenshots cannot be produced in this environment.

The connected Netlify project-creation API also currently returns a false name-collision response for arbitrary unique names, and the connected Remote Desktop device is offline. Therefore no new external preview deployment was created in this step.

## Review gate

Do not merge to `main` or replace the existing production preview pages until an external same-origin preview can be opened and the following manual flow is checked:

- desktop: quote check → A/B/C choose → compare preview → apply/cancel → reload
- mobile: same flow at 390px width
- verify A/B/C existing values are preserved when importing into one vendor
- verify saved values survive reload through the existing app bundle
- verify reset behavior removes both existing compare storage keys
