# Low-cost history policy

- `flight_current`: only the latest meaningful state of a flight instance.
- `flight_events`: insert only when a meaningful field changes; keep 90 days.
- `source_health`: one small row per source, updated by each poll for freshness/error visibility.
- `airport_hourly_metrics`: aggregate by airport/hour/direction, keep ~100 days.
- `route_daily_metrics`: compact daily route aggregates, keep ~400 days.
- `flight_number_daily_metrics`: compact daily flight-number aggregates, keep ~400 days.
- Raw upstream payloads are not permanently stored by default. A short-lived R2 capture can be added only for schema-drift/debugging if needed.

This enforces `poll frequency != flight history write frequency`: an identical poll creates no `flight_current` or `flight_events` write.
