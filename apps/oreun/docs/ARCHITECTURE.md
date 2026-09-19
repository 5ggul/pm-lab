# R1 Architecture

## 경계

```text
Roblox Public API / Open Cloud
          │
          ▼
   Provider Adapters
          │ normalized + provenance
          ▼
 Adaptive Collector ── ingestion_runs
          │
          ├── current provider state
          ├── raw snapshots (short retention)
          └── rollup jobs → hourly → daily
                          │
                          ▼
                  Trend Engine v1
                          │
            Repository / Query Layer
                          │
        ┌─────────────────┼───────────────┐
        ▼                 ▼               ▼
      Home              Game Hub         Search
```

UI와 business logic은 Roblox endpoint URL/payload를 직접 알지 않는다. `RobloxPublicGamesProvider`가 현재 공개 `/v1/games` 응답을 내부 `ProviderGame`으로 변환한다. 향후 Open Cloud가 동일 용도를 안정적으로 제공하면 Adapter만 교체한다.

## Preview와 Production의 분리
현재 연결된 Supabase는 R1 전용이 아니므로 절대 수정하지 않는다. `supabase/migrations`는 R1 전용 DB 생성 시 적용할 reference migration이다. Preview는 Provider live fetch + 검증 fallback으로 동작하고, Historical UI QA가 필요할 때만 `R1_PREVIEW_FIXTURES=1`을 켠다. Fixture는 화면 상단에 표시되며 SEO/운영값으로 사용하지 않는다.

## Adaptive Collector
고정 주기가 데이터를 결정하지 않는다. Scheduler는 due game을 깨우고, game별 `next_due_at`은 플레이 규모, volatility, 실패 횟수, rate limit 상태에 따라 결정한다.

초기 cadence 목표: HOT 5m / ACTIVE 15m / NORMAL 30m / LONGTAIL 120m. 429는 `Retry-After`를 우선하고 없으면 exponential backoff + jitter 정책을 사용한다. 한 batch 실패는 다른 batch의 성공 Snapshot을 rollback하지 않는다.

## Storage
Raw: 약 7일 → Hourly: 90일+ → Daily: 장기. `playing = NULL`은 결측, `playing = 0`은 실제 0명으로 구분한다. `(universe_id, captured_at)` primary key로 idempotency를 보장한다.

## Security
R1용 Supabase 연결 시 public schema의 모든 테이블은 RLS를 켠다. Sprint 01 public client는 read-only다. `SUPABASE_SERVICE_ROLE_KEY`는 server/collector 전용이며 `NEXT_PUBLIC_` prefix를 절대 붙이지 않는다. ingestion/raw/quality/admin 데이터에는 anon policy가 없다.


## Persistent Collector runtime
Sprint 01 now contains a server-only persistent execution path:
`protected trigger / CLI → claim due targets → ingestion_runs → Roblox Provider → persist observations → retry failures → rollup refresh`.

`collector_targets` owns scheduling state. Claiming uses a lease token plus database row locking so overlapping runners do not normally collect the same game. A late runner can only persist an observation while its lease still matches.

The application uses the Supabase Data API via a minimal server-only REST adapter instead of adding a client dependency. Modern `SUPABASE_SECRET_KEY` is preferred; legacy `SUPABASE_SERVICE_ROLE_KEY` remains a compatibility fallback. Neither is exposed through `NEXT_PUBLIC_`.

## Rollup execution
Each successful observation records its expected collector cadence. Hourly and Daily rollups calculate min/max/avg/last values, sample coverage, source provenance and `rollup_v1`. Completely missing hours remain missing rows; chart/trend gap logic therefore does not turn collection outages into zero.

Raw retention is 7 days, Hourly 180 days, Daily long-term. DB-local cron is optional and intentionally separated from external Roblox collection.
