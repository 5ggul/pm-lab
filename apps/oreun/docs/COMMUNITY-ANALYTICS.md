# R1 Sprint 05 — Roblox Community Analytics

Status: **Preview-only / feature flag OFF by default**

## 목적

Roblox Open Cloud Group Forum에서 공개적으로 접근 가능한 커뮤니티 활동의
**제한된 관측 집계**만 수집해 Game Hub의 후속 데이터 연구에 사용할 기반을 만든다.

현재 단계에서는 Forum 원문이나 사용자 단위 데이터를 제품 화면에 노출하지 않는다.

## 공식 API 경계

사용 API:
- `GET /cloud/v2/groups/{group_id}/forum-categories`
- `GET /cloud/v2/groups/{group_id}/forum-categories/{forum_category_id}/posts`
- `GET /cloud/v2/groups/{group_id}/forum-categories/{forum_category_id}/posts/{post_id}/comments`

필요 scope:
- `group-forum:read`

Open Cloud Group Forum API는 Beta이므로 Provider 경계 안에 격리한다.

## 저장하는 것

- Universe ID / Group ID
- 수집 시각
- 관측된 Category 수
- 관측된 Post 수
- 관측된 Comment 수
- 실제 스캔한 Category/Post 수
- 제한·페이지네이션으로 일부만 본 경우 `truncated=true`
- source class / scope / calculation version

## 저장하지 않는 것

- Forum Post 본문
- Comment 본문
- 제목 원문
- 작성자 이름
- Roblox 사용자 ID
- 쿠키·세션·토큰
- API Key

집계값은 상한이 있는 관측치다. `truncated=true`일 때 전체 총계처럼 표시하면 안 된다.

## Fail-closed 활성화 순서

1. 서버 환경에 `ROBLOX_OPEN_CLOUD_API_KEY`를 설정한다.
2. `R1_ROBLOX_COMMUNITY_ANALYTICS=1`을 설정한다.
3. 검증할 Game의 Universe ID와 Group ID를 확인한다.
4. R1은 Roblox Public Games 응답의 creator가 같은 Group ID인지 먼저 확인한다.
5. `npm run community:verify -- <universeId> <groupId>`로 소유 관계와 실제 `group-forum:read` 요청을 모두 통과시킨다.
6. 새 target은 기본 DISABLED다. 실제 수집을 승인할 때만 `--enable`로 검증하거나 별도 서버 운영 절차로 활성화한다.
7. `npm run community:run` 또는 보호된 내부 POST endpoint를 실행한다.

검증되지 않은 target은 DB constraint와 Runner 양쪽에서 수집할 수 없다.

## 환경변수

Server only:
- `ROBLOX_OPEN_CLOUD_API_KEY`
- `R1_COMMUNITY_ANALYTICS_TRIGGER_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

Feature / bounds:
- `R1_ROBLOX_COMMUNITY_ANALYTICS=0`
- `R1_COMMUNITY_MAX_CATEGORIES=5` (최대 20)
- `R1_COMMUNITY_MAX_POSTS=20` (최대 100)
- `R1_COMMUNITY_MAX_TARGETS=5` (한 실행 최대 25)
- `R1_COMMUNITY_MIN_INTERVAL_MINUTES=60` (최소 15분)

위 값에는 `NEXT_PUBLIC_` prefix를 사용하지 않는다.

## 공개 정책

- Preview noindex를 유지한다.
- Community Analytics 상태 화면은 Preview 내부 `/admin/community-analytics`에서만 확인한다.
- Production release mode에서는 다른 `/admin/*`와 같이 404 처리한다.
- 실제 데이터가 없으면 0 또는 임의 데이터로 채우지 않는다.
- 검색 색인이나 Game index_state 승격 조건에 이 실험 데이터를 자동 사용하지 않는다.
