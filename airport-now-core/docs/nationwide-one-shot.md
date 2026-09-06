# Nationwide one-shot ingest

The collector supports local/CI replay and a deployed, secret-protected preview Worker backed by remote D1. `wrangler.local.jsonc` remains local-only; `wrangler.preview.jsonc` identifies the remote preview. No scheduled handler is enabled. This branch enables the preview runtime after remote HTTP and browser hydration verification; the public Pages site receives that setting only when the PR is merged and Pages deploys. All pages remain noindex.

## Run

Use Node 24 and `npm ci`, then `npm run ingest:once` from `airport-now-core`. Live runs reuse `.wrangler/once` for persistent current/history data; raw captures get a separate timestamped folder. Existing process variables, `.env`, or `.dev.vars` are used. The current repository secrets are `DATA_GO_KR_SERVICE_KEY`, `DATAKEY`, and `KMAKEY`. The collector also accepts the canonical `KMA_API_HUB_KEY` variable. Secret values are never written to capture files or logs. Successful collection automatically replays its captured pages against the same D1 and asserts unchanged table counts and zero new flight events without additional upstream requests.

`npm run verify:d1` performs an offline test using committed, explicitly labelled real-data excerpts. `npm test` includes SQL transaction, canonical mapping, source isolation, freshness and HTTP checks.

`npm run ingest:once -- --replay tests/fixtures/live-local/<capture-directory>` replays complete captured response pages into that directory's persistent local D1. Repeating against the same database verifies no-change behavior. Replay uses execution-time freshness, so old METAR is expected to become stale. The capture must match the current Korean service date; historical fixture verification uses `verify:d1`.

Live capture output is under ignored `tests/fixtures/live-local/`, with one raw response per provider/direction/page or ICAO, plus `verification.json`. Full captures are Actions artifacts with seven-day retention. Only small provider-response excerpts are committed as test fixtures.

## Processing contract

- IIAC detail arrivals and departures use complete scheduled-date pagination, a single-encoded existing service key and JSON response mode.
- KAC `arrival` and `depart` use `searchday=YYYYMMDD`. Avoid assuming the unfiltered endpoint is today-only: its default response includes multiple days. Complete pages are collected before any source batch is written.
- Repeated pages, changing totals, provider error envelopes inside HTTP 200 and incomplete page sets fail that source. Network failure cannot erase existing data.
- ICN boards belong to IIAC. KAC returns some ICN board rows as well; those are counted as out of scope to prevent overwriting IIAC. Flights between a KAC airport and ICN remain available for the KAC-owned direction.
- An operating flight has one canonical row; marketing numbers are indexed in `flight_codeshares`. Duplicate selection prefers the operating record, provider timestamp, status/completeness and a deterministic tie-break.
- Provider raw status, planned/changed times and source timestamps are retained. KAC's documented actual-time field is used as actual only for completed movements. IIAC changed times remain estimates because its response has no distinct actual-time field. Advance cancellations (`사전결항`) count as cancelled. Time-derived delay does not infer a weather cause.
- Malformed/self-route rows are quarantined with diagnostics; valid rows continue. `ok` means collection and persistence completed; `complete=false` means there were rejected rows. A partially malformed source remains `PARTIAL` in health.
- Current flights, codeshare aliases and changed-state events are committed in one D1 batch transaction. JSON bindings are chunked. Older captures cannot regress current state; unchanged polls add no flight events.
- METAR stations are collected separately. A station mismatch, transport or parser failure is isolated. Stale observations are processed successfully but are not inserted into current/history: `current=false`, `freshCoverageComplete=false` and source health `STALE`/`PARTIAL` disclose the gap. HTTP reads independently apply the 90-minute freshness and 10-minute future tolerance.
- The CLI exits nonzero for transport, pagination, parsing or storage failures. Correct quarantine of malformed rows and stale weather is reported explicitly, rather than treated as a broken collector.

## Verified 2026-09-06

