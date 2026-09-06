# Airport Now Core — P0 preview implementation

Production deploy and scheduled ingestion are intentionally disabled.

## What this package fixes
- one canonical `FlightInstance` model
- provider-specific adapters; provider status is never mixed across sources
- current snapshot vs meaningful change-event separation
- D1 schema for current data + compact historical aggregates
- official source readiness registry
- live-blocking for operations/fields that are not verified or not authorized

## Current source state
- IIAC passenger arrivals: live HTTP 200 fixture verified; production remains OFF until the current-main ingest/codeshare-dedupe path is integrated.
- IIAC passenger departures: official dataset `15112968` and operation are documented, but the currently registered service key returns `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`; access is blocked.
- KAC real-time flight status: replacement dataset `15158625` and departure/arrival operations are documented, but the currently registered service key returns `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`; access is blocked.
- KMA METAR/SPECI: live IWXXM 2023-1 responses verified; stale HTTP 200 observations must be excluded using phenomenon time. Production remains OFF.
- KMA TAF and other additional aviation-weather capabilities require separate authorization/live verification before use.

## Read API bridge
- `src/worker.js` exposes read-only browser endpoints with CORS for the preview frontend.
- D1-backed routes return `D1_NOT_BOUND` until a preview database is explicitly bound.
- `docs/airport-now-preview/runtime-config.json` is the single frontend switch for the deployed Worker URL. Keep `liveReadApiEnabled` false until Worker + D1 verification is complete.

## Rules
1. Polling frequency is not write frequency. Unchanged polls update freshness/source health only.
2. No weather-to-delay causality without official cause data.
3. Codeshare uses the operating/master flight identity where the provider exposes it.
4. Unknown status stays UNKNOWN.
5. Production sources and scheduled ingestion remain disabled until user approval + live verification.
