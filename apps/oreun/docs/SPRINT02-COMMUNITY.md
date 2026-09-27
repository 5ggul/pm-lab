> 2026-09-24 정책 변경: 초기의 만 14세 자기확인 게이트는 폐기되었고 현재 작성 권한에는 사용하지 않습니다. 아래 내용은 당시 설계 기록입니다.

# R1 오름 Sprint 02 — Account / Q&A / Follow / Moderation

기준일: 2026-09-19

Sprint 02는 Sprint 01의 Game/Data Foundation을 변경하지 않고 그 위에 사용자 계정과 Game-context Community를 추가한다.

## 제품 경계

포함:
- Supabase Auth 이메일/비밀번호 계정
- 공개 프로필
- 만 14세 이상 자기 확인
- 게임별 질문 / 답변 / 댓글
- 답변 채택 / 질문 닫기
- 게임 팔로우
- 알림
- 신고
- Moderator/Admin 운영 큐
- 운영 조치 Audit
- 기본 쓰기 Rate Limit
- 개인정보·외부 연락처·Roblox 인증정보 패턴 차단

제외:
- 1:1 DM
- 외부 연락처 교환 기능
- 계정·Robux·아이템 거래
- Party Chat
- Roblox OAuth
- Roblox 개인 Presence / 친구 그래프
- 광고

## 인증 구조

브라우저에 노출 가능한 값:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

서버 Secret:
- 기존 SUPABASE_SECRET_KEY / service-role은 Collector·관리 서버 전용
- Community 사용자가 직접 service-role을 받는 경로는 없음

오름의 Auth UI는 Supabase Auth REST를 사용한다.

세션 쿠키:
- oreun_access
- oreun_refresh
- HttpOnly
- SameSite=Lax
- 운영 HTTPS에서는 Secure

서버에서 사용자를 신뢰해야 하는 작업은 저장된 사용자 객체가 아니라 Supabase Auth /user 응답으로 현재 access token을 검증한다.

## 나이 정책

초기 Community 쓰기는 만 14세 이상 자기 확인이 필요하다.

- 생년월일 수집 안 함
- 공개 profile에 나이값 저장 안 함
- private.user_status.age_confirmed_14_plus에만 저장
- 글쓰기 전에 active 계정 + age confirmation을 함께 확인

이는 법적 연령 검증 서비스를 가장하는 구조가 아니라 초기 제품의 안전 Gate다.

## 데이터 모델

Public:
- profiles
- questions
- answers
- comments
- game_follows
- notifications
- reports
- moderation_actions

Private:
- user_status
- user_roles
- ugc_rate_limits

Read views:
- r1_question_feed
- r1_answer_feed
- r1_comment_feed

Public 질문/답변/댓글 view는 visible 상태만 노출한다.

## 쓰기 제한

DB Trigger 기준 1시간:
- 질문 5개
- 답변 20개
- 댓글 30개
- 신고 10개

App UI 제한이 아니라 DB에서 다시 검증한다.

차단 패턴 예:
- .ROBLOSECURITY
- Discord invite
- 이메일 주소
- 국내 휴대전화 형식
- Kakao/Telegram ID 유도
- javascript: / script 패턴

이 필터는 Moderation을 대체하지 않는다.

## 알림

현재 자동 생성:
- 팔로우한 Game에 새 질문
- 내 질문에 새 답변
- 내 질문 댓글
- 내 답변 댓글
- 내 답변 채택

알림 INSERT 권한은 일반 사용자에게 주지 않는다.
DB Trigger가 생성하며 사용자는 자기 알림 SELECT/읽음 처리만 가능하다.

## 신고 / Moderation

신고 대상:
- question
- answer
- comment
- profile

운영 역할:
- user
- moderator
- admin

운영자는 사용자 원문을 임의 편집하지 않는다.
질문/답변/댓글은 visible ↔ removed 상태를 변경하고 moderation_actions에 사유를 기록한다.

첫 Admin 지정은 공개 UI가 아니라 서버/SQL 운영 절차로만 수행한다.

예:
```sql
update private.user_roles
set role = 'admin', updated_at = now()
where user_id = '<VERIFIED_AUTH_USER_UUID>';
```

사용자 UUID를 반드시 Supabase Auth Dashboard에서 확인한 뒤 실행한다.

## RLS / DB Security

- public UGC 테이블은 모두 RLS ON
- private community 테이블도 RLS ON
- private tables는 anon/authenticated direct access deny
- public 질문 읽기와 authenticated 본인 쓰기를 분리
- notifications는 본인만 조회/읽음 변경
- game_follows는 본인 행만
- reports는 신고자 또는 Moderator만 조회
- moderation_actions는 Moderator만
- public permission RPC는 SECURITY INVOKER
- 필요한 SECURITY DEFINER helper는 private schema에 두고 EXECUTE grant를 최소화

Supabase Security Advisor는 변경 후 다시 0 findings를 확인한다.

## 색인 정책

Sprint 02 Community/Account route는 초기에는 모두 noindex다.

- /login
- /me
- /notifications
- /community
- /game/[slug]/questions
- /questions/[id]
- /admin/moderation

Sprint 01 Game/Data SEO와 Community 품질 Gate를 섞지 않는다.

질문 페이지를 검색 색인 대상으로 바꾸는 것은 충분한 실제 UGC, Moderation 운영, 중복/저품질 방지 기준이 검증된 이후 별도 결정한다.

## 최종 도메인 연결 전 필수

1. NEXT_PUBLIC_SITE_URL을 실제 HTTPS 운영 도메인으로 설정
2. Supabase Auth Site URL을 동일 운영 도메인으로 설정
3. 허용 Redirect URL에 운영 로그인 경로를 등록
4. 실제 이메일 확인 → 로그인 → refresh → logout 실검증
5. 첫 관리자 계정 생성 후 private.user_roles에서 admin 지정
6. 신고 → 숨김 → 복원 → 신고 종결 flow 검증
7. Community route noindex 확인
8. Sprint 01 Game index readiness 별도 확인
9. 사용자 최종 승인 이후에만 Production/domain/index release 진행

## 현재 Preview 제약

- 운영 도메인이 아직 없으므로 이메일 확인 redirect의 최종 도메인 검증은 불가능하다.
- GitHub VERCEL_TOKEN 및 연결 Vercel Project가 없어 Full Next Hosted Preview는 현재 만들지 않는다.
- 이 제약 때문에 domain/noindex를 임의로 해제하지 않는다.
