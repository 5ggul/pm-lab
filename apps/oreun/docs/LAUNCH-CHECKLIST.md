# R1 오름 Launch Checklist

현재 목표는 사용자 최종 검수 전 Preview 상태를 고정하는 것이다.

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

## 현재 의도적으로 유지

### Global noindex

Preview 환경은 R1_PREVIEW_NO_INDEX=1 상태를 유지한다.
이 상태에서는 HTML robots meta가 noindex이고 robots.txt가 전체 disallow다.
사용자 최종 승인 전 변경하지 않는다.

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

1. NEXT_PUBLIC_SITE_URL을 운영 도메인으로 확정한다.
2. Hosting public/server 환경변수를 Preview와 Production에 분리한다.
3. Production 전용 Supabase 분리 여부를 확정한다.
4. /admin/launch-readiness에서 Game별 data readiness를 검토한다.
5. 사람이 승인한 candidate Game만 indexable로 승격한다.
6. 마지막에 R1_PREVIEW_NO_INDEX=0으로 변경한다.
7. robots.txt / sitemap.xml / canonical / OG를 다시 확인한다.

권장 순서: 도메인·Canonical 확인 → index_state 승인 → noindex 해제.

## Hosting 환경변수

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
