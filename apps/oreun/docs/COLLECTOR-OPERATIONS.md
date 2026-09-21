# R1 Collector Operations

## 현재 Preview 상태

R1 전용 Supabase Preview 프로젝트 `oreun-r1-preview`가 서울 리전(`ap-northeast-2`)에 생성되어 있다.

다른 Supabase 프로젝트는 사용하지 않는다.

현재 실제 적용 상태:
- Data Foundation migration 적용
- Collector Runtime migration 적용
- DB Hardening 적용
- `r1-collector` Edge Function ACTIVE
- 1분 Scheduler Wake Cron ACTIVE
- Retention / Cron history cleanup ACTIVE
- 실제 Roblox Snapshot과 Hourly/Daily Rollup 누적 중

Production 데이터베이스나 운영 도메인은 아직 없다.

## 1. 적용된 migration 순서

1. `20260918000000_r1_data_foundation.sql`
2. `20260919000100_r1_collector_runtime.sql`
3. `20260919000200_r1_db_hardening.sql`
4. `20260919000300_r1_ingestion_invariants.sql`
5. `20260919000400_r1_index_readiness.sql`
6. `20260919000500_r1_existing_grants_lockdown.sql`
7. Preview 전용 scheduler/auth: `supabase/preview-scheduler.example.sql`

신규 R1 환경에서도 위 순서를 유지한다. Scheduler SQL은 프로젝트별 Edge Function URL이 포함되므로 일반 migration으로 자동 적용하지 않는다. `<PROJECT_REF>`를 대상 Preview project ref로 바꾼 뒤 별도 적용한다.

현재 Preview DB는 초기 구축 중 MCP migration patch를 여러 단계로 적용했기 때문에 원격 migration history timestamp와 이 저장소의 **squashed canonical migration filename**이 일치하지 않는다. 신규 환경은 저장소의 canonical SQL을 기준으로 구성하고, 기존 Preview DB에는 같은 DDL을 중복 재적용하지 않는다.

## 2. 인증 경계

앱 서버용 권장 키:
- `SUPABASE_SECRET_KEY`
- legacy fallback: `SUPABASE_SERVICE_ROLE_KEY`

브라우저 읽기:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Server secret은 절대로 `NEXT_PUBLIC_`에 넣지 않는다.

Preview Supabase Edge Collector는 Supabase API Key를 Cron SQL에 복사하지 않는다.

대신:
1. DB가 랜덤 Collector token을 생성
2. token은 Supabase Vault에만 저장
3. pg_cron → pg_net 호출 때 Vault에서 읽어 `x-r1-collector-token` 헤더로 전달
4. Edge Function은 server-role 전용 RPC `r1_validate_collector_token`으로 검증

무토큰 호출은 실제 검증에서 HTTP 401을 반환했다.

## 3. Game / Alias / Collector Target bootstrap

코드 기준 bootstrap 명령:

```bash
npm run db:bootstrap
```

현재 Preview DB에는 이미:
- Games 26
- Aliases 96
- Enabled Collector Targets 26

이 들어가 있다.

초기 target은 longtail 120분이지만 첫 정상 수집 후 현재 CCU에 따라 재분류된다.

- HOT: 5분
- ACTIVE: 15분
- NORMAL: 30분
- LONGTAIL: 120분

## 4. Collector 실행 경로

### Preview 실제 실행

```text
Supabase pg_cron
   ↓ every 1 min scheduler wake
pg_net
   ↓ Vault token
r1-collector Edge Function
   ↓
r1_claim_due_games
   ↓
Roblox Public Games API
   ↓
r1_persist_game_observations
   ↓
game_provider_state + game_snapshots
   ↓
r1_refresh_rollups
```

Cron 자체가 모든 Game을 매 1분 수집하는 것은 아니다.

Cron은 Scheduler를 깨울 뿐이며 실제 due 여부는 각 `collector_targets.next_due_at`이 결정한다.

### 향후 Hosted App 경로

Next 앱에는 보호된:

```text
POST /api/internal/collector/run
```

경로도 준비되어 있다.

이는 Hosted Next Preview/Production이 생겼을 때의 대체 실행기다.

## 5. Concurrency

`r1_claim_due_games`는:

- `FOR UPDATE SKIP LOCKED`
- UUID lease token
- lease expiry

를 사용한다.

두 Runner가 겹쳐도 동일 target이 정상적으로 중복 claim되지 않게 한다.

Persistence도 활성 lease가 일치하는 관측치만 받는다.

## 6. Failure Policy

- HTTP 429 → `Retry-After` 우선
- 일반 provider 오류 → exponential retry
- 특정 Universe 누락 → 다른 Game 저장 유지, 해당 target만 실패
- 3회 이상 연속 실패 → LONGTAIL
- 3회 이상 연속 실패 시 **최소 120분 재시도 floor**
- 한 Batch 오류가 다른 Batch Snapshot을 rollback하지 않음
- 데이터 없음은 0으로 쓰지 않음

### Optional provider relay

`R1_ROBLOX_RELAY_URL`은 운영자가 별도로 검토한 **provider 장애 우회용** read-only endpoint에만 사용할 수 있다.
기본값은 비어 있으며 Preview는 relay를 자동 사용하지 않는다.

- HTTPS endpoint만 허용
- exact universe/rootPlace/current/fetchedAt 재검증
- 허용 source marker 재검증
- stale/invalid/실패 시 current value 생성 금지
- Roblox의 지역별 이용 제한을 우회하는 용도로 사용 금지

### 실제 발견된 지역 제한 예외

