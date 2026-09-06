# 창업데이터랩 Preview

외부 피드백을 위한 정적 프리뷰입니다. 현재 공개 수치는 실제 운영 데이터가 아니라 UI·계산 흐름 검수용 fixture입니다.

## 공개 경로

`https://5ggul.github.io/pm-lab/franchise-data-preview/`

## 검색엔진 정책

`index.html`에 아래 메타를 적용했습니다.

- `robots: noindex,nofollow,noarchive,nosnippet`
- `googlebot: noindex,nofollow,noarchive,nosnippet`
- `bingbot: noindex,nofollow,noarchive,nosnippet`

외부 피드백이 끝나고 정식 도메인/공식 데이터가 준비되기 전에는 제거하지 않습니다.

## 구현된 기능

- 브랜드 검색 / 별칭 검색
- 브랜드 상세 데이터 화면
- 동종업계 중앙값·증감·비율 파생지표
- 브랜드 1:1 비교
- 업종 랭킹
- 지역 상권 밀도 화면
- 창업비용 계산기
- 손익분기 시뮬레이터
- 계산·검수 기준(Methodology)
- 데이터 출처
- About / Privacy / Terms / Contact
- 모바일 반응형 UI
- 외부 검수 포인트 모달 및 현재 화면 URL 복사

## 데이터 전환 원칙

정식 서비스에서는 브라우저가 공공 API를 직접 호출하지 않습니다. 이용허락이 확인된 API를 서버측 Data Source Adapter → 검증 → Snapshot DB → Derived Metrics 순으로 적재한 뒤 화면에는 DB 값을 제공합니다.

누락값은 0으로 치환하지 않고 `MISSING` 상태로 관리하며, 이상치는 검증 후 반영합니다.
