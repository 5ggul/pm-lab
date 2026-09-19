# R1 오름 Sprint 04 — Party / Community Trust

기준일: 2026-09-19

## 목적

게임별 공개 파티 모집과 공개 기여 기록을 추가한다.
자유 채팅·1:1 DM·외부 연락처 교환 서비스로 확장하지 않는다.

## Party

경로:
- /game/[slug]/party

모집 필드:
- Game
- 제목
- 간단한 목표 설명
- playstyle
- 최대 인원 2~12
- 모집 만료 30분~6시간
- 선택적 Roblox HTTPS 링크

허용 링크:
- https://roblox.com/...
- https://www.roblox.com/...

Discord, 이메일, 전화번호, Kakao/Telegram ID와 Roblox 세션 쿠키 패턴은 기존 Community 필터로 제한한다.

## 참여 동시성

party_members 직접 INSERT/DELETE 권한을 사용자에게 주지 않는다.

Join / Leave / Close는 DB RPC로 처리한다.
Join은 Party row를 FOR UPDATE로 잠근 뒤 실제 membership 수를 확인하여 max_members 초과를 막는다.

Host는 Party 생성 시 자동으로 첫 member가 된다.
Host는 Leave 대신 Party Close를 사용한다.

## Privacy

공개 Party Feed에는:
- Host 공개 프로필 이름/handle
- 인원 수
- 모집 내용
- Roblox 링크
만 표시한다.

개별 Party member roster는 공개하지 않는다.
인증 사용자는 자기 membership row만 읽을 수 있다.

## Moderation

Party는 기존 Report 대상에 포함된다.
Moderator/Admin은 Party를 visible/removed로 바꿀 수 있고 moderation_actions에 사유를 기록한다.

## Public contribution profile

경로:
- /u/[handle]

표시:
- 공개 질문 수
- 공개 답변 수
- 채택 답변 수
- 공개 댓글 수
- 최근 공개 질문/답변

이 값은 “신뢰 점수”, 랭킹, 인증 배지가 아니다.
신고 수나 운영 내부 데이터는 공개 프로필에 노출하지 않는다.

## Indexing

Party와 Public Profile은 초기에는 noindex다.
실시간 모집 글과 사용자 프로필을 SEO 목적으로 자동 색인하지 않는다.

## 실제 Preview DB 검증

두 임시 계정으로 Transactional E2E 후 ROLLBACK:
- Host Party 생성
- Host 자동 membership
- 두 번째 사용자 Join
- 정원 도달 시 Full
- Leave 후 재오픈
- 재Join
- Party 신고
- Admin Party hide
- Moderation audit
- Q&A 채택 → Contribution summary 반영
- anon에서 removed Party feed 비노출
- anon Contribution summary 공개값 조회

Rollback 이후 테스트 User/Party/Member/Q&A/Report row가 모두 0임을 확인했다.

Supabase Security Advisor: 0 findings.