Brookhaven:
- universe_id: `1686885941`
- root_place_id: `4924922222`
- Preview region: Seoul / `ap-northeast-2`

2026-09-21 서울 Preview 리전에서 Roblox Public Games API는 이 Universe 대신
`id=0`, `[TITLE UNAVAILABLE]`, `isContentRestricted=true` placeholder를 반환했다.
같은 한국 egress의 Roblox Search/Explore 응답에서도 Brookhaven은 제외됐다.

R1은 이를 일반 provider 장애와 구분해:
- id=0 placeholder 폐기
- 현재 플레이 인원은 `null` 유지
- freshness를 `unavailable`로 유지
- 해외 relay로 현재 CCU를 우회 수집하지 않음
- 6시간 간격으로 제한 해제 여부만 재확인
- 마지막 정상 관측치는 현재값이 아니라 history에만 보존

으로 처리한다.

따라서 Preview의 정상 상태는 **25개 current-state + Brookhaven 1개 KR regional unavailable**이며,
Brookhaven을 억지로 26번째 live current-state로 만드는 것은 release 조건이 아니다.

## 7. Run Accounting

`ingestion_runs`에는:

- requested_count
- success_count
- failure_count
- rate_limit_count
- retry_after_seconds
- latency p50/p95
- error_summary

를 저장한다.

Success는 Roblox가 반환한 row 수가 아니라 **Persistence RPC가 실제 받아들인 row 수**를 기준으로 한다.

따라서 항상 run 상태를 DB 저장 결과와 대조할 수 있다.

## 8. Rollup

성공 수집 후 최근 범위를 다시 계산한다.

### Hourly
- min
- max
- avg
- last
- visits last
- favorites last
- sample count
- expected samples
- coverage ratio
- source provenance
- calculation version

### Daily
동일 원칙으로 일 단위 집계.

현재 version:
- `rollup_v1`

Trend Engine은 단순 Hourly row 존재 여부가 아니라 Rollup 내부 `coverage_ratio`까지 사용한다.

## 9. Retention

- Raw Snapshot: 7일
- Hourly Rollup: 180일
- Daily Rollup: 장기
- cron.job_run_details: 7일 cleanup

Raw Snapshot에는 당시 기대 cadence인 `expected_interval_minutes`를 보존한다.

## 10. Data Provenance

저장 경로:

```text
data_sources
 → ingestion_runs
 → game_provider_state / game_snapshots
 → game_rollups_hourly / daily
 → Trend
```

모든 Roblox 유래 데이터는 Source와 Run까지 추적할 수 있다.

특정 Source를 정책상 삭제해야 할 때 `purge_group`을 기준으로 분리할 수 있다.

## 11. 현재 실검증

Catalog:
- 26개 검증 Game
- 96개 Alias
- 신규 10개 Game도 Roblox place→universe 확인 후 Public Games API 응답을 다시 검증
- 신규 10개 모두 Preview DB current state 저장 성공

Preview DB에서 실제 확인됨:

- 3개 대표 Game live ingest 성공
- Raw → Hourly + Daily Rollup 생성 성공
- 16 target 전체 Collector 실행
- Partial failure 정확한 기록
- Edge 무인증 요청 HTTP 401
- 1분 Scheduler Cron 실제 실행 성공
- 정상 due Game Snapshot 자동 추가
- 반복 실패 Game 2시간 backoff 확인
- Security Advisor 0 findings

## 12. Production 전 필수

Preview 동작이 확인되었어도 Production 전에는 다시 확인한다.

- Production 전용 Supabase 분리 여부
- 실제 Hosted App runtime 선택
- API Rate Limit 장기 측정
- Snapshot 증가량/비용
- Cron/Edge 실패율
- 24H/7D 실제 coverage
- Source purge drill
- Secret rotation
- Public read grants/RLS 재검수


## Sprint 05 Community Analytics Runner

이 Runner는 Game current/history collector와 별도다.

기본:
```bash
R1_ROBLOX_COMMUNITY_ANALYTICS=0
```

검증된 target 등록:
```bash
npm run community:verify -- <universeId> <groupId>
```

검증과 동시에 명시적으로 활성화:
```bash
npm run community:verify -- <universeId> <groupId> --enable
```

수동 1회 실행:
```bash
npm run community:run
```

Hosted runner는 `POST /api/internal/community-analytics/run`을 사용하며
`R1_COMMUNITY_ANALYTICS_TRIGGER_SECRET` 또는 운영 Cron secret이 필요하다.

운영 원칙:
- feature flag/key/verified+enabled target 중 하나라도 없으면 fail closed
- key를 로그/브라우저/DB에 쓰지 않음
- 401/403 target은 revoked + disabled
- no target이면 idle
- observed aggregate만 저장


## Media enrichment refresh

`r1-collector` v5부터 현재값 수집이 끝난 뒤 저빈도 enrichment 1건을 선택적으로 갱신한다.

순서:
1. `game_enrichment.media_fetched_at`이 가장 오래된 Game 선택
2. 6시간 이내 갱신이면 skip
3. Public Games에서 creator/maxPlayers/genre/created/updated 확인
4. Games media endpoint에서 공식 Image/GamePreviewVideo manifest 확인
5. Asset Thumbnail API에서 768×432 이미지 resolve
6. `game_enrichment` upsert

enrichment 오류는 current player ingestion run을 실패시키지 않는다. 응답의 `enrichmentError`로 분리 기록한다.

영상:
- DB에는 video asset ID + poster만 보관
- `r1-game-media`가 Universe↔video ID를 검증
- Asset Delivery에서 일회성 source URL resolve
- `.rbxcdn.com` 외 host면 fail closed
