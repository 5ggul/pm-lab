# R1 오름 Sprint 03 — Verified Content

기준일: 2026-09-19

## 목적

Codes / Guides / Updates를 단순 SEO 페이지 양산으로 만들지 않는다.
모든 공개 콘텐츠는 검증 출처, 확인 시각, 공개 상태와 색인 상태를 분리한다.

## Codes

공개 조건:
- visibility = published
- source_id 필수
- last_checked_at 필수
- active 상태는 verified_at 필수

페이지는 마지막 확인이 7일을 넘으면 “재확인 필요”로 표시한다.
색인 후보가 되려면:
- Global release gate 통과
- Game index_state = indexable
- 최근 7일 내 확인한 active published Code 1개 이상

실제 검증된 Code가 없으면 “없음”을 표시한다.
외부 목록을 복사해서 채우지 않는다.

## Guides

공개 조건:
- content_status = published
- source_id 필수
- body 최소 길이 충족

Guide index_state는 noindex / indexable로 별도 관리한다.
Game이 indexable이더라도 Guide가 자동으로 indexable이 되지 않는다.

가이드 본문은 현재 plain text 기반으로 출력한다.
사용자 HTML을 렌더링하지 않아 스크립트 삽입 면적을 만들지 않는다.

## Update observations

game_provider_state.source_updated_at 변경을 DB Trigger가 감지한다.

저장:
- source_updated_at
- first_observed_at
- event_kind
- Roblox game URL

event_kind:
- baseline: R1 수집 시작 당시 이미 존재하던 실제 source_updated_at
- provider_update_detected: Collector가 이전 값보다 새로운 source_updated_at을 관측

이 정보는 “업데이트가 있었다는 시각 신호”일 뿐 패치 내용을 의미하지 않는다.
오름은 패치 내용을 추측해서 생성하지 않는다.

## Content Studio

/admin/content

Admin만 접근할 수 있다.

지원:
- 검증 Source 등록
- Code 등록 / 재확인 / 만료 처리
- Guide draft / publish / archive
- Guide index candidate 선택

DB도 private.r1_is_admin()으로 다시 검증하므로 UI 차단만 신뢰하지 않는다.

## Provenance integrity

- Source HTTPS 필수
- Source의 Game과 Guide/Code Game 일치 검증
- identity / universe / created_at 임의 변경 금지
- published Guide Source 필수
- published Code Source + check timestamp 필수
- active Code verified timestamp 필수

## SEO / Sitemap

Sitemap은 Game DB의 persisted index_state를 기준으로 한다.

추가 Content URL은 다음 조건일 때만 sitemap에 들어간다.
- Guides: published + guide indexable
- Codes: active + recently checked
- Updates: provider_update_detected 존재

Preview global noindex는 그대로 유지한다.

## 실제 Preview 검증

DB Transaction + Rollback 방식으로:
- Admin role
- Source insert
- published/indexable Guide insert
- active/published Code insert
- anon public read
- provider source_updated_at 변경 → provider_update_detected 생성

을 확인했다.

Transaction 종료 후:
- Auth test user 0
- Source 0
- Guide 0
- Code 0
- synthetic provider_update_detected 0

즉 테스트 데이터는 Preview DB에 남기지 않았다.

기존 실제 current-state에서 생성한 baseline update event만 유지한다.
