# 창업데이터랩 SSG 생성기

`docs/franchise-data-preview/data-final.js`의 카탈로그를 읽어 검색 구조와 페이지 품질을 검수할 수 있는 정적 HTML을 `docs/franchise-ssg-preview/`에 생성합니다.

## 현재 프리뷰 규칙

- 모든 HTML은 `noindex,nofollow`입니다.
- 해시 라우팅을 사용하지 않습니다.
- 우선 브랜드 42개는 번호형 ID 대신 브랜드 기반 영구 slug를 사용합니다.
- `/compare/` 허브와 선별 비교 10개를 생성합니다.
- 가이드 15편에는 관련 브랜드 3개, 관련 도구 2개, 관련 가이드 2개와 주제별 공식 자료 링크를 붙입니다.
- 도구는 8개이며 `candidate-finder` 대신 `/tools/brand-filter/`와 `조건으로 프랜차이즈 브랜드 찾기` 명칭을 사용합니다.
- `/cost/`와 `/stores/` 프리뷰 템플릿은 10개 핵심 브랜드만 유지합니다.
- 정식 페이지에서 `/cost/`는 공식 출처·기준연도·3개년 이상 비용 이력·4개 이상 비용 구성이 있어야 독립 페이지 후보가 됩니다.
- 정식 페이지에서 `/stores/`는 공식 출처·기준연도·3개년 이상 점포 이력·신규/종료/해지 정보가 있어야 독립 페이지 후보가 됩니다.
- 생성 번호 slug 변경 내역은 `docs/franchise-ssg-preview/redirect-plan.json`에 남깁니다.
- 검색 본문·표·FAQ·출처·내부링크는 초기 HTML에 포함하고 계산기 입력만 브라우저에서 처리합니다.

## 정식 공개 게이트

현재 공식 브랜드 스냅샷이 promotion-ready가 아니므로 정식 모드는 차단되어 있습니다. 공식 데이터가 준비되더라도 SSG 생성기가 실제 공식 레코드를 화면 숫자에 병합하는 단계가 끝나기 전에는 production 생성을 허용하지 않습니다.

정식 공개 전에는 실제 운영주체/연락처, 공식 기준연도와 원문 링크, 데이터 누락·이상치 검증, canonical/robots/sitemap 정책을 다시 확인해야 합니다. `noindex` 제거는 마지막 단계입니다.

## 실행

```bash
npm run build
```

기본 스크립트는 `run-generate-v2.mjs` → `validate-v2.mjs` 순서로 실행합니다.
