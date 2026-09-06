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
- IIAC passenger arrivals: live HTTP 200 fixture verified; current-main codeshare dedupe, D1 bulk ingest, marketing-flight alias storage/search are implemented. Production remains OFF until Worker + D1 deployment verification.
- IIAC passenger departures: official dataset `15112968` and operation are documented, but the currently registered service key returns `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`; access is blocked.
- KAC real-time flight status: replacement dataset `15158625` and departure/arrival operations are documented, but the currently registered service key returns `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`; access is blocked.
- KMA METAR/SPECI: live IWXXM 2023-1 responses verified; current-main parser, phenomenon-time freshness gate, `weather_current` + immutable `weather_events`, and freshness-gated read API are implemented. Production remains OFF until Worker + D1 deployment verification.
- KMA TAF and other additional aviation-weather capabilities require separate authorization/live verification before use.

## Read API bridge
- `src/worker.js` exposes read-only browser endpoints with CORS for the preview frontend.
- Flight-number search resolves operating and marketing/codeshare aliases stored in D1.
- `/api/weather/{ICAO}` only returns a current row when its METAR phenomenon time is within the request-time freshness window.
- D1-backed routes return `D1_NOT_BOUND` until a preview database is explicitly bound.
- `docs/airport-now-preview/runtime-config.json` is the single frontend switch for the deployed Worker URL. Keep `liveReadApiEnabled` false until Worker + D1 verification is complete.

## Rules
1. Polling frequency is not write frequency. Unchanged polls update freshness/source health only.
2. No weather-to-delay causality without official cause data.
3. Codeshare uses the operating/master flight identity where the provider exposes it.
4. Unknown status stays UNKNOWN.
5. Stale weather must be rejected both at ingest time and read time.
6. Production sources and scheduled ingestion remain disabled until user approval + live verification.
