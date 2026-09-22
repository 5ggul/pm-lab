# R1 오름 — Google 로그인 외부 설정

기준일: 2026-09-22

앱 코드는 Google OAuth PKCE + HttpOnly session cookie 흐름까지 구현되어 있다.
이 문서는 외부 Google Cloud / Supabase 설정만 다룬다.

## 현재 고정값

Supabase project:
`galfwxoytdcndjihdnyg`

Google에 등록할 Supabase callback:
`https://galfwxoytdcndjihdnyg.supabase.co/auth/v1/callback`

현재 고정 Preview:
- `https://oreun-r1-preview.vercel.app`
- 전용 Vercel Preview 프로젝트이며 운영 서비스와 분리
- global noindex / X-Robots-Tag noindex / robots 전체 Disallow 유지
- GitHub Actions가 같은 주소를 새 빌드로 갱신
- Cloudflare temporary Workers Preview는 외부 호스팅 회귀 QA fallback으로만 유지

오름 Preview callback:
- `https://oreun-r1-preview.vercel.app/auth/google/callback`

## 현재 Preview 실제 검증 상태

2026-09-22 19:25 KST 기준:

- Supabase Auth `/auth/v1/settings`: `external.google=true`
- 고정 Preview `/login`: `Google로 계속하기` 활성
- `/auth/google?next=/me`: PKCE `code_challenge`와 고정 Preview callback 생성 확인
- Supabase `/auth/v1/authorize?provider=google`: Google Accounts 로그인 화면까지 도달
- Google redirect URI: `https://galfwxoytdcndjihdnyg.supabase.co/auth/v1/callback`
- Before User Created Hook: Hosted Auth 실제 신규 email OTP 가입 요청을 HTTP 403으로 차단
- 차단 메시지: `New accounts must be created with Google.`
- Hook 검증용 test user DB residue: 0
- Google identity: 0 — 실제 Google 계정 브라우저 로그인만 남음
- Google provider 활성화 뒤 발견된 Next.js OAuth Link prefetch CORS 문제는 일반 `<a>` full navigation으로 수정했으며 Main/Stable/Hosted 브라우저 QA를 다시 통과시킨다.


## 1. Google Cloud

Google Auth Platform에서 Web application OAuth Client를 만든다.

Audience:
- 일반 사용자 대상이면 External
- Google Auth Platform이 Testing 상태라면 실제 E2E에 사용할 운영자 Google 계정을 Test user에 반드시 추가
- Production 공개 전에는 Audience/Publishing status와 앱 이름·지원 이메일·정책 URL을 다시 검수

필수 scope:
- `openid`
- `userinfo.email`
- `userinfo.profile`

Authorized JavaScript origin:
- `https://oreun-r1-preview.vercel.app`

Authorized redirect URI:
- `https://galfwxoytdcndjihdnyg.supabase.co/auth/v1/callback`

Google Cloud Web OAuth Client의 Authorized redirect URI는 앱 Preview 주소가 아니라 Supabase callback만 등록한다:
- `https://galfwxoytdcndjihdnyg.supabase.co/auth/v1/callback`

Google 로그인 Preview origin이 바뀌더라도 Google Cloud redirect URI는 Supabase callback을 유지한다.
다만 Google Web Client의 Authorized JavaScript origins에는 실제 로그인 화면의 origin을 등록한다.

운영 도메인이 확정되면 최종 HTTPS origin을 Authorized JavaScript origins에 추가하고 Preview 전용 origin은 최종 공개 뒤 정리한다.

Client ID와 Client Secret은 저장소, PR, 브라우저 코드에 넣지 않는다.

## 2. Supabase Google provider

Supabase Dashboard → Authentication → Sign In / Providers → Google.

- Google provider Enable
- Google Cloud의 Client ID 입력
- Google Cloud의 Client Secret 입력
- Skip nonce check를 임의로 켜지 않음

저장 후 `/auth/v1/settings`의 `external.google`이 true여야 한다.
오름 로그인 화면은 이 값을 서버에서 확인해 Google 버튼을 자동 활성화한다.

## 3. Google-only 신규가입 Auth Hook

앱 UI에서 이메일 신규가입 버튼을 없애는 것만으로는 Supabase Auth API를 직접 호출한 신규가입까지 막을 수 없다.
기존 이메일/password 운영자 계정 로그인 fallback은 유지하면서 **새 계정 생성은 Google만 허용**하도록 아래 Postgres Auth Hook 함수를 사용한다.

Migration:
- `20260922000200_r1_google_only_new_signup_hook.sql`
- function: `public.r1_before_user_created_google_only(jsonb)`

Hosted Supabase에서는 migration 적용만으로 Hook이 자동 활성화되지는 않는다.

