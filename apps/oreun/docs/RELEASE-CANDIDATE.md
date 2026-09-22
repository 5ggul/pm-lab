# R1 오름 — Release Candidate Handoff

기준일: 2026-09-22

이 문서는 Sprint 01~05 통합 후 사용자가 도메인 연결과 색인 해제를 결정하기 전 마지막 검수 기준이다.

## 현재 코드 기준

Base chain:
Sprint 01 Data → Sprint 02 Community → Sprint 03 Content → Sprint 04 Party/Trust → Sprint 05 Community Analytics → Release Candidate

Release Candidate branch:
`feat/r1-oreun-release-candidate`

Production merge/domain/noindex 변경은 금지 상태다.

Current Preview:
PR #236 본문의 “현재 실제 Preview” URL을 기준으로 한다. Dedicated Worker name은 `oreun-r1-preview`.

정확한 최종 HEAD와 Main/Hosted QA run ID는 PR #236 본문을 source of truth로 사용한다.

## 반드시 유지되는 잠금

- `R1_PREVIEW_NO_INDEX=1`
- `R1_INDEX_RELEASE_CONFIRM=0`
- Game `index_state` 일괄 승격 금지
- Community Analytics feature 기본 OFF
- Open Cloud credential/target 임의 생성 금지

Preview에서는:
- meta robots noindex
- X-Robots-Tag noindex
- robots.txt 전체 Disallow
- sitemap URL entry 0

## 색인 해제 3조건

다음 3개가 동시에 참일 때만 release 된다.

1. `R1_PREVIEW_NO_INDEX=0`
2. `R1_INDEX_RELEASE_CONFIRM=1`
3. `NEXT_PUBLIC_SITE_URL`이 검증 가능한 실제 공용 HTTPS origin

local/private/reserved host는 release origin으로 인정하지 않는다.

## 최종 사용자 검수 범위

Public:
- Home
- Games
- Rising
- Search / Korean aliases
- Game Hub
- Codes / Guides / Updates
- Game Q&A
- Party
- About / Methodology / Guidelines / Privacy / Youth / Terms / Disclaimer

Account / UGC:
- Login
- Me
- Notifications
- Question detail
- Public profile

Internal / Operator:
- Preview diagnostics: Data Status / Launch Readiness / Community Analytics
- Operator: Content Studio / Moderation Queue

## Admin release behavior

Preview diagnostics 3종은 Production release mode에서 404가 정상이다.
Content Studio와 Moderation Queue는 운영에 필요한 화면이므로 로그인 및 admin/moderator 역할 뒤에 남고 검색엔진 노출은 금지한다.

## 데이터 Gate

Game 색인 검토 최소선:
- candidate/indexable 상태
- target collector cadence의 2배 이내 current snapshot (최소 20분)
- 고유 한국어 설명 80자 이상
- 공식 Hero media 존재
- 최근 24시간 롤링 창 Hourly bucket 23개 이상
- 그중 coverage 70% 이상인 trusted Hourly bucket 18개 이상
- 24시간 평균 raw coverage 70% 이상

이 기준은 자동 indexable 승격 조건이 아니다.
사람이 Preview를 확인한 Game만 최종 승격한다.

Data readiness는 rolling 24-hour window라 실시간으로 변한다. Exact count는 `/admin/launch-readiness`와 PR #236의 최신 handoff를 기준으로 하며 release preflight는 최소 25/26을 요구한다. 2026-09-22 19:27 KST 스냅샷은 24/26이다: Brookhaven은 **KR regional unavailable**, Arsenal은 current/fresh·failure 0이지만 최근 cadence 변화로 Hourly bucket이 22/23이라 보수적으로 BLOCK됐다. 이 transient 상태를 통과시키기 위해 threshold를 낮추거나 history를 backfill하지 않는다.

Brookhaven 처리 원칙:
- current CCU는 `null` 유지
- 한국 리전 제한을 해외 relay로 우회하지 않음
- 6시간마다 제한 해제 여부만 재확인
- 마지막 정상 관측치는 history에만 보존
- 상세 화면과 게임 목록에 한국 이용 제한 상태를 명시
- live-current readiness 26/26을 출시 조건으로 강제하지 않음

`R1_ROBLOX_RELAY_URL`은 별도 검토된 provider 장애에만 opt-in으로 사용할 수 있으며 지역 제한 우회 용도로 설정하지 않는다.

## Editorial / Community state

- official Source 26
- Guide 26 approved + published + noindex
- published Code 0
- active Preview admin 1
- Supabase Google provider enabled (`external.google=true`)
- Google OAuth PKCE authorize path reaches Google Accounts with the expected Supabase callback
- hosted Before User Created Hook rejects new email users with HTTP 403; verification residue 0
- Google identity 0 (real Google account browser login pending)
- active Google-backed admin 0
- two-user authenticated-role/RLS community rollback E2E passed with zero residue
- actual Google browser E2E remains external gate

## Community Analytics

기본 OFF.
실제 수집을 켜기 전에:
- Universe가 R1 verified catalog에 존재
- Roblox Public Games creator Group이 target Group과 일치
- Open Cloud `group-forum:read` 실제 호출 성공
- target enabled를 명시적으로 승인

저장 대상은 bounded observed aggregate뿐이며 Forum body/title/author/user ID는 저장하지 않는다.

## Release preflight

운영 도메인/Google provider 설정 후 아래 명령이 PASS하기 전에는 index release를 진행하지 않는다.

`npm run release:preflight`

이 명령은 public HTTPS origin, release flags, Google provider, Google-only 신규가입 Hook 실제 검증 확인, 실제 Google identity, Google-backed admin, Google 브라우저 E2E 확인, 2계정 브라우저 E2E 확인, 25/26 data readiness, Brookhaven 단일 unavailable, 26 verified Sources/Guides, published Code integrity를 검사하고 하나라도 어긋나면 exit 1로 중단한다.

## 최종 승인 후 실행 순서

1. 실제 운영 HTTPS 도메인 확정
2. Hosting Preview/Production 환경변수 분리
3. canonical/OG/robots/sitemap 검수
4. 24H data readiness 검수
5. 승인 Game만 `indexable`
6. Preview diagnostic admin과 `/review-build.json`이 release mode에서 404인지 확인
7. Operator admin 비로그인/권한 차단 확인
8. `R1_INDEX_RELEASE_CONFIRM=1`
9. `R1_PREVIEW_NO_INDEX=0`
10. 실제 운영 응답의 meta/X-Robots/robots/sitemap 재검수
11. Search Console 제출

## Remaining external/manual gates

- Google Auth Platform Audience/branding 최종 확인; Testing이면 실제 운영자 계정을 Test user에 등록
- real Google login / 14+ onboarding / refresh / logout browser E2E
- 기존 legacy email login fallback 최종 확인 후 `R1_GOOGLE_ONLY_SIGNUP_HOOK_CONFIRM=1`
- Google operator account admin transfer/confirmation
- real two-Google-account community browser E2E
- final Production HTTPS domain and Site URL

## 현재 하지 않는 것

- PR merge
- Production promote
- domain 연결
- global noindex 해제
- bulk indexable
- 가짜 Historical Data
- 가짜 Open Cloud credential/target
