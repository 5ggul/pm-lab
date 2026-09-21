# R1 오름 — Google 로그인 외부 설정

기준일: 2026-09-21

앱 코드는 Google OAuth PKCE + HttpOnly session cookie 흐름까지 구현되어 있다.
이 문서는 외부 Google Cloud / Supabase 설정만 다룬다.

## 현재 고정값

Supabase project:
`galfwxoytdcndjihdnyg`

Google에 등록할 Supabase callback:
`https://galfwxoytdcndjihdnyg.supabase.co/auth/v1/callback`

현재 검증 Preview:
`https://oreun-r1-preview.fluff-browser.workers.dev`

오름 앱 callback:
`https://oreun-r1-preview.fluff-browser.workers.dev/auth/google/callback`

## 1. Google Cloud

Google Auth Platform에서 Web application OAuth Client를 만든다.

필수 scope:
- `openid`
- `userinfo.email`
- `userinfo.profile`

Authorized redirect URI:
- `https://galfwxoytdcndjihdnyg.supabase.co/auth/v1/callback`

Preview E2E 동안 Authorized JavaScript origin이 필요하면 현재 Preview origin을 사용한다:
- `https://oreun-r1-preview.fluff-browser.workers.dev`

운영 도메인이 확정되면 운영 origin을 추가하고 Preview 전용 origin은 최종 공개 뒤 정리한다.

Client ID와 Client Secret은 저장소, PR, 브라우저 코드에 넣지 않는다.

## 2. Supabase Google provider

Supabase Dashboard → Authentication → Sign In / Providers → Google.

- Google provider Enable
- Google Cloud의 Client ID 입력
- Google Cloud의 Client Secret 입력
- Skip nonce check를 임의로 켜지 않음

저장 후 `/auth/v1/settings`의 `external.google`이 true여야 한다.
오름 로그인 화면은 이 값을 서버에서 확인해 Google 버튼을 자동 활성화한다.

## 3. Supabase Redirect URLs

Authentication → URL Configuration.

Preview QA용 callback:
- `https://oreun-r1-preview.fluff-browser.workers.dev/auth/google/callback`

임시 Workers Preview가 계속 바뀌는 동안에는 Supabase가 허용하는 wildcard를 Preview에만 사용할 수 있다:
- `https://oreun-r1-preview.*.workers.dev/auth/google/callback`

운영 공개 시에는 wildcard 대신 최종 HTTPS 도메인의 정확한 callback을 사용한다:
- `https://<FINAL_DOMAIN>/auth/google/callback`

Site URL도 운영 도메인 확정 후:
- `https://<FINAL_DOMAIN>`

## 4. 실제 계정 E2E

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

## 5. 출시 Gate

아래가 모두 완료되기 전에는 Google Auth를 RELEASE READY로 보지 않는다.

- Google OAuth consent/branding 설정
- Google Web Client 생성
- Supabase callback 등록
- Supabase Google provider enabled
- Preview 또는 운영 callback allowlist 등록
- 실제 Google 신규 계정 E2E
- 14세 gate 검증
- refresh/logout 검증
- 운영 도메인 확정 후 exact redirect URL 재검수

PR merge, Production promote, noindex 해제와는 별도 승인 항목이다.
