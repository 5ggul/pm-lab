# Live verification checklist

Use only the manual `airport-now-live-probe` workflow or a local development environment. Never run these probes as production cron.

## Secrets
Repository/local environment only. Never paste values into source or chat.
- `DATA_GO_KR_SERVICE_KEY`: decoded data.go.kr key
- `KMA_API_HUB_KEY`: KMA API Hub key

## First capture order
1. `iiac-arr`
2. `kma-metar-rkpc`, `kma-metar-rksi`
3. `kma-taf-rkpc`, `kma-taf-rksi`
4. `kma-warning`
5. `kma-airinfo-rkpc`
6. `iiac-arr-congestion-t1`
7. `iiac-passenger-announcement`
8. SIGMET/AIRMET only after the core airport-weather fields are stable

## Per fixture
Record without exposing credentials:
- HTTP status/content type
- top-level envelope
- pagination fields
- row count
- field names and nullable fields
- data/source timestamps
- timezone interpretation
- provider status/code list
- schema hash

## Promotion rule
`DOC_VERIFIED -> LIVE_VERIFIED` requires a real captured response plus passing adapter tests. A successful HTTP 200 alone is insufficient.

## KAC special rule
Do not create `get...`, `/list`, `/status`, or any other guessed operation path. The full-list GW remains blocked until the exact operation comes from official Swagger/replacement mapping or a verified approved-key capture.
