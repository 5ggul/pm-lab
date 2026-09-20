# R1 Release Gate

운영 도메인 연결 또는 noindex 해제 전에 아래 항목이 모두 충족돼야 한다.

## 데이터

- 활성 게임 26개 중 출시 대상은 `r1_game_index_readiness.data_ready_for_index_review = true`
- 현재값 freshness: 20분 이내
- 최근 24시간 hourly bucket: 24개 이상
- trusted hourly bucket (coverage >= 0.70): 18개 이상
- 평균 coverage: 0.70 이상
- 사용자용 한국어 설명: 80자 이상
- 공식 hero image 존재
- independent value gate 충족
- stale CCU는 현재값으로 표시하지 않음

Brookhaven처럼 공식 primary provider가 현재값을 반환하지 않는 게임은 `collecting`에 남기고 출시 대상에서 제외한다. 과거 CCU를 현재값처럼 복제하거나 추정하지 않는다.

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
- Supabase Security Advisor 0 findings

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
