# Nationwide one-shot ingest

This is a local/CI collector. It does not expose an ingest HTTP endpoint, deploy a Worker, create a remote database, or enable a scheduled handler. `wrangler.local.jsonc` uses an intentionally local-only database identity. The public preview stays noindex with live runtime configuration OFF.

## Run

Use Node 24 and `npm ci`, then `npm run ingest:once` from `airport-now-core`. Existing process variables, `.env`, or `.dev.vars` are used. The current repository secrets are `DATA_GO_KR_SERVICE_KEY`, `DATAKEY`, and `KMAKEY`. The collector also accepts the canonical `KMA_API_HUB_KEY` variable. Secret values are never written to capture files or logs.

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

## Remaining deployment gate

The inspected Cloudflare account had no Airport Now D1 binding; only an unrelated D1 database was listed. The named `airport-now-preview-core` Worker also does not exist (Cloudflare code 10007). No remote D1 was created or modified. The runtime switch must remain OFF until an actual deployed Worker/D1 endpoint and frontend hydration have been verified. Production scheduled ingest continues to throw `SCHEDULED_INGEST_DISABLED_UNTIL_USER_APPROVAL`.

Official schemas: [KAC flight status](https://www.data.go.kr/data/15158625/openapi.do), [IIAC detail flight status](https://www.data.go.kr/data/15112968/openapi.do). The current registry is `src/source-registry.js`; the old search-only KAC stubs in `core.js` are legacy and are not the nationwide collector.
