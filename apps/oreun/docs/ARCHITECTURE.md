# R1 Architecture

## 전체 경계

```text
                  Roblox Public API
                         │
                         ▼
                 Provider Adapter
                         │
                    normalized
                 + provenance
                         │
           ┌─────────────┴─────────────┐
           │                           │
           ▼                           ▼
 Preview Collector Runtime       Direct Provider Fallback
           │                           │
           ▼                           │
       Supabase DB                    │
           │                           │
   ┌───────┼─────────┐                 │
   ▼       ▼         ▼                 │
Current   Raw      Rollups             │
State   Snapshot  Hourly/Daily         │
   │                 │                 │
   └────────┬────────┘                 │
            ▼                          │
       Repository Layer ◄──────────────┘
            │
      ┌─────┼────────────┐
      ▼     ▼            ▼
     Home  Game Hub     Search
            │
            ▼
       Trend Engine
```

UI와 Product Logic은 Roblox endpoint payload를 직접 알지 않는다.

## 현재 Preview Runtime

전용 Supabase:
- Project: `oreun-r1-preview`
- Region: Seoul
- 다른 Supabase 프로젝트와 분리

실행 흐름:

```text
pg_cron (1분 wake-up)
      ↓
pg_net
      ↓ Vault-only token
Supabase Edge Function: r1-collector
      ↓
claim due collector_targets
      ↓
RobloxPublicGames
      ↓
Persistence RPC
      ↓
Current + Raw
      ↓
Hourly / Daily Rollup
```

중요한 점은 **1분 Scheduler Cron = 모든 Game 5분 수집이 아니다.**

실제 Game cadence는 DB의 `next_due_at`으로 Adaptive하게 결정된다.

## Provider Boundary

현재:
- `RobloxPublicGamesProvider`
- Endpoint: `games.roblox.com/v1/games`

이 Public API는 Open Cloud와 동일한 안정성을 가정하지 않는다.

따라서:
- Adapter 격리
- 누락/placeholder 방어
- Failure target 분리
- Stored last-good 상태
- Provenance

를 둔다.

Stable Open Cloud가 동일 기능을 제공하게 되면 UI가 아니라 Adapter를 교체한다.

## Identity

진짜 Game identity:

`universe_id`

별도 속성:
- root_place_id
- canonical_slug
- Korean name
- aliases

Slug 변경은 entity 변경이 아니다.

## Collector Scheduler

Target 상태:
- tier
- cadence_minutes
- next_due_at
- failure_count
- last_success_at
- last_failure_at
- lease_token
- leased_until

Tier:
- HOT 5m
- ACTIVE 15m
- NORMAL 30m
- LONGTAIL 120m

Scheduler wake-up과 per-game cadence를 분리한다.

## Concurrency

DB Claim:
- `FOR UPDATE SKIP LOCKED`
- lease token
- lease timeout

Late Runner가 오래된 응답을 저장하지 못하게 Persistence RPC도 lease ownership을 검증한다.

## Failure Degradation

API 장애가 페이지 장애로 바로 전파되면 안 된다.

읽기 우선순위:

1. Persistent current state
2. Direct Roblox provider fallback
3. Verified stale fallback
4. unavailable

Missing != 0.

Repeated Provider failure:
- failure count 증가
- 3회부터 LONGTAIL
- minimum 120m retry
- 다른 targets 계속 수집

## Storage

### Current
`game_provider_state`

가장 최근 정상 Roblox Observation.

### Raw
`game_snapshots`

- 약 7일
- captured/fetched time
- ingestion run
- source
- expected cadence

### Hourly
`game_rollups_hourly`

- 180일
- min/max/avg/last
- sample_count
- expected_samples
- coverage_ratio

### Daily
`game_rollups_daily`

장기 기록.

## Historical Trust

시간축에서:
- 누락 row를 0으로 만들지 않는다.
- 간격이 예상 cadence보다 지나치게 크면 Chart path를 끊는다.
- Hourly row가 존재해도 raw sample coverage가 낮으면 Trend confidence가 낮아진다.

Trend current calculation version:
- `trend_v1_1`

Rollup:
- `rollup_v1`

## Public Read Path

앱은 `getPersistentGameCatalog()`을 통해:
- games
- aliases
- game_provider_state

를 읽는다.

Historical:
- game_rollups_hourly

Public read에는 publishable key만 사용한다.

Server secret은 브라우저 번들에 넣지 않는다.

Persistent DB read 실패 시 direct provider fallback으로 페이지 전체 500을 피한다.

## Freshness

DB의 저장된 `freshness_state`는 수집 당시 상태일 뿐이다.

UI에서는 반드시 현재 시각과 `fetched_at`으로 freshness를 다시 계산한다.

따라서 오래된 Snapshot이 계속 fresh로 표시될 수 없다.

## Preview Edge Security

Supabase Edge Collector는 `verify_jwt=false`지만 공개 실행 함수가 아니다.

이유:
- DB Cron 호출은 Custom Vault Token으로 인증
- token은 DB 내부에서 생성
- Vault 외부로 값을 노출하지 않음
- validation RPC는 service_role만 실행 가능
- token 없는 실제 HTTP 호출 → 401 확인

Supabase Secret/Service Role은 Edge runtime 내부 DB 호출에서만 사용한다.

## RLS / Database Hardening

- Public exposed tables: RLS
- Internal operational tables: explicit deny policy
- Internal RPCs: anon/authenticated EXECUTE 없음
- pg_trgm: extensions schema
- FK covering indexes 추가
- Security Advisor: 0 findings

## Search

MVP:
- canonical exact
- alias exact
- prefix
- normalized prefix
- trigram

DB:
- pg_trgm
- normalized_alias index

## Preview vs Production

현재:
- Data Collector Preview: 실제 동작
- Supabase Preview DB: 실제 동작
- Next browser hosted Preview URL: 아직 없음
- Production DB: 없음
- Production domain: 없음

현재 Edge Collector는 **Preview 실행 bridge**다.

Production에서 Collector를:
- Hosted Next server
- Worker
- Supabase Edge
- 별도 job runner

중 어디에 둘지는 실제 운영 트래픽과 Rate Limit 측정 후 결정한다.

## 다음 아키텍처 확장

Sprint 02:
- Auth
- Q&A
- Comment
- Follow
- Notifications
- Report/Moderation

이들은 Data Collector와 분리된 User/UGC domain으로 붙인다.
