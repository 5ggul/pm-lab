# R1 Database Schema

## 실제 Preview DB

- Project: `oreun-r1-preview`
- Region: Seoul (`ap-northeast-2`)
- Production DB와 분리
- 기존 다른 Supabase project와 분리

적용 migration:
1. `20260918000000_r1_data_foundation.sql`
2. `20260919000100_r1_collector_runtime.sql`
3. `20260919000200_r1_db_hardening.sql`
4. Preview scheduler/auth layer

## Identity

`games.universe_id`가 Game의 핵심 ID다.

`root_place_id`는 실제 Roblox launch place이고 `canonical_slug`는 URL 표현이다.

게임명이 바뀌어도 Universe identity는 바뀌지 않는다.

과거 slug는 `game_slug_history`에 보존한다.

## Search

`game_aliases`:
- alias
- normalized_alias
- language
- alias type

Index:
- prefix B-tree
- pg_trgm GIN

`pg_trgm`은 public이 아니라 `extensions` schema에 둔다.

## Source / Provenance

### data_sources
Provider/endpoint/stability/auth/purge group.

### ingestion_runs
Collector 실행 단위:
- requested
- success
- failure
- rate limit
- latency
- errors
- started/finished

### game_provider_state
각 Game의 마지막 정상 Provider Observation.

### game_snapshots
Raw observation:
- universe
- captured/fetched time
- playing/visits/favorites
- data source
- ingestion run
- raw/derived
- expected collector interval

Primary key:
`(universe_id, captured_at)`

0과 NULL은 다르다.

## Adaptive Collector

### collector_targets

- universe_id
- tier
- cadence_minutes
- next_due_at
- failure_count
- last_success/failure
- last_error
- lease_token
- leased_until
- enabled

Claim function:
`r1_claim_due_games`

Concurrency:
- `FOR UPDATE SKIP LOCKED`
- lease ownership

Persistence:
`r1_persist_game_observations`

Failure:
`r1_mark_targets_failed`

3회 이상 반복 실패는 LONGTAIL로 강등되고 최소 120분 retry floor가 적용된다.

## Rollup

### game_rollups_hourly
- min/max/avg/last
- visits/favorites last
- sample_count
- expected_samples
- coverage_ratio
- source_data_source_id
- calculation_version

### game_rollups_daily
동일 원칙의 일 단위 집계.

Function:
`r1_refresh_rollups`

현재 version:
`rollup_v1`

## Trend

### trend_scores

Score 하나만 저장하지 않는다.

- total
- absolute component
- relative component
- baseline component
- coverage component
- update component
- future interest component
- confidence
- calculation_version
- component payload

현재 Trend semantic version:
`trend_v1_1`

## Quality

### data_quality_flags

Provider identity mismatch나 수집 이상을 기록한다.

예:
- root_place mismatch
- source anomalies

## RLS

모든 public application table에 RLS를 사용한다.

Public read 허용:
- games
- game_aliases
- game_provider_state
- Hourly/Daily Rollup
- trend_scores

내부 전용:
- collector_targets
- ingestion_runs
- raw snapshots
- data_sources
- quality flags
- slug history

내부 전용 테이블에는 explicit deny policy도 둔다.

## RPC Security

Collector RPC는:
- PUBLIC EXECUTE 없음
- anon 없음
- authenticated 없음
- server role만 허용

Preview Vault token validation RPC도 동일하다.

## Default Privileges

향후 public schema 신규 object가 자동으로 Data API에 노출되지 않게 default privileges를 revoke했다.

새 migration은 필요한 역할 권한을 **명시적으로 grant**해야 한다.

## Index Hardening

Supabase Performance Advisor가 지적한 FK covering index를 추가했다.

현재 남은 Advisor INFO는 새 DB에서 아직 사용 통계가 없는 index의 `unused_index`뿐이다.

이 정보만으로 검색/FK index를 삭제하지 않는다.

## Retention

- Raw Snapshot: 7일
- Hourly: 180일
- Daily: 장기
- Cron history: 7일 cleanup

## Preview Scheduler

DB 내부:
- pg_cron
- pg_net
- Supabase Vault

Collector Cron은 5분마다 Scheduler를 깨우고 실제 Game 수집 여부는 `next_due_at`이 정한다.

Vault에는 DB가 자체 생성한 Collector token만 보관한다.

Supabase secret/service-role key를 Cron SQL에 복사하지 않는다.

## 실제 검증

Preview DB에서 확인:
- 26 games
- 96 aliases
- 26 targets
- real Raw Snapshots
- real Hourly/Daily Rollups
- automatic Cron execution
- partial failure persistence
- longtail retry floor
- unauthorized Edge request 401
- Security Advisor 0 findings
