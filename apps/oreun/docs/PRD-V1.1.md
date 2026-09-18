# R1 오름 PRD v1.1 — Sprint 01 Data Foundation

- 기준일: 2026-09-18
- 배포 정책: Preview only. Production promote/domain 연결 금지.
- 제품 루프: Search → Data → Content → Community → Follow → Return
- 현재 Sprint: Game DB → Snapshot Collector → 인기/급상승 → Game Detail → Game Search

## 제품 원칙
DATA FIRST / COMMUNITY IN CONTEXT / SEARCH FIRST / MOBILE FIRST / FRESHNESS FIRST / TRUST FIRST.

Sprint 01에서는 커뮤니티 기능을 흉내 내지 않는다. 계정, Follow, 질문/댓글, Codes/Guide UI, Party, Community Forum, 광고는 후속 Sprint다.

## Sprint 01 성공 조건
1. Universe ID와 Root Place ID를 분리하고 slug를 identity로 쓰지 않는다.
2. Roblox 외부 API가 Provider Adapter 뒤에 격리되어 있다.
3. 현재 데이터, fallback, R1 파생값이 구분된다.
4. Snapshot의 결측을 0으로 변환하지 않는다.
5. 429/timeout/partial failure가 전체 batch 장애로 번지지 않는다.
6. Popularity와 Trending이 분리된다.
7. Trend는 낮은 baseline 폭등을 보정하고 version/component를 보존한다.
8. alias 검색이 `라이벌/라이벌즈/rivals`를 같은 Universe에 연결한다.
9. 360/375/390/430px과 Desktop 브라우저 QA를 통과한다.
10. 실히스토리가 부족하면 ‘데이터 수집 중’으로 표시한다.

## 다음 순서
Sprint 02: Account/Q&A/Comment/Follow/Notification/Report/Moderation
Sprint 03: Codes/Guides/Updates/SEO Content
Sprint 04: Party/Community Feed/Trust
Sprint 05: Roblox Community Analytics (feature flag)
