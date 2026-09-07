# Airport Now Core — P0 preview implementation

The preview Worker and D1 are deployed. Continuous collection is scheduled every ten minutes through Cloudflare Cron; reliability is under observation and public indexing remains disabled.

## What this package fixes
- one canonical `FlightInstance` model
- provider-specific adapters; provider status is never mixed across sources
- current snapshot vs meaningful change-event separation
- D1 schema for current data + compact historical aggregates
- official source readiness registry
- live-blocking for operations/fields that are not verified or not authorized

## Current source state
- IIAC arrivals and departures: verified live with existing keys, deployed preview Worker ingestion and remote D1 storage completed.
- KAC nationwide arrivals/departures (dataset 15158625): verified live with existing keys. The earlier service-key error report is obsolete; intermittent upstream timeouts remain an operational concern.
- KMA METAR: all 15 stations queried; stale RKJK observations are excluded. Request-time freshness remains enforced.
- Preview Worker: https://airport-now-preview-core.dhkim8704.workers.dev . Runtime reads are enabled after PR #22; continuous collection is configured through a private Cloudflare clock; GitHub Actions remains the manual recovery path.
- The native clock runs four flight sources and fifteen METAR targets independently with bounded retries. Manual GitHub recovery also supports an alternate acquisition path. Stored events record meaningful changes; collection_runs records freshness coverage. See [continuous collection operations](docs/continuous-collection.md).
- Detailed evidence and limitations: [nationwide one-shot verification](docs/nationwide-one-shot.md).
- TAF and additional aviation-weather products remain outside the verified scope.

## Read API bridge
- `src/worker.js` exposes read-only browser endpoints with CORS for the preview frontend.
- Flight-number search resolves operating and marketing/codeshare aliases stored in D1.
- `/api/weather/{ICAO}` only returns a current row when its METAR phenomenon time is within the request-time freshness window.
- D1-backed routes return `D1_NOT_BOUND` until a preview database is explicitly bound.
- `docs/airport-now-preview/runtime-config.json` is the single frontend switch for the deployed Worker URL. It is enabled following Worker + D1 and browser verification.

## Rules
1. Polling frequency is not write frequency. Unchanged polls update freshness/source health only.
2. No weather-to-delay causality without official cause data.
3. Codeshare uses the operating/master flight identity where the provider exposes it.
4. Unknown status stays UNKNOWN.
5. Stale weather must be rejected both at ingest time and read time.
6. The core Worker does not run its own cron. The private collector clock owns the ten-minute schedule; production-domain release and indexing remain gated on measured reliability.
