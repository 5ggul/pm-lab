# QA Report — Sprint 01

Status: **QA PASSED for the implemented Sprint 01 scope.**

## Current verified state
- Dedicated Preview database: `oreun-r1-preview` / Seoul `ap-northeast-2`
- Production/domain changes: none
- Unrelated Supabase project: untouched
- Latest application CI before this documentation refresh: GitHub Actions `35428495182` — provider smoke, typecheck, unit tests, Next production build and Chromium QA all passed
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
- RLS-first migrations and explicit internal deny policies

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

## Deliberately not implemented
Auth, Follow, notifications, Q&A/comments, codes/guides UI, party, Community API, real ads and Roblox OAuth remain later Sprints.

## Known limitations
1. Hosted Next.js Preview URL is still unavailable because no Vercel deployment credential/project is connected and Netlify could not create a new independent project. Existing sites were not overwritten.
2. Historical Data has only just begun accumulating. 24H/7D/30D product metrics must remain unavailable until real coverage thresholds are met.
3. Brookhaven currently lacks a valid Public Games API Snapshot despite the identity being confirmed separately. It remains unavailable/collecting rather than fabricated.
5. Supabase Preview Edge Collector is an execution bridge while the hosted application Preview is unavailable. Final production execution placement remains a deployment decision.

## Data distinction
- Current stored value: real Roblox Public Games API response persisted by R1
- Raw Snapshot: timestamped original R1 observation
- Hourly/Daily: R1-derived Rollup with coverage and version
- Historical QA fixture: synthetic, only under `R1_PREVIEW_FIXTURES=1`
- Fallback snapshot: old verified data, explicitly stale
- Missing/unavailable provider data: never converted to 0