Google provider 연결 직후:
1. Supabase Dashboard → Authentication → Hooks (Beta)
2. `Before User Created` 선택
3. Postgres Function으로 `public.r1_before_user_created_google_only` 선택
4. 저장
5. 신규 Google 계정 생성은 성공하는지 확인
6. 신규 email/password 가입 요청은 403으로 거부되는지 확인
7. 기존 email/password 계정 로그인은 계속 성공하는지 확인
8. 위 3가지 실제 검증이 끝난 환경에서만 `R1_GOOGLE_ONLY_SIGNUP_HOOK_CONFIRM=1`

이 Hook은 **새 Auth user 생성 전에만** 실행되므로 이미 존재하는 legacy email identity의 로그인에는 영향을 주지 않는다.

## 4. Supabase Redirect URLs

Authentication → URL Configuration.

Preview QA용 Supabase Redirect URL:
- `https://oreun-r1-preview.vercel.app/auth/google/callback`

보조 Cloudflare temporary QA를 OAuth까지 검증할 필요가 생길 때만 아래 wildcard를 추가로 사용할 수 있다:
- `https://oreun-r1-preview.*.workers.dev/auth/google/callback`

정상 Google 실계정 Preview E2E는 고정 Vercel URL을 사용한다.

운영 공개 시에는 최종 HTTPS 도메인의 정확한 callback을 별도로 등록한다:
- `https://<FINAL_DOMAIN>/auth/google/callback`

Site URL도 운영 도메인 확정 후:
- `https://<FINAL_DOMAIN>`

## 5. 실제 계정 E2E

외부 설정 후 반드시 실제 브라우저에서 확인한다.

1. `/login`에서 Google 버튼이 활성인지 확인
2. 신규 Google 계정으로 로그인
3. Google → Supabase → `/auth/google/callback` 복귀
4. `/me?welcome=google` 진입
5. 만 14세 확인 전 질문/답변/댓글/파티 쓰기 권한이 잠겨 있는지 확인
6. 공개 handle 설정 + 만 14세 이상 확인
7. 로그인 전에 요청했던 `next` 페이지로 복귀
8. 새로고침 후 로그인 유지
9. 로그아웃 후 보호 페이지가 다시 `/login`으로 이동
10. DB에서 `auth.identities.provider='google'` 확인
11. Google 운영자 계정에 admin 권한 이전·확정
12. 로그인 → refresh → logout까지 실제 브라우저에서 재확인
13. 완료 후에만 운영 환경에서 `R1_GOOGLE_E2E_CONFIRM=1`
14. 실제 Google 계정 2개로 질문→답변→채택→댓글→신고→운영조치 재검증
15. 완료 후에만 운영 환경에서 `R1_COMMUNITY_E2E_CONFIRM=1`

## 6. 기존 이메일 계정 종료 순서

현재 Preview DB에는 기존 email identity가 있으므로 Google provider를 연결하기 전에
이메일 provider를 먼저 끄지 않는다.

권장 순서:
1. Google provider 활성화
2. 실제 운영자 Google 계정 최초 로그인
3. 만 14세 확인 + profile 생성 확인
4. 운영자/admin 권한을 Google 계정으로 이전 또는 확정
5. Google 로그인 refresh/logout E2E 완료
6. 기존 이메일 계정이 더 이상 복구 경로로 필요 없는지 확인
7. 그 뒤에만 이메일/password fallback 제거 여부를 결정

현재 앱 UI에는 신규 이메일 가입 경로가 없고, Preview DB에는 Google-only 신규가입 Hook 함수도 적용한다.
다만 hosted Auth Hook 활성화는 Dashboard 설정이므로 Google provider 연결 직후 반드시 Before User Created Hook을 켜고 실제 가입 거부를 검증한다.

## 7. 출시 Gate

아래가 모두 완료되기 전에는 Google Auth를 RELEASE READY로 보지 않는다.

- Google OAuth consent/branding 설정
- Audience 설정 확인; Testing이면 실제 운영자 Google 계정을 Test user에 등록
- Google Web Client 생성
- Supabase callback 등록
- Supabase Google provider enabled
- Preview 또는 운영 callback allowlist 등록
- Before User Created Hook 활성화
- 신규 Google 계정 생성 성공 + 신규 email/password 가입 403 거부
- `R1_GOOGLE_ONLY_SIGNUP_HOOK_CONFIRM=1`
- 기존 email/password fallback 로그인 유지 확인
- 실제 Google 신규 계정 E2E
- 14세 gate 검증
- refresh/logout 검증
- Google-backed active admin 1개 이상
- `R1_GOOGLE_E2E_CONFIRM=1`
- 실제 Google 2계정 커뮤니티 브라우저 E2E
- `R1_COMMUNITY_E2E_CONFIRM=1`
- 운영 도메인 확정 후 exact redirect URL 재검수
- Google 운영자 계정 확보 후 이메일/password fallback 유지 여부 최종 결정

PR merge, Production promote, noindex 해제와는 별도 승인 항목이다.
