# Source audit — 2026-09-04

Implementation state only. Nothing here means the public Preview is live. Production remains OFF.

| Source / capability | Official evidence | Current implementation state | Production |
|---|---|---|---|
| KAC real-time flight search GW | data.go.kr `15160195`, base `apis.data.go.kr/B551178/flight-search`, `schFln`, 14 KAC airports, 5,000/day dev | DOC_VERIFIED; exact operation/response field map still needs an accessible approved-key capture | OFF |
| KAC full real-time flight list GW | 2026-06-12 KAC/data.go.kr replacement notice explicitly names `실시간 항공기 운항정보 조회_GW` | BLOCKED until replacement XLSX/Swagger or approved-key operation is captured; never guess path | OFF |
| IIAC passenger arrivals | data.go.kr `15095093`, `StatusOfPassengerFlightsOdp/getPassengerArrivalsOdp`, 1,000/day dev | **LIVE CAPTURE CONFIRMED 2026-09-04** via IPv4 curl. HTTP 200. Sanitized live fixture, codeshare/duplicate collapse, alias search and D1 bulk-ingest tests implemented. Final freshness/error checks remain before `LIVE_VERIFIED`. | OFF |
| IIAC passenger departures | no verified departure operation exposed on current `15095093` documentation | BLOCKED | OFF |
| KMA METAR/SPECI | API Hub `AmmIwxxmService/getMetar` | **LIVE CAPTURE CONFIRMED 2026-09-04** for RKSI, RKPC, RKSS, RKPK; HTTP 200. Actual JSON envelope contains `item[].metarMsg` with IWXXM 2023-1 XML. Live parser + tests implemented. Final stale/error checks remain before `LIVE_VERIFIED`. | OFF |
| KMA TAF | API Hub `AmmIwxxmService/getTaf` | HTTP 403 with server message that separate API utilization application is required. Request builder retained, capability disabled until approval. | OFF |
| KMA airport warning | API Hub `AmmService/getWarning` | HTTP 403; separate utilization permission required. No delay-cause inference. | OFF |
| KMA takeoff forecast | API Hub `AirInfoService/getAirInfo` | RKSI/RKPC HTTP 403; separate utilization permission required. | OFF |
| KMA SIGMET | API Hub `AmmIwxxmService/getSigmet` | endpoint documented; current GitHub runners timed out before HTTP response, so authorization state remains inconclusive | OFF |
| KMA AIRMET | API Hub `AmmIwxxmService/getAirmet` | HTTP 403; separate utilization permission required | OFF |
| IIAC arrival-hall congestion | data.go.kr `15095061`, `StatusOfArrivals/getArrivalsCongestion` | IPv4 connectivity confirmed, but current key returned HTTP 403 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`; separate utilization registration/authorization required | OFF |
| IIAC departure-gate congestion | data.go.kr `15148225`; official page documents T1/P01 and ~1 minute cadence | operation/field live capture required; T2 must not be claimed as currently provided | OFF |
| IIAC passenger announcement | `passgrAnncmt/getPassgrAnncmt` and 2025-11 field-change notice | request builder ready; current GitHub runner timed out before HTTP response, so live authorization/fields remain inconclusive | OFF |
| KAC airport process time GW | data.go.kr `15158950`, 5 domestic airports, four process segments | capability registered; operation/envelope live capture required | OFF |
| KAC real-time parking GW | official data.go.kr related dataset/replacement service exists, updated 2026-05-27 | BLOCKED until dataset id + exact operation captured | OFF |

## Verified IIAC passenger-arrival response facts — 2026-09-04
- The repository `DATAKEY` secret is accepted by Actions. Government API reachability varies by GitHub runner region, so live verification uses IPv4 curl and keeps transport errors separate from authorization errors.
- Successful response content type: `application/json;charset=UTF-8`.
- Header: `resultCode=00`, `resultMsg=NORMAL SERVICE.`.
- Envelope: `response.body.items[]` directly. The successful body did not include `pageNo`, `numOfRows`, or `totalCount` metadata.
- Even though the successful probe requested `numOfRows=20`, the response returned **1,184 raw rows**; ingestion must not assume ordinary pagination behavior.
- Raw-row breakdown: `Slave=630`, `Master=294`, no codeshare marker `=260`.
- After grouping by operating flight + origin + scheduled time: **553 operating flights**.
- The 1,184 rows reconcile exactly to **553 operating flights + 630 marketing aliases + 1 duplicate operating row**.
- The one non-codeshare duplicate observed was `IT602`: one current row had `remark=도착`, gate 114, carousel 9 and estimated 00:05; another row had no remark, no gate, carousel 8 and estimated 23:30. The collapse rule therefore explicitly prefers an active-status/more-complete row instead of relying on source order.
- Observed provider statuses: `도착=616`, `지연=68`, `착륙=9`, `결항=5`, blank status `=486` across raw rows.
- Observed terminal IDs: `P03=719`, `P01=284`, `P02=181` across raw rows.
- Live codeshare example: operating flight `CX426` accompanied by marketing aliases `QF8233` and `AA8905`.
- Live midnight rollover example: scheduled `23:30`, estimated `00:05`; canonical time becomes next-day `00:05 +09:00` and delay is 35 minutes.
- Canonical storage uses one operating flight row plus `flight_codeshares` aliases, preventing codeshares from inflating delay-rate denominators while allowing marketing-flight-number search.
- D1 ingest uses JSON expansion (`json_each`) and compares current rows first. A complete IIAC snapshot can be processed in about five D1 queries rather than one query per flight; unchanged flights do not generate current/history writes.

## Verified KMA METAR response facts — 2026-09-04
- `KMAKEY` is accepted by GitHub Actions.
- Successful live HTTP 200 captures: RKSI (Incheon), RKPC (Jeju), RKSS (Gimpo), RKPK (Gimhae).
- Response content type: `application/json;charset=UTF-8`.
- Header: `resultCode=00`, `resultMsg=NORMAL_SERVICE`.
- Envelope: `response.body.items.item[]`.
- Each item currently exposes `icaoCode`, `airportName`, `metarMsg`; wrapper identity fields were empty in captured RKSI/RKPC responses, so canonical airport identity is parsed from IWXXM `aixm:designator` rather than trusting the wrapper.
- `metarMsg` is IWXXM 2023-1 XML.
- Captured RKSI example: designator RKSI, 30°C, dew point 15°C, QNH 1012 hPa, wind 030° at 10 kt.
- Captured RKPC example: designator RKPC, 27°C, dew point 19°C, QNH 1008 hPa, wind 080° at 25 kt, gust 38 kt, prevailing visibility 10,000 m.
- Canonical storage converts wind knots to m/s; visibility remains meters; temperature °C and QNH hPa.
- TAF, airport warning, takeoff forecast and AIRMET currently return HTTP 403 because those sub-APIs have not yet been separately approved on the KMA account. This is an authorization scope issue, not a bad `KMAKEY`.

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
