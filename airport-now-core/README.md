# Airport Now Core — P0 preview implementation

Production deploy is intentionally disabled.

## What this package fixes
- one canonical `FlightInstance` model
- provider-specific adapters; provider status is never mixed across sources
- current snapshot vs meaningful change-event separation
- D1 schema for current data + compact historical aggregates
- codeshare operating-flight identity + marketing aliases
- METAR current/history separation with phenomenon-time freshness gating
- official source readiness registry and access blocking

## Source state
- IIAC passenger arrivals: live HTTP 200 fixture verified and ingested with operating-flight dedupe
- IIAC detailed departures (`15112968`): official operation + response fields verified; adapter and D1 ingest are ready; current service key returns `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`
- KAC flight status (`15158625`): official `/depart` + `/arrival` operations and response fields verified; adapters and D1 ingest are ready; current service key returns the same access error
- KMA METAR/SPECI: IWXXM 2023-1 live responses verified across the airport matrix; stale phenomenon time is rejected even when HTTP is 200
- KMA TAF and secondary capabilities: remain disabled until live verification is sufficient

## D1 model
- `flight_current`: latest canonical operating-flight state
- `flight_codeshares`: marketing-flight aliases for search without double-counting
- `flight_events`: only meaningful changes to status/time/terminal/gate/check-in/baggage/delay
- `weather_current`: newest freshness-qualified METAR per ICAO
- `weather_events`: immutable METAR observation history keyed by ICAO + kind + phenomenon time
- `source_health`: last attempt/success/error state
- `airport_hourly_metrics`: hour-level airport delay/cancel aggregates
- `route_daily_metrics`: route daily aggregates
- `flight_number_daily_metrics`: flight-number daily history

## Ingest entry points
`src/ingest/pipeline.js` routes only explicitly supported source ids into provider-specific normalizers and D1 writers. `src/storage/aggregate.js` builds hourly airport, route daily and flight-number daily metrics after a service-date ingest.

## Rules
1. Polling frequency is not write frequency. Unchanged flights do not create change events.
2. Provider observation time wins over ingest time for freshness decisions.
3. No weather-to-delay causality without official cause data.
4. Codeshare uses the operating/master flight identity where the provider exposes it.
5. Unknown status stays UNKNOWN unless the documented scheduled/change times support the 15-minute fallback rule.
6. Production sources, Cron, indexing and production deployment remain disabled until explicit user approval.
