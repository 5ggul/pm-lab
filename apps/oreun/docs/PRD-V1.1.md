# R1 오름 PRD v1.2 — Preview Build through Sprint 05

- 기준일: 2026-09-19
- 배포 정책: Preview only. Production promote/domain 연결/noindex 해제 금지.
- 제품 루프: Search → Data → Content → Community → Follow → Return
- 중심 Entity: Game (`universe_id`)

## 제품 원칙

DATA FIRST / COMMUNITY IN CONTEXT / SEARCH FIRST / MOBILE FIRST / FRESHNESS FIRST / TRUST FIRST.

현재 Preview는 Sprint 01의 Data Foundation을 바꾸지 않고 Sprint 02~05 Domain을 순서대로 추가한다.
실데이터가 없거나 출처를 확인할 수 없으면 빈 상태를 보여 주며, 값이나 콘텐츠를 만들어내지 않는다.

## Sprint 01 — Data Foundation

구현:
- Universe ID / Root Place ID / SEO slug 분리
- Roblox Public Games Provider Adapter
- 전용 Supabase Preview DB
- Raw Snapshot / Hourly / Daily
- Adaptive Collector + lease + ingestion accounting
- provenance / freshness / confidence
- Popularity / Trend v1.1 foundation
- Home / Games / Rising / Game Hub / Search
- noindex release guard / launch-readiness
- 360/375/390/430px browser QA

실제 Historical Data는 2026-09-19부터 누적 중이다.
24H/7D/30D 값은 coverage가 충분하기 전에는 공개하지 않는다.

## Sprint 02 — Account · Q&A · Follow

구현:
- Supabase Auth account boundary
- 공개 Profile
- Game-context Question / Answer / Comment
- Follow / Notification
- Report / Moderation / immutable moderation actions
- DB rate limit / RLS / least-privilege grants
- 연락처·세션쿠키·위험 패턴 기본 차단
- Community/Account noindex

1:1 DM, 외부 연락처 교환, Robux 거래 기능은 넣지 않는다.

## Sprint 03 — Codes · Guides · Updates

구현:
- Content source provenance
- verified Code / editorial Guide
- Provider update timestamp observation
- Game Hub Codes / Guides / Updates
- admin-only Content Studio
- 콘텐츠별 보수적 index gate

검증된 Source가 없으면 published 콘텐츠를 만들지 않는다.
Update는 확인하지 못한 패치 내용을 추측하지 않는다.

## Sprint 04 — Party · Community Trust

구현:
- Game-context Party 모집
- 2~12명 capacity / transaction-safe join
- Host membership / Join / Leave / Close
- roblox.com HTTPS만 허용하는 선택적 join URL
- Party report / moderation
- 설명 가능한 공개 기여 요약

Roster는 비공개이며, 공개 기여 수치는 점수·등급·랭킹으로 표현하지 않는다.

## Sprint 05 — Roblox Community Analytics

구현 경계:
- Roblox Open Cloud Group Forum Beta Provider
- `group-forum:read` 전용 읽기
- server-only API Key
- Feature flag 기본 OFF
- 실제 권한 검증을 통과한 Group target만 등록
- Category/Post/Comment의 제한된 관측 집계만 저장
- Forum 본문·제목·작성자·사용자 ID는 저장하지 않음
- bounded sample은 `truncated`와 함께 보존하고 전체 총계로 가장하지 않음
- Preview-only `/admin/community-analytics`
- 보호된 내부 run endpoint

현재 외부 Live Community Analytics는 API Key와 승인 target을 임의 생성하지 않기 때문에 OFF 상태가 정상이다.
상세 운영 규칙은 `docs/COMMUNITY-ANALYTICS.md`를 따른다.

## 최종 공개 Gate

사용자 최종 승인 전에는 다음을 하지 않는다.
- PR merge
- Production promotion
- 운영 도메인 연결
- Global noindex 해제
- Game 일괄 indexable 전환
- Community Analytics 임의 활성화

Game 색인 검토는 최근 current Snapshot, 고유 한국어 설명, 최근 24시간 Hourly bucket 24개 이상,
24시간 평균 raw coverage 70% 이상을 충족한 candidate에 대해 사람이 검토한 뒤 진행한다.
