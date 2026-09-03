# Airport Now Core — P0 preview implementation

Production deploy is intentionally disabled.

## What this package fixes
- one canonical `FlightInstance` model
- provider-specific adapters; provider status is never mixed across sources
- current snapshot vs meaningful change-event separation
- D1 schema for current data + compact historical aggregates
- official source readiness registry
- live-blocking for operations/fields that are not verified

## Source state
- KAC flight-search GW: official dataset and quota verified, **operation path/response field map still requires approved-key fixture**
- IIAC passenger arrivals: documented endpoint/fields implemented
- IIAC departures: blocked until an official operation is verified
- KMA METAR/SPECI: structured IWXXM fields supported; `msgText` is not required
- KMA TAF: request builder ready, live fixture required

## Rules
1. Polling frequency is not write frequency. Unchanged polls update freshness/source health only.
2. No weather-to-delay causality without official cause data.
3. Codeshare uses the operating/master flight identity where the provider exposes it.
4. Unknown status stays UNKNOWN.
5. Production sources remain disabled until user approval + live verification.
