# Source audit — 2026-09-03

This document is implementation state, not a claim that the Preview is live.

| Source | Official surface | State | Production |
|---|---|---|---|
| KAC real-time flight search GW | data.go.kr dataset 15160195; base `apis.data.go.kr/B551178/flight-search`; `schFln` documented | DOC_VERIFIED / LIVE_PROBE_REQUIRED | OFF |
| KAC full real-time flight list GW | KAC/data.go.kr 2026-06-12 replacement notice explicitly names `실시간 항공기 운항정보 조회_GW` | replacement existence verified; exact dataset/operation not yet captured | OFF |
| IIAC passenger arrivals | data.go.kr dataset 15095093; `.../StatusOfPassengerFlightsOdp/getPassengerArrivalsOdp` | DOC_VERIFIED / FIXTURE_READY | OFF |
| IIAC passenger departures | not exposed as a verified operation on the current 15095093 page | BLOCKED | OFF |
| KMA METAR/SPECI | API Hub `AmmIwxxmService/getMetar` | DOC_MISMATCH / LIVE_PROBE_REQUIRED | OFF |
| KMA TAF | API Hub `AmmIwxxmService/getTaf` | DOC_VERIFIED / LIVE_PROBE_REQUIRED | OFF |

## Why METAR is DOC_MISMATCH
The API detail still mentions a text field in places, while KMA's 2025-07-25 notice says IWXXM 2023-1 is used from 2025-08-01 and the former `msgText` extension is no longer provided. The adapter therefore reads structured IWXXM fields and never requires `msgText`.

## Live verification gate
A source becomes LIVE_VERIFIED only after an approved-key capture confirms:
1. operation path;
2. response envelope;
3. pagination/total count;
4. field names and nullability;
5. provider status values;
6. timezone/date rollover behavior;
7. source update timestamp/freshness behavior.

No source in this package is production-enabled.
