# QA Report — Sprint 01

Status: **QA PASSED for the implemented Sprint 01 scope.**

## Current verified state

Hosted review Preview:
https://galfwxoytdcndjihdnyg.supabase.co/functions/v1/r1-web-preview/

이 URL은 사용자 최종 검수용 **Supabase Edge review shell**이다. 실제 Production Hosting은 아니며 모든 응답에 noindex가 적용된다. Next.js 본체와 동일한 Preview DB/브랜드/핵심 IA를 사용해 Home·Games·Game Hub·Search·정책·관리자 상태를 검수할 수 있다.
- Dedicated Preview database: `oreun-r1-preview` / Seoul `ap-northeast-2`
- Production/domain changes: none
- Unrelated Supabase project: untouched
- Branch HEAD is required to pass GitHub Actions provider smoke, dependency audit, typecheck, unit tests, Next production build, mobile/desktop Chromium QA, and live Edge contract QA before final review.
- Supabase Edge Function `r1-collector`: ACTIVE, custom Vault-token authentication
- Preview Cron: scheduler wake every minute; per-game collector cadence remains adaptive, retention daily, cron-history cleanup daily

## Implemented
- Game identity uses `universe_id`; `root_place_id` and SEO slug are separate
- Roblox Public Games Provider Adapter
- Supabase persistent current-state repository with direct-provider fallback
- Korean/English alias search
- freshness/null-vs-zero behavior
- Raw Snapshot → Hourly/Daily Rollup pipeline
- Rollup raw-sample coverage propagated into Trend confidence
- Trend `trend_v1_1` with low-baseline protection, missing-row protection and component versioning
- Home / Games / Rising / Search / Game Hub / Methodology / Data Status
- Historical chart gaps for missing intervals and accessible table output
- Adaptive Collector HOT 5m / ACTIVE 15m / NORMAL 30m / LONGTAIL 120m
- lease-based due-target claiming with `FOR UPDATE SKIP LOCKED`
- ingestion run metrics and data provenance
- protected Next collector trigger and Supabase Preview Edge collector
- Raw 7d / Hourly 180d / Daily long-term retention
- RLS-first migrations, explicit internal deny policies, and least-privilege PostgreSQL grants for existing exposed objects
- Preview/production indexing separation: global noindex must be off **and** a Game must be `indexable` before per-Game metadata can index
- Sitemap reads persisted Game `index_state`; it no longer trusts seed state as the primary source
- Preview-only `/admin/*` operational pages return 404 when `R1_PREVIEW_NO_INDEX=0`
- Browser hardening headers on Next and hosted Edge review surfaces (`nosniff`, frame protection, referrer/permissions policy, preview X-Robots-Tag)

## Real database verification
Bootstrap result:
- games: 26
- aliases: 96
- enabled collector targets: 26
- Roblox source definitions: 1

Manual live-provider integration:
1. 3-game live sample persisted successfully and generated 3 Hourly + 3 Daily rollups.
2. 16-game end-to-end Edge run exposed a run-accounting defect.
3. After the fix, the same request produced `requested=16 / success=15 / failed=1 / status=partial`.

The remaining failure is Brookhaven (`universe_id=1686885941`). Its Roblox game page confirms the identity, but the Public Games API currently omits that requested Universe and emits a zero-id placeholder. R1 does not convert that failure to zero or a fake Snapshot.

Automatic scheduler verification:
- 07:05 UTC Cron job executed successfully.
- 07:10 UTC automatic Collector run requested 6 due targets, persisted 5, and recorded Brookhaven as 1 failure.
- A 5-minute scheduler alignment defect was then reproduced: a target due at 07:15:02 was missed by a 07:15:00 wake.
- Scheduler wake-up changed to every 1 minute while per-game cadence stays 5/15/30/120 minutes.
- 07:19 UTC automatic run then claimed 13 due targets and persisted **13/13, failure 0, rate-limit 0**, proving the wake-up drift fix.
- Five normal game Snapshots were added at 07:10 without manual intervention.
- Brookhaven reached failure_count 4 and its next retry moved from minutes to 09:10 UTC, proving the 120-minute repeated-failure floor is active.

Auth verification:
- Valid Vault-token DB invocation: HTTP 200
- Same Edge Function without token: HTTP 401

## Supabase advisor result
After hardening:
- Security Advisor: **0 findings**
- public-schema default privileges locked down; future exposure is opt-in
- existing anon/authenticated grants minimized: catalog/current-state/rollup/trend are SELECT-only; raw snapshots, collector targets, ingestion runs, data-source metadata, slug history, quality flags and readiness view are not publicly granted
- public/authenticated function EXECUTE revoked; collector RPC surface remains server-side only
- Foreign-key index findings: fixed
- Remaining Performance Advisor findings are only `unused_index` INFO on a brand-new database; search/FK indexes are intentionally retained until real workload statistics exist.

