# Read API contract (preview / future Worker)

All read surfaces come from D1 current/aggregate tables. UI code must not keep a second flight or capability array.

## Flight search
`GET /api/search/flights?q=KE123&date=2026-09-03`
Exact canonical/marketing/master flight number for the service date. Unknown flight returns an empty result, never a fabricated URL.

## Airport boards
`GET /api/airports/CJU/flights?direction=DEPARTURE&date=2026-09-03`
Optional canonical `status` filter.

## Nationwide irregular operations
`GET /api/now/delays?date=2026-09-03`
`GET /api/now/cancellations?date=2026-09-03`
Displayed total and rows must come from the same model.

## Flight history
`GET /api/flights/KE123/history`
Reads compact `flight_number_daily_metrics`.

## Capability modules
`GET /api/weather/RKPC`
`GET /api/warnings/RKPC`
`GET /api/airports/ICN/congestion`
`GET /api/airports/CJU/parking`
`GET /api/airports/CJU/process-time`

Capability responses include `available`, `reason`, `freshnessMinutes`, `dataAsOf`, `results`. UI must hide a module when `available=false` or render a concise official-data-unavailable state; never fill a missing module with estimates.

## No-index surfaces
Search results, filters, query parameters, raw API responses and date-specific flight instances are not index candidates.
