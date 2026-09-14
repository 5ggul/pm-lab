# Interior v42 handoff final integration QA

Branch: `interior-v42-handoff-integration`
Base review branch: `interior-v40-preview`
Draft PR: `#203`

## Final integration shape

- `main` and production deployment remain untouched.
- The actual v42 branch paths use the frozen `interior-v40-preview` source HTML directly:
  - `docs/interior-cost-preview/quote-check/index.html`
  - `docs/interior-cost-preview/quote-compare/index.html`
- Temporary actual-path loaders are removed.
- Each page adds exactly one deferred `quote-handoff-v42.js?v=20260914-final` include after the existing deferred `app-v21-bundle.js`.
- Existing page content, metadata, navigation and tool DOM are otherwise preserved.
- `noindex,nofollow,noarchive,nosnippet` remains present.

## Handoff behavior verified

1. Quote check adds `비교표로 보내기`.
2. A/B/C target can be selected.
3. Current quote is saved to `interior-quote-v5`.
4. Only target/timestamp metadata is stored in `interior-quote-compare-handoff-v42`.
5. URL contains no quote payload.
6. Quote compare opens a preview dialog and does not auto-apply.
7. Apply changes only the selected vendor state/amount fields.
8. The other two vendors remain unchanged.
9. Apply writes the full comparison state to both `interior-compare-v5` and `interior-compare-v6`.
10. Cancel clears the handoff flag without applying data.
11. Handoffs older than 30 minutes are discarded.
12. Existing reset clears both compare persistence layers.

## Automated checks

- JavaScript syntax: PASS
- Chromium DOM integration: 29 / 29 PASS
- Final static integration checks: PASS
  - actual-path loaders removed
  - exactly one v42 include per page
  - existing app bundle precedes v42
  - both scripts deferred
  - frozen page content restored
  - noindex preserved
  - `main` / production unchanged

## Real Chromium end-to-end regression

GitHub Actions workflow: `Interior v42 browser QA`
Successful run: `34813959437`
Engine: Google Chrome 152 / Chromium via `puppeteer-core`

Result: PASS

Desktop viewport: `1440x1000`

Verified through actual browser interaction:

- pre-existing A/C comparison values saved
- quote-check values entered through the real form
- `비교표로 보내기` dialog opened
- B target selected
- browser navigation reached quote-compare with no query/payload in the URL
- import preview showed the expected target/count/amount summary
- applying to B preserved A/C values
- `interior-compare-v5` and `interior-compare-v6` matched
- applied values survived reload
- reset removed both persistence keys and restored blank/default values
- cancel removed only the handoff and did not write compare data
- stale handoff was removed without opening the import dialog
- no page/runtime console errors remained after excluding the test-server-only favicon miss

Mobile viewport: `390x844`

Verified through actual browser interaction:

- quote-check page had no document-level horizontal overflow
- send dialog fit within the 390px viewport
- both dialog actions were visible
- navigation to quote-compare succeeded
- import dialog fit within the 390px viewport
- compare page had no document-level horizontal overflow
- apply updated the selected vendor correctly
- handoff flag cleared after apply

Browser evidence artifact: `interior-v42-browser-qa`
Artifact ID: `10335857265`
Contents include the JSON test report and desktop/mobile screenshots.

The first real-browser run failed only because the local test harness returned 404 for the browser's automatic `/favicon.ico` request. The product interaction assertions themselves had passed to that point. The harness was corrected to serve an empty favicon, then the full desktop + mobile regression passed.

## Review URLs

Manual wrapper:
`https://raw.githack.com/5ggul/pm-lab/interior-v42-handoff-integration/docs/interior-v42-preview/index.html?page=quote-check`

Direct branch pages:

- `https://raw.githack.com/5ggul/pm-lab/interior-v42-handoff-integration/docs/interior-cost-preview/quote-check/index.html`
- `https://raw.githack.com/5ggul/pm-lab/interior-v42-handoff-integration/docs/interior-cost-preview/quote-compare/index.html`

raw.githack is a temporary development renderer, not production hosting.

## Remaining promotion gate

The technical browser regression gate is PASS.

PR #203 must still remain Draft and must not be merged/promoted until the user explicitly approves the reviewed preview. No `main` merge or production deployment is authorized by these automated results alone.