## Catalog expansion verification
- Expanded verified catalog from 16 to **26** Games.
- New Game identities were resolved from official Roblox place→universe responses and then verified against the Public Games API before being inserted.
- Added Arsenal, Dress To Impress, Jailbreak, Bee Swarm Simulator, Forsaken, Natural Disaster Survival, Theme Park Tycoon 2, PLS DONATE, Prison Life, and Work at a Pizza Place.
- All ten new targets produced normal stored current state in Preview DB; no fabricated values were used.
- Search aliases for the expanded Korean catalog are covered by unit tests.

## Browser / code verification
- Roblox provider smoke request succeeded
- TypeScript typecheck passed
- persistent collector success / partial / 429 / idle / persistence-rejection tests passed
- alias search tests passed
- Trend low-baseline, missing-row and low-rollup-coverage tests passed
- Supabase public read mapping/freshness tests passed
- Next.js production build passed
- npm dependency audit reports 0 known vulnerabilities after Playwright 1.56.0 upgrade; CI now has a high-severity audit gate
- Chromium QA passed at 360, 375, 390 and 430px
- desktop Rising QA passed
- Home → `라이벌즈` search → RIVALS Game Hub → 7D chart flow passed
- browser QA found no console/page errors
- missing-row fixture produces a real split SVG path instead of bridging the outage
- Play button remains explicit external navigation

## Defects found and fixed
1. Initial bootstrap payload corruption caused a gzip materialization failure. Temporary bootstrap architecture was later removed entirely; `apps/oreun` is now canonical source.
2. Browser QA initially matched both header and main search. QA was scoped to the main search.
3. Build/dependency artifacts were briefly tracked. App-level ignore/cleanup removed them.
4. Mobile Game Hub initially lacked the required primary search. Added and asserted in browser QA.
5. Provenance showed raw UTC. User-facing timestamp now renders KST.
6. Trend v1 counted returned rows, so completely absent time rows could overstate coverage. `trend_v1_1` calculates expected time slots and chart gaps.
7. Collector initially counted Roblox response rows as success rather than rows actually accepted by persistence RPC. Fixed so run totals derive from persisted rows.
8. Repeated provider failure changed a target to longtail but did not initially enforce the longtail retry interval. After 3 failures, retry now has a minimum 120-minute floor.
9. Roblox can return an `id=0` placeholder for an unavailable requested Universe. Provider/Edge adapters now discard zero-id placeholders.
10. Preview Cron originally woke every 5 minutes. Because a 5-minute HOT target becomes due a few seconds after the previous run completes, a 07:15:00 wake could miss a 07:15:02 target and effectively stretch HOT collection to 10 minutes. Scheduler wake-up is now every 1 minute while per-game `next_due_at` remains 5/15/30/120 minutes.
11. The first pre-fix full run left an inconsistent historical accounting row. Preview data was corrected and DB constraints now enforce `requested = success + failure` for completed runs and `rate_limit <= failure`.
12. Multiple migration files initially shared a date-only version prefix. They now use unique 14-digit versions so Supabase CLI migration history cannot collide.

## Later Sprint state in the Sprint 05 branch

Sprint 02 Account/Q&A/Follow, Sprint 03 verified Content, and Sprint 04 Party/Contribution layers are now implemented on their chained Preview branches and preserved in Sprint 05.

Sprint 05 adds a feature-flagged Roblox Open Cloud Group Forum aggregate collector. It remains disabled by default and does not have a fabricated API credential or target. No Forum bodies, authors, or user IDs are persisted.

## Known limitations
1. Hosted **Next.js** Preview URL is still unavailable because the connected Vercel team has no project and the repository has no `VERCEL_TOKEN`. No alternative hosting project was created or existing site overwritten without explicit user approval.
2. Historical Data began accumulating on 2026-09-19. The launch-readiness rule requires 24 real Hourly buckets plus ≥70% average raw coverage; this time-based gate cannot be accelerated with fabricated history.
3. Brookhaven currently lacks a valid Public Games API Snapshot despite the identity being confirmed separately. It remains unavailable/collecting with longtail backoff rather than being converted to 0 or stale data presented as current.
4. The hosted Supabase Edge URL is a real persistent-DB review shell, not the full Next.js production host. The full Next application is verified in CI with production build and browser QA.
5. Production execution placement, domain, canonical URL, Game index promotion, and global noindex release remain explicit post-review decisions.

