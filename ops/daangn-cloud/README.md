# DealOps Daangn Cloud

당근 카페 자동화를 로컬 Windows 작업 스케줄러에서 GitHub Actions로 옮긴 버전입니다.

## 동작 방식

- GitHub Actions가 KST 08:30~22:30에 매시간 1회 실행합니다.
- 하루 최대 15건까지만 게시합니다.
- 하루 15건은 상한이며, 기본 타입 상한은 핫딜 6·꿀팁 4·행사 3·카드 2·생활이슈 2입니다.
- 좋은 후보가 부족하면 억지로 15개를 채우지 않습니다.
- 원본 URL, 제목 정규화, needs-review 기록으로 중복 게시를 막습니다.
- 제출 후 게시 URL을 확인하지 못한 글은 자동 재시도하지 않습니다.

## Community Native Content Engine v3

상세 요구사항은 `PRD-community-native-v3.md`를 기준으로 합니다.

구조:

```
collector → factual copyContext/claims
          → quality-engine
          → intent/style planner
          → platform renderer
          → candidate pool
          → recent-100 novelty QA
          → publisher boundary QA
```

핵심 구현:

- `collectors.mjs`: 게시문을 만들지 않고 가격·기간·조건·출처·confidence claim만 수집
- `quality-engine.mjs`: 타깃 적합도, trust, utility, 숫자 claim, AI 말투, 가짜 경험, 과장, lexical similarity 검사
- `platform-profiles.mjs`: 당근·네이버카페·뽐뿌·퀘이사존·generic 커뮤니티 규칙 분리
- `copy-engine.mjs`: style mode × 제목 전략 × 사실 블록 순서 × 링크 위치를 조합해 넓은 후보 풀 생성
- `cycle.mjs`: 최근 100개 발행 이력과 비교해 중복 구조를 제거하고 일일 mix·판매처·주제 다양성 제어
- `publisher.mjs`: 발행 직전 독립 QA 재실행
- `copy-engine.test.mjs`: AI 문장·가짜 경험·과장·미검증 숫자·타깃 불일치·플랫폼 렌더링·20개 연속 다양성 회귀검사

운영 원칙:

- 좋은 후보가 없으면 일일 목표를 채우지 않습니다.
- 후보가 전부 품질검사에서 탈락하면 fallback 문구를 발행하지 않고 `copy_rejected`로 남깁니다.
- 최근 100개 글을 날짜와 무관하게 비교합니다.
- 당근은 애교 어미 최대 1회이며 최근 3글에 이미 애교 글이 있으면 다시 사용하지 않습니다.
- 확인되지 않은 구매·사용·육아 경험은 생성하지 않습니다.
- `체감가`, 근거 없는 최저가, 과장형 홍보 문구를 자동 생성하지 않습니다.
- 해외통화 오인, 일부 무료 행사 오인, 타깃과 먼 게이밍/고가 취미 후보는 수집·품질 단계에서 차단합니다.
- 동일 skeleton·opening·closing·고유 어휘 조합은 최근 이력과 비교해 차단하거나 감점합니다.

## Daily Learning Loop

매일 KST 23:40에 `DealOps Daily Learning` 워크플로가 실행됩니다.

1. 최근 45일의 실제 당근 게시 URL을 방문해 조회수·댓글 수를 스냅샷으로 저장합니다.
2. 게시 후 6~72시간 구간의 성과를 사용합니다.
3. 가능하면 약 24시간 전 스냅샷과의 조회 증가량을 사용하고, 첫날에는 게시 후 시간당 조회수를 초기 신호로 사용합니다.
4. 같은 타입+시간대 표본이 3개 이상이면 그 코호트의 중앙값과 비교합니다. 부족하면 같은 타입, 그것도 부족하면 전체 중앙값을 기준으로 합니다.
5. 성과는 `performanceIndex`로 정규화한 뒤 styleMode, titleStrategy, linkPosition, topic, sourceStore, type×time 가중치만 조정합니다.
6. 하루 가중치 변화는 최대 ±5%, 전체 가중치 범위는 0.75~1.25로 제한합니다.
7. 첫 표본 1개는 증거만 저장하고 운영 가중치를 바꾸지 않습니다. 다음 날까지 누적 증거가 2개 이상 쌓이면 EMA 방식으로 천천히 반영합니다.
8. 동일 날짜의 재실행은 조회 스냅샷만 추가하고 가중치는 다시 조정하지 않습니다.
9. 조회수 측정 성공률이 90% 미만이면 가중치 변경을 중단하고 실패 리포트를 저장합니다.
10. 사실 검증·AI 금지어·가짜 경험·과장·중복·타깃 필터 등 품질 게이트는 학습 시스템이 변경할 수 없습니다.
11. 좋은 성과 전략 100% 고정이 아니라 표본이 적은 전략에는 제한된 탐색 보너스를 유지합니다.

상태 파일:

- `state/metrics-history.json`: 게시물별 조회수 시계열
- `state/learning-weights.json`: 다음 발행에 적용되는 제한형 가중치
- `state/learning-reports.json`: 일별 분석 결과·상하위 글·변경 내역

발행 워크플로와 학습 워크플로는 서로 다른 state 파일만 저장하므로 동시에 실행되더라도 상대 시스템의 상태 파일을 덮어쓰지 않습니다.

## 콘텐츠 품질 게이트

- 제목에 `｜` 사용 금지
- `확인됩니다`, `확인해주세요`, `쿠폰 적용 여부` 같은 반복 문구 금지
- 핫딜은 비교가격이 있어야 하며 최소 10% 이상 차이가 있어야 함
- 실제 상품 이미지가 있는 핫딜만 통과
- 꿀팁은 정책브리핑 기사 본문의 숫자/날짜가 있는 내용만 사용
- 오늘어디가지는 한국관광공사 행사 중 무료 또는 할인 근거가 있는 행사만 사용
- 제목은 금액, 할인폭, 무료, 마감 등 실제 근거를 앞쪽에 배치

## 최초 1회 설정

당근 로그인 세션을 GitHub Secret으로 한 번만 옮기면 이후에는 PC가 꺼져 있어도 동작합니다.

Windows에서:

```powershell
powershell -ExecutionPolicy Bypass -File ops/daangn-cloud/bootstrap-secret.ps1
```

Secret 이름은 `DAANGN_AUTH_STATE_B64` 입니다. 인증 값은 저장소 파일에 커밋하지 않습니다.

## 인증이 만료됐을 때

GitHub Actions 로그에 `AUTH_EXPIRED`가 나오면 PC에서 당근 로그인을 갱신한 뒤 `bootstrap-secret.ps1`을 다시 한 번 실행합니다.

## 수동 테스트

GitHub Actions > DealOps Daangn Cloud > Run workflow에서 `collect_only=true`로 실행하면 게시 없이 큐만 검증할 수 있습니다.
