# R1 Database Schema

## 실제 Preview DB

- Project: `oreun-r1-preview`
- Region: Seoul (`ap-northeast-2`)
- Production DB와 분리
- 기존 다른 Supabase project와 분리

적용 migration은 Sprint 01 data foundation 이후 community/content/media/release hardening까지 연속 적용한다.

현재 RC의 추가 핵심 migration:
- `20260919001500_r1_follow_content_notifications.sql`
- `20260919001600_r1_verified_provider_fallbacks.sql`
- `20260919001700_r1_pilot_editorial_depth.sql`
- `20260919001800_r1_provider_fallback_service_policy.sql`
- `20260919001900_r1_content_review_gate.sql`
- `20260919002000_r1_update_notification_integrity.sql`
- `20260919002100_r1_drop_redundant_update_notification_index.sql`
- `20260919002200_r1_restore_update_notification_fk_index.sql`
- `20260919002300_r1_unread_notification_count_rpc.sql`

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
- 26/26 fresh provider state
- 26/26 media enrichment
- 26/26 Hero media
- 184 official gallery images
- 12 video metadata rows
- real Raw Snapshots
- real Hourly/Daily Rollups
- automatic Cron execution
- partial failure persistence
- longtail retry floor
- unauthorized Edge request 401
- Security Advisor 0 findings


## Sprint 05 community analytics

### roblox_community_targets
Server-only target registry.
- `universe_id` → games
- `group_id`
- `authorization_state`: unverified / authorized / revoked
- `enabled`
- `last_verified_at`
- `last_collected_at`
- `last_error`

Invariant:
- authorized → `last_verified_at IS NOT NULL`
- enabled → authorized + verified

### roblox_community_runs
Aggregate collector execution accounting.
Completed rows satisfy target_count = success_count + failure_count.

### roblox_community_snapshots
No raw Forum content.
- `observed_forum_category_count`
- `observed_post_count`
- `observed_comment_count`
- `categories_scanned`
- `posts_scanned`
- `truncated`
- source/scope/version

Public roles have no access. RLS is enabled and service-role access is explicit.

### r1_community_analytics_readiness
`security_invoker=true` internal readiness view.
Public/anon/authenticated grants are revoked.


## game_enrichment

Roblox의 비교적 저빈도 Experience metadata와 공식 미디어 캐시.

주요 컬럼:
- `universe_id` — Game FK / PK
- `creator_id`, `creator_name`, `creator_type`, `creator_verified`
- `max_players`
- `genre`, `genre_l1`, `genre_l2`
- `experience_created_at`, `experience_updated_at`
- `canonical_url_path`, `is_content_restricted`
- `hero_image_url`
- `media_images jsonb[]`
- `media_videos jsonb[]`
- `details_fetched_at`, `media_fetched_at`

Public read는 non-retired Game에 한해 허용한다. anon/authenticated는 INSERT/UPDATE 불가이고, collector의 service role만 갱신한다.

`media_videos`에는 재생 URL을 저장하지 않는다. signed Roblox CDN URL은 클릭 시 `r1-game-media` resolver에서 새로 해석한다.


## Content review workflow

### game_guides / game_codes

검증 콘텐츠는 direct publish를 허용하지 않는다.

Review state:
- `draft`
- `pending`
- `approved`
- `rejected`

추가 컬럼:
- `review_status`
- `reviewed_at`
- `reviewed_by`
- `review_note`

DB guard:
- published는 source 필수
- published는 approved + reviewed_at 필수
- active code는 verified_at 필수
- 승인 이후 substantive edit가 발생하면 approval을 무효화
- 이미 published였던 콘텐츠를 수정하면 draft/noindex로 되돌림

## Update detection / notifications

### game_update_events

Roblox provider의 `updated` 값이 변경된 사실만 기록한다.

- `universe_id`
- `source_updated_at`
- `first_observed_at`
- `event_kind`
- `source_url`

Unique identity:
`(universe_id, source_updated_at)`

### game_follows

User/Game follow identity:
`(user_id, universe_id)`

### notifications

Game follow 기반 update/code/guide 알림과 Q&A 알림을 저장한다.

Update notification hardening:
- `update_event_id` → `game_update_events(id)` FK
- `notifications_followed_update_unique` partial unique index
  - `(user_id, update_event_id)`
  - `kind='followed_game_update'`
- `notifications_update_event_idx` FK covering index
- update trigger는 `ON CONFLICT DO NOTHING`으로 idempotent
- payload에도 event/source time을 보존하지만 event identity는 typed FK를 기준으로 사용

RLS:
- authenticated user는 자신의 notification만 SELECT/UPDATE
- anon read/write 없음

### r1_my_unread_notification_count()

정확한 unread count용 RPC.

- `security invoker`
- authenticated EXECUTE만 grant
- anon/PUBLIC EXECUTE revoke
- notification RLS를 그대로 따름

## Provider fallback

### game_provider_fallbacks

일부 Roblox provider egress에서 특정 Universe가 placeholder로 내려오는 경우를 위한 검증된 fallback binding.

- public read/write 금지
- service role only
- fallback은 current playing을 만들어내지 않음
- primary provider가 정상화되면 primary state 우선

Brookhaven recovery는 이 구조의 회귀 테스트 대상이다.
