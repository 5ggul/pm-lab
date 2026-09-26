# R1 Release Gate

운영 도메인 연결 또는 noindex 해제 전에 아래 항목이 모두 충족돼야 한다.

## 데이터

- 활성 게임 26개 중 출시 대상은 `r1_game_index_readiness.data_ready_for_index_review = true`
- 현재값 freshness: target collector cadence의 2배 이내(최소 20분)
- 최근 24시간 rolling hourly bucket: 23개 이상
- trusted hourly bucket (coverage >= 0.70): 18개 이상
- 평균 coverage: 0.70 이상
- 사용자용 한국어 설명: 80자 이상
- 공식 hero image 존재
- independent value gate 충족
- stale CCU는 현재값으로 표시하지 않음

Brookhaven처럼 공식 primary provider가 현재값을 반환하지 않는 게임은 `collecting`에 남기고 출시 대상에서 제외한다. 과거 CCU를 현재값처럼 복제하거나 추정하지 않는다.

Provider relay를 쓰는 경우에도 아래를 모두 통과해야 한다.
- explicit HTTPS relay endpoint
- exact universe ID / positive rootPlaceId
- finite non-negative current playing
- allowlisted source marker
- relay `fetchedAt`가 현재 기준 2분 이내
- future clock skew 30초 이내
- relay 실패·stale·invalid 시 fail closed / unavailable 유지

## 콘텐츠

- 활성 게임 26개 모두 검증 가이드 최소 1개
- 가이드마다 공식 Roblox 출처 URL
- 가이드마다 공식 hero + 공식 미디어
- 공식 영상이 있는 경우 공식 영상 노출
- 경험담, 미확인 티어, 확률, 시세, 비공식 코드 자동 생성 금지
- DB CMS 콘텐츠는 draft → pending → approved → published 게이트 통과

## 커뮤니티

- 가짜 질문, 답변, 파티 모집 생성 금지
- 0건 상태에서도 게임 → 검증 가이드 → 질문/파티 동선 제공
- 외부 연락처, Roblox 자격증명, .ROBLOSECURITY 수집 금지
- 관리자 계정 실사용 E2E 완료

## Auth

- 신규가입 UI는 Google OAuth만 노출
- Preview DB에 `public.r1_before_user_created_google_only(jsonb)` Before User Created 함수 존재
- hosted Auth에서 해당 Hook 활성화 후 신규 Google 가입 성공 / 신규 email 가입 403 / 기존 legacy email 로그인 유지 실제 검증
- 위 검증 뒤에만 `R1_GOOGLE_ONLY_SIGNUP_HOOK_CONFIRM=1`
- 실제 Google identity 1개 이상
- active + 만 14세 확인 Google-backed admin 1개 이상
- Google login/onboarding/refresh/logout 브라우저 E2E
- 실제 Google 2계정 커뮤니티 브라우저 E2E

## QA

최종 HEAD 기준:

- Typecheck PASS
- Unit tests PASS
- Production build PASS
- Dependency security audit PASS
- 360 / 375 / 390 / 430 / 768 / 1440 browser QA PASS
- 검증 가이드 hero/media/source/point 구조 PASS
- /guides 검색·유형 필터 PASS
- 이미지/영상 modal PASS
- 검색 alias PASS
- 필터/비교 PASS
- 업데이트 radar PASS
- Q&A/파티 빈 상태 PASS
- stale CCU 차단 PASS
- release/noindex guard PASS
- hosted actual Next.js Preview QA PASS
- Supabase Security Advisor 0 ERROR / 1 WARN (`Leaked Password Protection Disabled`, legacy password fallback 종료 전 추적)

## 색인 해제 순서

사용자 최종 승인이 있기 전에는 아래 값을 변경하지 않는다.

1. PR #236 최종 검수
2. 운영 도메인 연결
3. `NEXT_PUBLIC_SITE_URL=https://<production-domain>`
4. `R1_PREVIEW_NO_INDEX=0`
5. `R1_INDEX_RELEASE_CONFIRM=1`
6. robots / sitemap / canonical 확인
7. 대상 게임만 `indexable`로 승격
8. Search Console 제출

AdSense 코드는 색인/콘텐츠/운영 안정성 확인 이후 별도 단계로 진행한다.
