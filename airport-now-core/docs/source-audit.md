# Source audit — 2026-09-04

Implementation state only. Nothing here means the public Preview is live. Production remains OFF.

| Source / capability | Official evidence | Current implementation state | Production |
|---|---|---|---|
| KAC real-time flight search GW | data.go.kr `15160195`, base `apis.data.go.kr/B551178/flight-search`, `schFln`, 14 KAC airports, 5,000/day dev | DOC_VERIFIED; exact operation/response field map still needs an accessible approved-key capture | OFF |
| KAC full real-time flight list GW | 2026-06-12 KAC/data.go.kr replacement notice explicitly names `실시간 항공기 운항정보 조회_GW` | BLOCKED until replacement XLSX/Swagger or approved-key operation is captured; never guess path | OFF |
| IIAC passenger arrivals | data.go.kr `15095093`, `StatusOfPassengerFlightsOdp/getPassengerArrivalsOdp`, 1,000/day dev | **LIVE CAPTURE CONFIRMED 2026-09-04** via IPv4 curl. HTTP 200, 1,184 rows returned in one `items` array, live codeshare/status/terminal values captured. Batch adapter now collapses Master/Slave rows into one operating flight plus searchable aliases. Final freshness/error checks remain before `LIVE_VERIFIED`. | OFF |
| IIAC passenger departures | no verified departure operation exposed on current `15095093` documentation | BLOCKED | OFF |
| KMA METAR/SPECI | API Hub `AmmIwxxmService/getMetar` | **LIVE CAPTURE CONFIRMED 2026-09-04** for RKSI and RKPC, HTTP 200 `NORMAL_SERVICE`; actual JSON envelope contains `item[].metarMsg` with IWXXM 2023-1 XML. Live parser + tests added. Final stale/error/code-list checks remain before promoting source state to `LIVE_VERIFIED`. | OFF |
| KMA TAF | API Hub `AmmIwxxmService/getTaf` | request builder ready; live fixture required | OFF |
| KMA airport warning | API Hub `AmmService/getWarning` | request/normalization contract ready; no delay-cause inference | OFF |
| KMA takeoff forecast | API Hub `AirInfoService/getAirInfo` | request/normalization contract ready | OFF |
| KMA SIGMET/AIRMET | API Hub `AmmIwxxmService/getSigmet`, `getAirmet` | request builders ready; never assign as a flight delay cause | OFF |
| IIAC arrival-hall congestion | data.go.kr `15095061`, `StatusOfArrivals/getArrivalsCongestion` | Network access works via IPv4 curl, but current key returns HTTP 403 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`; this API requires separate utilization registration/authorization before live use. | OFF |
| IIAC departure-gate congestion | data.go.kr `15148225`; official page documents T1/P01 and ~1 minute cadence | operation/field live capture required; T2 must not be claimed as currently provided | OFF |
| IIAC passenger announcement | `passgrAnncmt/getPassgrAnncmt` and 2025-11 field-change notice | request builder ready; current fields require live capture | OFF |
| KAC airport process time GW | data.go.kr `15158950`, 5 domestic airports, four process segments | capability registered; operation/envelope live capture required | OFF |
| KAC real-time parking GW | official data.go.kr related dataset/replacement service exists, updated 2026-05-27 | BLOCKED until dataset id + exact operation captured | OFF |

## Verified IIAC passenger-arrival response facts — 2026-09-04
- The same repository secret that previously timed out is valid; forcing IPv4/curl produced HTTP 200.
- Response content type: `application/json;charset=UTF-8`.
- Header: `resultCode=00`, `resultMsg=NORMAL SERVICE.`.
- Envelope: `response.body.items[]` directly. The captured body did not include `pageNo`, `numOfRows`, or `totalCount` metadata.
- Even though the probe requested `numOfRows=20`, the response returned 1,184 rows, so ingestion must not assume normal pagination behavior.
- Observed provider statuses: `도착`, `지연`, `결항`, `착륙`.
- Observed codeshare values: `Master`, `Slave`, `null`.
- Observed terminal IDs: `P01`, `P02`, `P03`.
- Live example of codeshare collapse: operating flight `CX426` was accompanied by marketing aliases `QF8233` and `AA8905`.
- Live example of midnight rollover: scheduled `23:30`, estimated `00:05`; canonical time must become next-day `00:05 +09:00`, not same-day or UTC-labelled local time.
- The canonical model stores one operating flight row and separate marketing-flight aliases so delay-rate denominators are not inflated by codeshares.

## Verified KMA METAR response facts — 2026-09-04
- Auth secret was accepted by GitHub Actions and both RKSI/RKPC calls returned HTTP 200.
- Response content type: `application/json;charset=UTF-8`.
- Header: `resultCode=00`, `resultMsg=NORMAL_SERVICE`.
- Envelope: `response.body.items.item[]`.
- Each item currently exposes `icaoCode`, `airportName`, `metarMsg`; the first two were empty in the captured responses, so canonical airport identity must be parsed from IWXXM `aixm:designator` rather than trusting those empty wrapper fields.
- `metarMsg` is IWXXM 2023-1 XML.
- Captured RKSI: designator RKSI, 30°C, dew point 15°C, QNH 1012 hPa, wind 030° at 10 kt.
- Captured RKPC: designator RKPC, 27°C, dew point 19°C, QNH 1008 hPa, wind 080° at 25 kt, gust 38 kt, prevailing visibility 10,000 m.
- Canonical storage converts wind knots to m/s; visibility remains meters; temperature °C and QNH hPa.

## Official pages
- KAC flight search: https://www.data.go.kr/data/15160195/openapi.do
- KAC replacement notice: https://www.data.go.kr/bbs/ntc/selectNotice.do?originId=NOTICE_0000000004750
- KMA aviation API: https://apihub.kma.go.kr/apiList.do?seqApi=14&seqApiSub=260

## Live verification gate
A source can become `LIVE_VERIFIED` only after an approved-key capture confirms all of:
1. exact operation path;
2. response envelope and content type;
3. pagination/total-count behavior;
4. field names, nullability and code lists;
5. provider-native status values where applicable;
6. timezone and midnight rollover behavior;
7. source update timestamp/freshness behavior;
8. codeshare/master-flight identity where applicable;
9. stale/error behavior;
10. adapter tests using a captured fixture.

No source or capability is production-enabled.
