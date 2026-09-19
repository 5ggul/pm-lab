# R1 Collector Operations

## 현재 Preview 상태

R1 전용 Supabase Preview 프로젝트 `oreun-r1-preview`가 서울 리전(`ap-northeast-2`)에 생성되어 있다.

다른 Supabase 프로젝트는 사용하지 않는다.

현재 실제 적용 상태:
- Data Foundation migration 적용
- Collector Runtime migration 적용
- DB Hardening 적용
- `r1-collector` Edge Function ACTIVE
- 5분 Preview Collector Cron ACTIVE
- Retention / Cron history cleanup ACTIVE
- 실제 Roblox Snapshot과 Hourly/Daily Rollup 누적 중

Production 데이터베이스나 운영 도메인은 아직 없다.

## 1. 적용된 migration 순서

1. `20260918_r1_data_foundation.sql`
2. `20260919_r1_collector_runtime.sql`
3. `20260919_r1_db_hardening.sql`
4. Preview 전용 scheduler/auth SQL

신규 R1 환경에서도 같은 순서를 유지한다.

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
- Games 16
- Aliases 60
- Enabled Collector Targets 16

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
   ↓ every 5 min
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

Cron 자체가 모든 Game을 매 5분 수집하는 것은 아니다.

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

### 실제 발견된 Provider 예외

Brookhaven:
- universe_id: `1686885941`
- root_place_id: `4924922222`

Game identity는 유효하지만 현재 Public Games API가 이 Universe를 요청했을 때 정상 row 대신 zero-id placeholder를 포함하고 실제 Universe row를 생략하는 현상이 관찰됐다.

R1은:
- id=0 placeholder 폐기
- Brookhaven Snapshot 생성 금지
- failure count 기록
- longtail retry 적용

으로 처리한다.

실제 Preview 검증에서 failure_count 4 이후 다음 재시도가 정확히 2시간 뒤로 이동했다.

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

Preview DB에서 실제 확인됨:

- 3개 대표 Game live ingest 성공
- Raw → Hourly + Daily Rollup 생성 성공
- 16 target 전체 Collector 실행
- Partial failure 정확한 기록
- Edge 무인증 요청 HTTP 401
- 5분 Cron 실제 실행 성공
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