Existing secrets successfully called all four flight direction/source combinations and all 15 METAR stations. The complete capture from [Actions run 34016060161](https://github.com/5ggul/pm-lab/actions/runs/34016060161) was replayed through the corrected source-ownership rules and actual workerd D1 locally:

| Source | Raw rows | Canonical operating rows |
|---|---:|---:|
| IIAC arrival | 1,182 | 553 |
| IIAC departure | 1,196 | 553 |
| KAC arrival | 841 | 713 |
| KAC departure | 860 | 718 |

D1 totals: 2,537 current flights, 1,509 marketing aliases, 2,537 initial flight events, 14 current weather records and 14 weather events. ICN source ownership was preserved. Full-capture repeat verification against the same local D1 added zero events for all four flight sources; all table counts remained unchanged.

The IIAC arrival source includes one self-route record (`GA879`, ICN to ICN); it is rejected, never repaired by guessing. KAC returned six out-of-scope ICN rows per direction. RKJK's HTTP-200 response has a 2026-02-19 observation; it is correctly excluded from current weather. The other 14 stations returned current observations.

HTTP verification covers marketing lookup, ICN arrivals/departures, CJU arrivals, GMP departures, single/batch weather, CORS, OPTIONS, empty weather, invalid direction, unknown airport, malformed flight queries and invalid limits. Sample-only verification is labelled separately from complete live-capture verification.

### Repeat live collection limitation

The later [live retry 34016552322](https://github.com/5ggul/pm-lab/actions/runs/34016552322) failed to connect to all flight and weather sources, despite bounded IPv4 curl retries. That fresh CI job wrote zero flight/weather rows and recorded each source failure. Earlier full captures and local D1 replay remain valid evidence, but repeated live collection stability on the CI host is **not established**. This does not establish an API-key registration problem. The CLI now emits source progress and sanitized numeric transport exit codes for further host/network diagnosis. No additional live calls run on push; the live verification workflow is manual-only. Unit/SQL/HTTP/local-D1 CI passed on the final implementation.

## Remote preview verification, 2026-09-06 16:20–16:28 KST

Worker: https://airport-now-preview-core.dhkim8704.workers.dev
D1: airport-now-preview (0de24f4b-eead-46bf-9780-b19c364d3ab0), APAC/ICN.

[Manual Actions run 34018847864](https://github.com/5ggul/pm-lab/actions/runs/34018847864) succeeded for all four flight sources and all 15 METAR requests using the existing GitHub secrets. IIAC arrivals rejected the same one malformed self-route record; RKJK remained stale. Fourteen weather stations had 2026-09-06 07:00 UTC observations.

| Source | Latest raw rows | Latest normalized operating rows | Pages |
|---|---:|---:|---:|
| IIAC arrival | 1,182 | 553 | 12 |
| IIAC departure | 1,196 | 553 | 12 |
| KAC arrival | 844 | 715 | 9 |
| KAC departure | 857 | 719 | 9 |

Remote accumulated D1 counts: 2,546 current flights, 1,515 marketing aliases, 2,587 flight events and 14 current weather records. Current rows retain previously observed flights if a later upstream snapshot omits them; therefore accumulated counts can differ from one capture's normalized counts. Grouping by service date, operating flight number, direction and route found no duplicate flights. Repeated live observations emitted events for changed states; unchanged replay is separately verified using complete captures and local D1.

The protected POST /internal/ingest/once endpoint accepts exactly one allowlisted flight source or weather station. It is preview-only, requires an authorization token, limits request bodies and uses a five-minute atomic D1 lease to prevent concurrent ingestion. Provider fetches have a 25-second attempt timeout, at most two attempts (including server-error retries), a two-minute source collection deadline and 20-page ceiling. All flight pages use 100 rows: an earlier 1,000-row KAC request returned a gateway error. Incomplete source captures never write flight batches. Intermittent upstream timeouts/504s were observed before the successful run, so production collection stability is not yet established.

The manual workflow sends existing public API keys transiently over HTTPS to this fixed Worker URL; it never prints keys or stores them in artifacts. The Worker stores only the ingestion authorization token as a secret. Observability is disabled. Remote artifacts contain sanitized outcome and transport metadata, not credential-bearing URLs. No cron is configured, and the scheduled handler still throws SCHEDULED_INGEST_DISABLED_UNTIL_USER_APPROVAL.

Run node scripts/verify-remote-read.mjs to repeat deployed HTTP checks. The successful check covered all 553 ICN arrivals and 553 departures across pages, 255 CJU arrivals, 179 GMP departures, QF8233 → CX426 alias lookup, single/batch weather, RKJK stale exclusion, malformed inputs, CORS/OPTIONS and unauthenticated ingestion rejection.

Browser verification used the published Pages HTML with this branch's site.js and runtime configuration supplied only inside an isolated browser session. It displayed 553 ICN arrival rows, updated the primary counts to 14 delayed/1 cancelled and showed separate flight/weather timestamps. The delay filter showed exactly 14 rows. A simulated flight API 503 retained the dated static snapshot while weather could still update independently.

The frontend now retrieves complete pages before replacing a board. Duplicate IDs, changing collection timestamps, a failed page or a collection older than 30 minutes preserve the static snapshot. Search results also require a successful collection within 30 minutes. Weather retains its independent 90-minute observation check. Backend offset pagination uses deterministic time/instance ordering; API responses include collection freshness. Both API and HTML remain noindex.

68 unit/SQL/HTTP/hydration tests and local workerd D1 verification pass. Production cron remains disabled; enablement requires separate explicit approval after repeated stable runs.

Official schemas: [KAC flight status](https://www.data.go.kr/data/15158625/openapi.do), [IIAC detail flight status](https://www.data.go.kr/data/15112968/openapi.do). The current registry is `src/source-registry.js`; the old search-only KAC stubs in `core.js` are legacy and are not the nationwide collector.

## Public rollout and repeat checks, 2026-09-06 17:07–17:22 KST

PR #22 and #25 are merged and Pages deployment succeeded. Public runtime reads are ON. All 15 airport pages returned HTTP 200 and retained noindex; KAC detail pages include both directions, and ICN adds a departure board alongside its arrival board. Old ICN arrival rows are hidden when collection is unavailable. Public browser verification confirmed the safeguards without request overrides. Separately, a controlled browser scenario using stored CJU data verified 255 cards per direction, a five-row departure delay filter and no horizontal overflow at 390px; that scenario is not evidence of a fresh upstream collection.

Repeat collection remains intermittent:
- Run 34020960421: all four flight fetches timed out; all 15 weather requests completed.
- Run 34021293432: IIAC departure succeeded; the other flight sources failed, including KAC departure's changing-total pagination guard.
- Run 34021502982: KAC arrival succeeded with nine complete pages; IIAC arrival returned 504 and IIAC/KAC departures timed out. All 15 weather requests completed; stale RKJK remains excluded.

The last run used placement.region=aws:ap-northeast-2, a Seoul-region preference supported by the installed Wrangler and the [Cloudflare placement documentation](https://developers.cloudflare.com/workers/configuration/placement/). This is intended to place processing closer to Korean providers and D1. The diagnostic ingress was IAD; no recognized cf-placement header was present, so actual execution placement and a causal improvement are not established. Placement is not claimed as a fix for the remaining failures. Protected ingestion responses now record only allowlisted ingress/placement codes, never arbitrary headers or credentials.

71 tests pass. Production scheduling remains disabled pending reliable collection and explicit approval. No uninterrupted multiweek history or baseline comparison is claimed.
