# Source audit — 2026-09-03

Implementation state only. Nothing here means the public Preview is live. Production remains OFF.

| Source / capability | Official evidence | Current implementation state | Production |
|---|---|---|---|
| KAC real-time flight search GW | data.go.kr `15160195`, base `apis.data.go.kr/B551178/flight-search`, `schFln`, 14 KAC airports, 5,000/day dev | DOC_VERIFIED; exact operation/response field map still needs approved-key capture | OFF |
| KAC full real-time flight list GW | 2026-06-12 KAC/data.go.kr replacement notice explicitly names `실시간 항공기 운항정보 조회_GW` | BLOCKED until replacement XLSX/Swagger or approved-key operation is captured; never guess path | OFF |
| IIAC passenger arrivals | data.go.kr `15095093`, `StatusOfPassengerFlightsOdp/getPassengerArrivalsOdp`, 1,000/day dev | documented field adapter + doc-shape tests; live fixture still required | OFF |
| IIAC passenger departures | no verified departure operation exposed on current `15095093` documentation | BLOCKED | OFF |
| KMA METAR/SPECI | API Hub `AmmIwxxmService/getMetar` | structured IWXXM adapter; live fixture required | OFF |
| KMA TAF | API Hub `AmmIwxxmService/getTaf` | request builder ready; live fixture required | OFF |
| KMA airport warning | API Hub `AmmService/getWarning` | request/normalization contract ready; no delay-cause inference | OFF |
| KMA takeoff forecast | API Hub `AirInfoService/getAirInfo` | request/normalization contract ready | OFF |
| KMA SIGMET/AIRMET | API Hub `AmmIwxxmService/getSigmet`, `getAirmet` | request builders ready; never assign as a flight delay cause | OFF |
| IIAC arrival-hall congestion | data.go.kr `15095061`, `StatusOfArrivals/getArrivalsCongestion` | raw waiting-count adapter ready; no invented congestion grade | OFF |
| IIAC departure-gate congestion | data.go.kr `15148225`; official page documents T1/P01 and ~1 minute cadence | operation/field live capture required; T2 must not be claimed as currently provided | OFF |
| IIAC passenger announcement | `passgrAnncmt/getPassgrAnncmt` and 2025-11 field-change notice | request builder ready; current fields require live capture | OFF |
| KAC airport process time GW | data.go.kr `15158950`, 5 domestic airports, four process segments | capability registered; operation/envelope live capture required | OFF |
| KAC real-time parking GW | official data.go.kr related dataset/replacement service exists, updated 2026-05-27 | BLOCKED until dataset id + exact operation captured | OFF |

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
5. provider-native status values;
6. timezone and midnight rollover behavior;
7. source update timestamp/freshness behavior;
8. codeshare/master-flight identity where applicable;
9. stale/error behavior;
10. adapter tests using a captured fixture.

No source or capability is production-enabled.