## Data distinction
- Current stored value: real Roblox Public Games API response persisted by R1
- Raw Snapshot: timestamped original R1 observation
- Hourly/Daily: R1-derived Rollup with coverage and version
- Historical QA fixture: synthetic, only under `R1_PREVIEW_FIXTURES=1`
- Fallback snapshot: old verified data, explicitly stale
- Missing/unavailable provider data: never converted to 0


## Final pre-launch hardening added on 2026-09-19
- Corrected the live Edge QA contract: Home intentionally validates 12 featured rows, while `/games` validates the full 26-Game catalog.
- Upgraded Playwright from 1.55.0 to 1.56.0 and locked the package tree; dependency installation now reports 0 vulnerabilities.
- Added `npm audit --audit-level=high` to the Preview workflow.
- Added response-level noindex/security headers to the full Next Preview and the hosted Edge review shell, with automated assertions.
- Added DB migration `r1_existing_grants_lockdown` and verified anon/authenticated roles cannot write to exposed tables or read internal/raw tables.
- Supabase Security Advisor remains at **0 findings** after the grant hardening.
- Global noindex remains **ON**. No domain was attached, no production deployment was promoted, and PR #222 remains Draft/Open.

- Added a fail-closed indexing release guard: setting `R1_PREVIEW_NO_INDEX=0` alone is insufficient. Indexing only releases when `NEXT_PUBLIC_SITE_URL` is also a valid non-localhost HTTPS origin. Until both are true, robots/meta/X-Robots remain in Preview-safe mode.


## Sprint 05 verification scope

- Feature flag defaults OFF and blocks network access.
- Missing API Key blocks network access.
- API bounds are clamped to 20 categories / 100 posts per target even if larger environment values are supplied.
- Target batch and successful re-collection cadence are bounded (default 5 targets/run, 60-minute minimum interval; hard caps 25 targets and minimum 15 minutes).
- 401/403 is treated as authorization failure.
- Invalid Group ID is rejected before network access.
- Aggregate payload strips Forum text/user identity and persists observed counts only.
- Target verification checks the Game exists in the R1 catalog, verifies the Roblox Public Games creator Group ID matches, and then makes a live Group Forum read before writing `authorized`.
- New target remains disabled unless explicitly enabled.
- DB invariant rejects enabled-but-unverified target rows.
- Preview admin page reports only configuration/readiness state and never emits the API Key.
- Internal execution endpoint is protected by a timing-safe server secret.
- CI keeps `R1_ROBLOX_COMMUNITY_ANALYTICS=0`; browser QA never calls Roblox Community APIs.


## Release Candidate hardening

Sprint 01~05 이후 최종 통합 단계에서 다음 release-boundary 회귀를 추가했다.

- `R1_PREVIEW_NO_INDEX=0` 하나만으로 색인을 열 수 없게 최종 `R1_INDEX_RELEASE_CONFIRM=1` latch 추가
- public site origin에서 localhost/private/reserved host 차단
- metadata base는 검증된 public origin만 사용; 잘못된 raw env URL을 그대로 사용하지 않음
- Preview `/sitemap.xml`은 URL entry 0개
- Preview robots/meta/X-Robots 동시 잠금 확인
- internal collector/community analytics POST는 무인증 요청이 2xx가 되지 않는지 확인
- 별도 release-mode CI build를 수행해 noindex가 정확히 해제되는 조건을 검증
- release-mode robots가 `/search`, `/admin/`을 차단하고 실제 origin의 sitemap을 가리키는지 확인
- Preview 진단 admin 3종이 release mode에서 404인지 확인
- Content/Moderation admin은 Preview-only 화면으로 오기재했던 문서를 수정하고 운영 인증 화면으로 명확히 분리


## Media-rich game surface

사용자 피드백에 따라 텍스트 중심 데이터 목록을 게임 미디어 중심 구조로 교체했다.

검수 대상:
- Home 3-up visual spotlight
- 실시간 TOP image cards
- 급상승 image cards
- 최근 업데이트 image cards
- Game detail full-width Hero
- 공식 Roblox media gallery
- RIVALS 기준 video tile + Asset Delivery playback resolver
- genre / max players / verified creator / visits / favorites
- player history chart
- 360/375/390/430 mobile overflow
- GitHub Pages live Preview가 실제 Supabase DB를 로딩하는지
- GitHub Pages에서 RIVALS media tile 8개 이상, video tile 존재, resolver 결과 `.rbxcdn.com`

2026-09-19 bootstrap 실측:
- 26 Game enrichment row
- 25 Hero image
- 175 official images
- 7 GamePreviewVideo
