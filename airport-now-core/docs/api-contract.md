# Read API contract (preview / future Worker)

All read surfaces must come from D1 `flight_current` and aggregate tables. UI code must not keep a second flight array.

## Search
`GET /api/search/flights?q=KE123&date=2026-09-03`
- exact canonical/marketing/master flight-number lookup for the service date
- no arbitrary fuzzy query over generated URLs
- unknown flight returns an empty result, not a fabricated page

## Airport board
`GET /api/airports/CJU/flights?direction=DEPARTURE&date=2026-09-03`
Optional canonical `status` filter.

## Nationwide irregular operations
`GET /api/now/delays?date=2026-09-03`
`GET /api/now/cancellations?date=2026-09-03`
The displayed total and the returned rows come from the same query/model.

## Flight-number history
`GET /api/flights/KE123/history`
Reads compact `flight_number_daily_metrics`; evergreen flight-number hubs only pass the index gate when history sample requirements are met.

## No index
Search results, filters, query parameters, raw API responses and date-specific flight instances are never index candidates.
