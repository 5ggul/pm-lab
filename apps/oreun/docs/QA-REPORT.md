# R1 오름 — Release Candidate QA Report

Status: **PREVIEW QA PASSED / RELEASE LOCKED**

## Current actual Preview

Latest fully verified external Preview for RC QA:

https://oreun-r1-preview.secretive-zenith.workers.dev

- RC HEAD: `336e8f712285a77debe4c49fd73c954ec78128ca`
- PR merge-test SHA: `7e59095a0abc513da30cc2d600acac47668a2411`
- Main RC QA run: `35565640336` — SUCCESS
- Hosted Preview QA run: `35565640340` — SUCCESS
- actual `apps/oreun` Next.js 16.3.3 app
- OpenNext Cloudflare Workers build
- isolated external Workers Preview created by PR QA
- global noindex remains enabled
- no Production domain
- PR #236 remains Draft/Open
- hosted Chromium QA passed against this external Preview

The dedicated permanent Worker is not the release source of truth because GitHub Actions does not currently have persistent Cloudflare account/token credentials. Each hosted QA run therefore creates an isolated external Workers Preview and browser-tests the actual Next.js application there.

The older GitHub Pages `/oreun-r1-review/` surface is retained only as a review-shell/HTTP-contract surface. It is not the canonical product Preview.

## Current data state

Preview DB: `oreun-r1-preview` / Seoul `ap-northeast-2`

- catalog: 26 Games
- provider state: 26/26
- live current provider state: 25/26
- KR regional unavailable: 1/26 (Brookhaven)
- media enrichment: 26/26
- Hero media: 26/26
- official gallery images: 182
- video metadata: 11
- detected provider update events: 94 / 26 games
- index-ready: 25/26
- Brookhaven: KR regional unavailable, current CCU intentionally omitted
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
- verified guide pages with official Hero + Experience image/video gallery
- 26 verified guides, one for every catalog Game

RIVALS media flow and guide media rendering are covered by automated browser QA.

## Brookhaven regional availability

2026-09-21 서울 Preview 리전에서 Brookhaven universe `1686885941`을 Roblox Public Games API로 조회하면
실제 Universe row 대신 `id=0 / [TITLE UNAVAILABLE] / isContentRestricted=true` placeholder가 반환됐다.
같은 한국 egress에서 Roblox Search/Explore 결과에도 Brookhaven이 나타나지 않는 것을 교차 확인했다.

Current behavior:
- zero-id placeholder rejected
- current `playing` is `null`
- freshness state is `unavailable`
- DB reason explicitly records `KR preview region; current state intentionally not bypassed`
- retry cadence is 360 minutes
- last-good observations remain history only and never become current CCU
- game list separates `한국 이용 제한` from generic provider-unavailable games
- game hub replaces the play CTA with `Roblox 게임 페이지 보기`
- UI and Methodology explain that Oreun does not use overseas relays to bypass regional availability
- optional `R1_ROBLOX_RELAY_URL` is not used for regional restriction bypass
- browser QA asserts the regional label, explanation and restricted CTA
- no fake snapshot/history is created

This is an intentional product/data state, not an unresolved requirement to force 26/26 live current-state.

## Historical-data trust

History is not accelerated or backfilled with fake values.

Rules:
- low-coverage points are excluded
- gaps remain gaps
- chart coverage threshold is enforced
- 24H / 7D strong claims stay unavailable until real history is sufficient
- readiness is never inferred from fabricated or stale observations

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
- Supabase Security Advisor: 0 ERROR / 1 WARN (`Leaked Password Protection Disabled`)
- deployed collector: `r1-collector` v14 ACTIVE; deployed source = GitHub source
- 신규 가입은 Google OAuth만 노출하며, 기존 email/password 계정은 임시 login fallback만 유지
- Security Advisor의 leaked-password WARN은 legacy password provider 운영 항목이며 Google 운영자 계정 이전 뒤 fallback 종료 여부를 최종 검토

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
- verified guide pages
- RIVALS media modal/video
- Brookhaven KR regional-unavailable handling
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
- isolated external Cloudflare Workers Preview deploy
- Chromium install
- the same browser QA against the real external Workers URL
- provider fallback source/freshness contract

## Intentional locked state

Do not treat these as defects:
- PR Draft/Open
- no Production promotion
- no Production domain
- no Search Console submission
- no AdSense submission
- global noindex still on
- live current/index-ready 25/26; Brookhaven 1개는 KR regional unavailable 상태로 분리
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
