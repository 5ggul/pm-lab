# R1 Collector Operations

## 현재 상태
코드와 SQL 실행 계층은 준비되어 있지만 **R1 전용 Supabase 프로젝트에는 아직 적용하지 않았다.**
현재 계정의 다른 Supabase 프로젝트(밈 레이더)는 사용하지 않는다.

## 1. 전용 DB 생성 후 migration
순서:
1. `20260918_r1_data_foundation.sql`
2. `20260919_r1_collector_runtime.sql`
3. Security/Performance Advisor 확인

새 migration은 `collector_targets`, lease 기반 claim RPC, observation persistence RPC, 실패 재예약 RPC, hourly/daily rollup RPC, retention RPC를 만든다.

## 2. 환경변수
서버 전용:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` 권장
- `SUPABASE_SERVICE_ROLE_KEY`는 legacy fallback
- `R1_COLLECTOR_TRIGGER_SECRET` 또는 `CRON_SECRET`

`sb_secret_...` 또는 service-role 값은 절대 `NEXT_PUBLIC_` 변수로 만들지 않는다.

## 3. Game/alias/target bootstrap
```bash
npm run db:bootstrap
```

이 명령은 코드에서 검증된 Game identity와 alias를 upsert하고 모든 게임을 최초 longtail(120분) target으로 등록한다. 첫 성공 수집 후 CCU에 따라 HOT 5분 / ACTIVE 15분 / NORMAL 30분 / LONGTAIL 120분으로 자동 재분류된다.

## 4. Collector 수동 실행
```bash
npm run collector:run
```

또는 hosted app의:
```text
POST /api/internal/collector/run
Authorization: Bearer <R1_COLLECTOR_TRIGGER_SECRET>
```

Trigger secret이 없거나 DB가 설정되지 않으면 실행하지 않고 503을 반환한다.

## 5. Concurrency
`r1_claim_due_games`는 `FOR UPDATE SKIP LOCKED`와 180초 lease를 사용한다. 동일 시각에 두 runner가 시작되어도 같은 target을 정상적으로 두 번 claim하지 않는다.

성공 persistence는 active lease와 일치할 때만 처리한다. runner가 lease를 잃은 뒤 늦게 응답하면 stale observation을 저장하지 않는다.

## 6. Failure policy
- Roblox 429: `Retry-After` 우선
- 일반 provider 오류: 60초부터 지수 backoff, 최대 1시간
- 3회 연속 실패: longtail cadence로 강등
- 한 batch 실패가 다른 batch의 정상 Snapshot을 rollback하지 않음
- provider response에서 특정 universe가 누락돼도 나머지는 저장

## 7. Rollup
Collector 성공 후 최근 2시간 Hourly와 해당 날짜 Daily rollup을 갱신한다.

별도로 Supabase Cron을 켤 경우 `supabase/cron/r1_rollup_jobs.sql` 예시를 사용할 수 있다. Cron은 Roblox 외부 호출이 아니라 DB-local rollup/retention만 담당한다.

현재 Supabase 권고상 Cron job은 짧게 유지하고 과도한 동시 실행을 피해야 한다. `cron.job_run_details`는 자동 정리되지 않으므로 예시 SQL은 7일 이전 실행기록도 정리한다.

## 8. Retention
- Raw Snapshot: 7일
- Hourly: 180일
- Daily: 장기
- 결측: 0으로 보정하지 않음
- Snapshot에는 당시 기대 수집 간격(`expected_interval_minutes`)을 저장해 rollup coverage 계산 근거를 남김

## 9. Data provenance
관측치는:
`data_source_id → ingestion_run_id → snapshot/current state`
로 추적한다.

Rollup은 `source_data_source_id`와 `calculation_version=rollup_v1`을 남긴다. Roblox source 정책 변화 시 `purge_group` 기준으로 원천 데이터를 선택적으로 제거할 수 있다.

## 10. 운영 전 필수 확인
- R1 전용 Supabase project 여부
- migration 실제 적용 성공
- RLS / grants advisor 결과
- secret key가 client bundle에 없는지
- bootstrap row count
- Collector 200 / 429 / partial failure 실검증
- ingestion_runs에 latency와 success/failure count 기록
- raw → hourly → daily 값 대조
- cron 실행시간과 실패율
