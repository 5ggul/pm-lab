# R1 오름 — Release Candidate QA Report

Status: **PREVIEW QA PASSED / RELEASE LOCKED**

## Current actual Preview

Latest fully verified external Preview for RC QA:

https://oreun-r1-preview.berry-river.workers.dev

- actual `apps/oreun` Next.js 16.3.3 app
- OpenNext Cloudflare Workers build
- isolated external Workers Preview created by PR QA
- global noindex remains enabled
- no Production domain
- PR #236 remains Draft/Open
- hosted Chromium QA passed against this external Preview

The previously documented dedicated `oreun-r1-preview` Worker cannot currently be refreshed from GitHub Actions because the repository workflow has no Cloudflare account/token credentials available. PR QA therefore intentionally uses isolated temporary Workers Previews. A manual workflow run will update the dedicated Worker only when those credentials are configured; otherwise it also stays isolated and does not fail the RC branch.

The older GitHub Pages `/oreun-r1-review/` surface is retained only as a review-shell/HTTP-contract surface. It is not the canonical product Preview.

## Current data state

Preview DB: `oreun-r1-preview` / Seoul `ap-northeast-2`

- catalog: 26 Games
- provider state: 26/26
- fresh provider state: 25/26
- media enrichment: 26/26
- Hero media: 26/26
- official gallery images: 184
- video metadata: 12
- detected provider update events: accumulating continuously
- index-ready: 25/26
- Brookhaven: provider current-state omission 때문에 collecting 유지
- no fabricated history
- no fabricated codes/guides/Q&A/party content

## Media-rich product surface

Verified:
- image-first Home spotlight
- real-time TOP cards
- Rising cards
- global update detection radar `/updates`
- full visual Game Hub
- official media gallery
- Roblox GamePreviewVideo resolver
- official YouTube media via privacy-enhanced embed
- creator / verified creator / max players / genre / visits / favorites
- trusted player-history chart
- compare
- game explorer filters

RIVALS media flow is covered by automated browser QA.

## Brookhaven provider recovery

Brookhaven previously reproduced a provider-specific `id=0 / [TITLE UNAVAILABLE]` placeholder response from the Preview collector egress.

Current behavior:
- zero-id placeholder is rejected
- verified official Group Games / favorites / thumbnail fallback exists
- fallback never invents current playing
- primary current-state provider is preferred whenever it succeeds
- Supabase Edge egress에서는 Brookhaven primary response omission이 다시 재현됨
- GitHub Actions와 Cloudflare Workers egress에서는 동일 Roblox Public Games endpoint가 Brookhaven current state를 정상 반환함
- allowlisted Cloudflare relay route를 actual hosted browser QA에서 검증함
- collector는 primary → single retry → restricted일 때만 relay 순서로 검증하고, relay도 실패하면 값을 만들지 않고 unavailable 처리함
- dedicated Worker credential이 준비되기 전에는 relay를 release dependency로 간주하지 않으며 Brookhaven은 collecting을 유지함
- 마지막 실제 CCU는 stale 처리되어 현재값으로 노출하지 않음
- 최근 실제 성공 기록이 있는 high-CCU Game은 provider omission만으로 120분 longtail에 고정되지 않도록 retry scheduling을 보정함
- content-restricted가 재현되면 collector는 검증된 relay URL이 설정된 경우에만 egress fallback을 시도함
- relay가 설정되지 않았거나 검증에 실패하면 Brookhaven은 current value를 만들지 않고 30분 뒤 다시 검증함
- 2026-09-20 v13 재검증에서도 Supabase egress의 restriction이 재현되어 Brookhaven은 collecting/unavailable 상태를 유지함
- official Hero/gallery는 fallback으로 유지
- browser QA prevents placeholder text from leaking to users
- 누락 구간을 가짜 snapshot/history로 채우지 않음

## Historical-data trust

History is not accelerated or backfilled with fake values.

Rules:
- low-coverage points are excluded
- gaps remain gaps
- chart coverage threshold is enforced
- 24H / 7D strong claims stay unavailable until real history is sufficient
- `data_ready_for_index_review` remains false until the launch-readiness gate is actually satisfied

## Update detection

`game_update_events` stores only observed Roblox provider update-time changes.

Global `/updates`:
- latest detected events
- games with repeated detected changes
- direct links to per-game update timelines
- if collection age is under 24 hours, UI says “수집 시작 이후” rather than “최근 24시간”
- detection count is not described as patch size or patch-note count
- player changes around an event are correlation-only and explicitly not described as causal

## Follow → notification loop

Implemented and hardened:
- followed Game update notifications
- followed Game code notifications
- followed Game guide notifications
- `notifications.update_event_id` FK
- per-user/per-event unique guard
- update trigger uses `ON CONFLICT DO NOTHING`
- update notifications deep-link to the exact detected event
- MY page shows exact unread count
- MY followed-game cards show recent update detection
- unread count RPC is `security invoker`
- anon cannot execute the unread RPC
- authenticated users can execute it under RLS

Preview currently has no real follows/notifications. No fake user activity was seeded.

## Content review gate

Content Studio flow:

`draft → pending review → approved/rejected → published`

DB enforcement:
- source required before publish
- approved review required before publish
- `reviewed_at` required
- active codes require `verified_at`
- substantive edits after approval invalidate review
- edited published content returns to draft/noindex
- direct-publish checkboxes were removed from new content forms

## Security

Verified:
- service-role secrets are not exposed to the browser
- publishable key has read-only access only where intended
- public mutation denial is browser-tested
- media resolver rejects unknown/cross-game video assets
- Preview meta robots + X-Robots + robots.txt remain locked
- release requires all three release keys
- internal collector/analytics endpoints fail closed without auth
- Supabase Security Advisor: 0 findings

## Release guard

Indexing requires all of:
1. `R1_PREVIEW_NO_INDEX=0`
2. `R1_INDEX_RELEASE_CONFIRM=1`
3. validated public HTTPS `NEXT_PUBLIC_SITE_URL`

Preview stays noindex until explicit final approval.

## Automated QA

Main RC workflow verifies:
- dependency security audit
- Roblox provider smoke
- TypeScript
- unit tests
- Next production build
- 360 / 375 / 390 / 430 / 768 / 1440 Chromium QA
- Korean/English alias search
- RIVALS media modal/video
- Brookhaven recovery
- trusted-history rules
- game filters
- compare
- `/updates`
- public Data API mutation denial
- media resolver validation
- Preview noindex
- release-mode guard
- legacy Edge/GitHub Pages HTTP contract

Hosted workflow verifies:
- OpenNext build
- deploy to dedicated `oreun-r1-preview` Worker
- Chromium install
- the same browser QA against the real external Workers URL

## Intentional locked state

Do not treat these as defects:
- PR Draft/Open
- no Production promotion
- no Production domain
- no Search Console submission
- no AdSense submission
- global noindex still on
- index-ready 25/26; Brookhaven은 실제 current-state provider 복구와 신뢰 가능한 history 누적 전까지 collecting 유지
- Content/UGC may legitimately be empty until verified content is created
- Community Analytics OFF by default

## Final release actions intentionally not performed

- no merge
- no domain connection
- no global noindex release
- no bulk `index_state=indexable`
- no Search Console submission
- no AdSense submission

Those actions remain user-controlled after final Preview review.
