# R1 오름 Launch Checklist

현재 목표는 사용자 최종 검수 전 Preview 상태를 고정하는 것이다.

검수 URL:
https://galfwxoytdcndjihdnyg.supabase.co/functions/v1/r1-web-preview/

이 URL은 Supabase Edge 기반 검수 전용 shell이며 Production 도메인이 아니다. X-Robots-Tag와 meta robots 모두 noindex로 고정한다.

Production 배포, 운영 도메인 연결, 전역 noindex 해제는 사용자 승인 전 금지한다.

## 현재 완료

- [x] 독립 브랜드 오름
- [x] Roblox 공식 로고 미사용
- [x] 검증 Game 26개
- [x] 한국어/영어 Alias 96개
- [x] 실제 Roblox current state 수집
- [x] 전용 Supabase Preview DB
- [x] Adaptive Collector
- [x] Raw / Hourly / Daily
- [x] Provenance
- [x] Freshness / Confidence
- [x] Trend v1.1
- [x] Home / Games / Rising / Game Hub / Search
- [x] 실제 게임 아이콘 + glyph fallback
- [x] Methodology / About / Guidelines / Terms / Privacy / Youth / Disclaimer
- [x] VideoGame / WebSite / Organization structured data
- [x] Game OG image
- [x] /search noindex
- [x] /admin/* robots 차단
- [x] Preview global noindex
- [x] Mobile 360 / 375 / 390 / 430 QA
- [x] Browser console/hydration QA
- [x] Supabase Security Advisor 0 findings
- [x] Ingestion accounting DB constraints
- [x] Internal launch-readiness view
- [x] Automatic Preview data collection
- [x] Existing DB grants minimized to public SELECT-only surface
- [x] Preview response X-Robots-Tag + browser security headers
- [x] Dependency high-severity audit gate
- [x] Sitemap uses persisted DB index state
- [x] Preview 진단 화면 `/admin/data-status`, `/admin/launch-readiness`, `/admin/community-analytics`는 release mode에서 404
- [x] 운영용 `/admin/content`, `/admin/moderation`은 로그인 + 역할 권한 뒤에 유지하며 robots/meta noindex

## 현재 의도적으로 유지

### Global noindex

Preview 환경은 `R1_PREVIEW_NO_INDEX=1`, `R1_INDEX_RELEASE_CONFIRM=0` 상태를 유지한다.
이 상태에서는 HTML robots meta와 HTTP `X-Robots-Tag`가 noindex이고 robots.txt가 전체 disallow이며 sitemap은 URL entry를 내보내지 않는다.

색인 release는 아래 3개가 **동시에** 맞아야만 성립한다.
- `R1_PREVIEW_NO_INDEX=0`
- `R1_INDEX_RELEASE_CONFIRM=1`
- `NEXT_PUBLIC_SITE_URL`이 local/IP/reserved host가 아닌 실제 HTTPS 도메인 origin

사용자 최종 승인 전 두 release flag를 변경하지 않는다.

### Game index_state

API에서 발견되었다는 이유만으로 Game을 indexable로 만들지 않는다.
내부 view r1_game_index_readiness가 데이터 최소조건을 계산한다.

데이터 검토 기준:
- candidate/indexable 상태
- 최근 current Snapshot
- 고유 한국어 설명
- 최근 24시간 Hourly bucket 24개 이상
- 24시간 평균 raw coverage 70% 이상

이 조건은 자동 색인 승인 조건이 아니다. 최종 색인 승격은 사용자 검수 후 한다.

## 사용자 최종 검수 화면

1. Home
2. /games
3. /rising
4. RIVALS Game Hub
5. 99 Nights Game Hub
6. Dress To Impress Game Hub
7. Arsenal Game Hub
8. Search: 라이벌즈 / 아스널 / DTI / 포세이큰 / 99나이트
9. /methodology
10. /about
11. /guidelines
12. /privacy
13. /youth
14. /terms
15. /disclaimer
16. /admin/data-status
17. /admin/launch-readiness
18. /review-build.json
19. /robots.txt
20. /sitemap.xml

## 도메인 연결 승인 후 순서

1. `NEXT_PUBLIC_SITE_URL`을 실제 운영 HTTPS 도메인으로 확정한다. localhost/http/잘못된 URL이면 release guard가 noindex를 계속 유지한다.
2. Hosting public/server 환경변수를 Preview와 Production에 분리한다.
3. Production 전용 Supabase 분리 여부를 확정한다.
4. Preview의 /admin/launch-readiness에서 Game별 data readiness를 검토한다.
5. 최근 24시간 Hourly bucket 24개와 평균 raw coverage 70% 이상을 실제 데이터로 충족한 candidate 중 사람이 승인한 Game만 indexable로 승격한다.
6. 운영 환경에서 Preview 진단 화면 3종이 404인지 확인하고, Content/Moderation은 비로그인 접근이 차단되는지 확인한다.
7. robots.txt / sitemap.xml / canonical / OG와 실제 운영 도메인을 검수한다.
8. 마지막 승인 순간에 `R1_INDEX_RELEASE_CONFIRM=1`과 `R1_PREVIEW_NO_INDEX=0`을 적용한다.
9. 다시 robots/meta/X-Robots/sitemap을 확인한다.

권장 순서: 도메인·Canonical 확인 → index_state 승인 → release confirm → noindex 해제.

## Hosting 환경변수

Release control:
- R1_PREVIEW_NO_INDEX
- R1_INDEX_RELEASE_CONFIRM

Public:
- NEXT_PUBLIC_SITE_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

Server only:
- SUPABASE_URL
- SUPABASE_SECRET_KEY
- R1_COLLECTOR_TRIGGER_SECRET 또는 CRON_SECRET

Secret 값에는 절대 NEXT_PUBLIC_ prefix를 붙이지 않는다.

## 공개 직후

- Search Console 등록
- 404/500 로그 확인
- Collector stale 수 확인
- 실제 24H/7D coverage 확인
- 광고는 별도 승인 전 삽입하지 않음

## noindex 해제 전에 하면 안 되는 것

- Production 도메인과 Preview URL을 동시에 canonical로 사용
- 모든 Game을 일괄 indexable 처리
- Historical Data 부족한 페이지에 가짜 7D/30D 변화율 생성
- QA Fixture가 켜진 상태로 운영
- Roblox API Key / Cookie / Secret을 client bundle에 노출
- Provider가 응답하지 않는 Game에 가짜 current 숫자 생성

## Sprint 02 Gate

Sprint 02는 Sprint 01 Data Foundation을 파괴하지 않는 별도 Domain으로 추가한다.
Auth / Q&A / Comments / Follow / Notifications / Reporting / Moderation은 후속 범위다.
Data layer와 UGC layer의 출처·권한·광고 eligibility를 계속 분리한다.


## 현재 데이터 Gate (2026-09-19)
- Catalog 26 / Alias 96 / enabled target 26
- 현재 상태 확보 25 / 26
- Brookhaven 1개는 Public Games API 누락으로 unavailable + longtail backoff
- 실제 24H Hourly readiness 통과 Game: 아직 0개
- 이는 결함이 아니라 2026-09-19에 시작한 실데이터가 24시간을 채우는 중이기 때문이다.
- 이 Gate가 채워지기 전에는 데이터 행을 인위적으로 생성하거나 24H/7D/30D 값을 공개하지 않는다.

최종 사용자 승인 전에는 **PR merge / Production promote / 도메인 연결 / noindex 해제 / 전체 Game 일괄 indexable 전환을 하지 않는다.**


## Sprint 02 Community Gate

- [x] Account/Auth server boundary
- [x] 만 14세 이상 자기 확인값 private 저장
- [x] Questions / Answers / Comments
- [x] Game Follow
- [x] Notifications
- [x] Reports
- [x] Moderator/Admin 역할 분리
- [x] Moderation action audit
- [x] DB write rate limits
- [x] 연락처 / Roblox 세션정보 / 악성 패턴 기본 차단
- [x] Community RLS + least-privilege grants
- [x] Community / Account noindex
- [x] Mobile Community navigation

도메인 확정 뒤에만 확인 가능한 항목:
- [ ] Supabase Auth Site URL = 최종 HTTPS 도메인
- [ ] Email confirmation redirect 실제 검증
- [ ] Login → access expiry/refresh → logout 실제 브라우저 검증
- [ ] 첫 운영자 계정 생성 후 admin role 수동 지정
- [ ] 실제 사용자 2계정 이상으로 질문 → 답변 → 채택 → 댓글 → 신고 → 운영 조치 E2E

위 항목은 운영 도메인/실제 계정이 필요한 검수이므로 Preview 코드나 가짜 데이터로 통과시키지 않는다.


## Sprint 03 Content Gate

- [x] Content Source provenance
- [x] Verified Code state / freshness
- [x] Guide draft / publish / index state
- [x] provider updated timestamp observation
- [x] Admin-only Content Studio
- [x] Source↔Game integrity checks
- [x] Content-specific sitemap gates
- [x] Empty-state policy: 검증 자료가 없으면 만들지 않음
- [x] Codes / Guides / Updates mobile QA

출시 전 실제 콘텐츠 조건:
- [ ] indexable Game마다 필요한 경우 공식/직접검증 Source 등록
- [ ] 공개 Code는 마지막 확인 시각 재검수
- [ ] 공개 Guide는 출처와 본문을 사람이 검수
- [ ] provider update observation을 패치노트처럼 표현하지 않는지 확인

실제 검증 콘텐츠가 없는 Game은 Data/Q&A만 유지하고 빈 Code/Guide를 SEO 목적으로 채우지 않는다.


## Sprint 04 Party / Trust Gate

- [x] Game-context Party 모집
- [x] Party capacity DB lock
- [x] Host auto-membership
- [x] Join / Leave / Close RPC
- [x] Roblox-domain-only optional join URL
- [x] 외부 연락처 / 인증정보 필터 재사용
- [x] Party Report / Moderation
- [x] Public contribution summary
- [x] Party roster 비공개
- [x] Party/Profile noindex
- [x] Transactional multi-user DB E2E + rollback
- [x] Supabase Security Advisor 0 findings

운영 전 실제 계정으로 파티 모집→참여→나가기→닫기→신고→운영 숨김 흐름을 최종 HTTPS 환경에서 다시 확인한다.


## Sprint 05 Community Analytics Gate

- [x] Open Cloud provider isolated from normal Game data collector
- [x] `group-forum:read` only
- [x] Feature flag defaults OFF
- [x] API key is server-only
- [x] verified target workflow
- [x] Game creator Group ID ownership match before authorization
- [x] enabled target requires authorized + verified DB state
- [x] aggregate-only storage; no Forum body/author/user ID
- [x] observed-count naming + truncation marker
- [x] protected internal run endpoint
- [x] Preview-only admin readiness screen
- [x] CI forces feature OFF

실제 Open Cloud credential/Group target은 소유·권한이 확인되기 전에는 설정하지 않는다.
따라서 target 0 / snapshot 0은 현재 의도된 fail-closed 상태다.
Community Analytics 활성화는 도메인/noindex 해제와 별개의 운영 승인 항목이다.


### Preview sitemap

Global noindex가 잠겨 있는 동안 `/sitemap.xml`은 URL entry를 0개로 유지한다.
robots.txt의 전체 Disallow만 믿고 Preview URL을 sitemap에 광고하지 않는다.
실제 release gate 3조건이 모두 충족된 뒤에만 static URL + 사람이 승인한 indexable Game/Content를 sitemap에 포함한다.


### Review build metadata

`/review-build.json`은 Preview 검수 전용이다.
Index release가 성립한 운영 모드에서는 404를 반환해 branch/build/gate 상태를 공개 표면에 남기지 않는다.
