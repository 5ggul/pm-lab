# 창업데이터랩 SSG 생성기

`docs/franchise-data-preview/data-final.js`의 프리뷰 카탈로그를 읽어 검색 구조를 검수할 수 있는 정적 HTML을 `docs/franchise-ssg-preview/`에 생성합니다.

- 프리뷰 기본값은 모든 HTML `noindex,nofollow`.
- 해시 라우팅을 사용하지 않습니다.
- 브랜드 42개, 브랜드 비용/점포 분리 페이지 20개, 가이드 15편, 도구 8개를 우선 생성합니다.
- 정식 모드(`SSG_PREVIEW_MODE=false`)는 공식 스냅샷이 promotion-ready가 아니면 생성 자체를 중단합니다.
- 운영자 실명/사업자 정보와 실제 연락처는 정식 공개 전 별도 품질 게이트로 채워야 합니다.
- 계산기와 필터만 브라우저에서 동작하고, 검색 본문·표·FAQ·출처는 초기 HTML에 포함됩니다.
