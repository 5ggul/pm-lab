# Interior v41 hosted QA runbook

검수 브랜치: `interior-v40-preview` / Draft PR #201

이 문서는 외부 **비운영 HTTPS preview가 명시적으로 승인된 뒤** 실행할 순서를 고정합니다. 이 runbook 자체는 배포 승인이 아니며, main merge/운영 배포를 허용하지 않습니다.

## 0. 시작 전 중단 조건

다음 중 하나라도 해당하면 hosted 판정을 시작하지 않습니다.

- preview가 production/main 배포인 경우
- preview와 PR HEAD가 일치하는지 확인할 수 없는 경우
- main이 `verified_unchanged_through_commit` 이후 이동했는데 pinned 4개 interior blob 재대조를 하지 않은 경우
- production-named storage baseline을 기록할 수 없는 경우
- 검수 브라우저에서 same-origin localStorage 또는 Web Locks를 사용할 수 없는 경우

main이 이동했으면 먼저 아래 4개 경로를 현재 main과 다시 비교합니다.

- `docs/interior-cost-preview/quote-check/index.html`
- `docs/interior-cost-preview/quote-compare/index.html`
- `docs/interior-cost-preview/assets/site-v21-bundle.css`
- `docs/interior-cost-preview/assets/app-v21-bundle.js`

4개 blob이 그대로면 snapshot을 다시 만들지 않고 `verified_unchanged_through_commit`만 최신 main SHA로 올립니다. 하나라도 바뀌면 기존 hosted PASS를 재사용하지 않고 snapshot 기준을 의도적으로 갱신합니다.

## 1. storage baseline

`production-shell/storage-inspector.html`

1. `interior-quote-v5`
2. `interior-compare-v5`
3. `interior-compare-v6`

세 운영 이름 key의 exists / length / SHA-256을 확인합니다.

`운영 키 기준점 기록`을 눌러 sessionStorage에 baseline을 저장합니다.

검수 중에는 이 세 key를 쓰거나 삭제하지 않습니다.

## 2. 자동검사 104개

아래 순서로 실행합니다.

### 2-1. self-check — 55 / 55

`production-shell/self-check.html`

필수 조건: **55 / 55 PASS**

범위:

- snapshot blob SHA
- wrapper asset rewrite
- guard / handoff / adapter injection
- script load order
- production functional asset 잔존 여부
- Web Locks writer rule
- pending pair / partial recovery
- stale exact ownership cleanup
- numeric amount guard
- autosave storage-before-memory
- production-prefix navigation guard

1개라도 FAIL이면 이후 실제 handoff 검수를 진행하지 않습니다.

### 2-2. failure probe — 8 / 8

`production-shell/failure-probe.html`

필수 조건: **8 / 8 PASS**

- search / non-workflow link 이탈 차단
- review storage write failure
- 저장 실패 시 DOM 미변경
- source/handoff 유지
- production-named storage 불변

### 2-3. writer concurrency — 7 / 7

`production-shell/writer-concurrency-probe.html`

필수 조건: **7 / 7 PASS**

- same-origin two-context Web Lock 공유
- 정확히 한 writer 성공
- 두 번째 writer 차단
- persisted pair 승자 일치
- production-named storage 불변

### 2-4. pending recovery — 9 / 9

`production-shell/pending-recovery-probe.html`

필수 조건: **9 / 9 PASS**

- complete pending recovery UI
- partial source-only cleanup
- stale recovery cancel 차단
- newer transfer 보존
- production-named storage 불변

### 2-5. stale transfer — 9 / 9

`production-shell/stale-transfer-probe.html`

필수 조건: **9 / 9 PASS**

- 30분 초과 exact pair 정리
- stale pair 적용 금지
- fresh/newer transfer 보존
- ownership과 freshness 분리
- production-named storage 불변

### 2-6. robustness — 16 / 16

`production-shell/robustness-probe.html`

필수 조건: **16 / 16 PASS**

- negative / Infinity / unsafe integer 거부
- 업체 합계 overflow 거부
- DOM `∞` / `NaN` 미노출
- iframe realm storage write failure 재현
- autosave 실패 후 memory unchanged
- iframe `Storage.prototype` 원복
- quote-check 금액 guard
- production-named storage 불변

자동검사 총계: **104 / 104 PASS**

## 3. 실제 quote-check → quote-compare navigation

`production-shell/quote-check/`

1. A 업체로 전송
2. 실제 URL이 `production-shell/quote-compare/`로 이동하는지 확인
3. URL query/hash에 견적 payload가 들어가지 않는지 확인
4. A 미리보기는 자동 적용되지 않아야 함
5. Apply 후 A 값이 보이는지 확인
6. source/handoff review key가 cleanup되는지 확인

같은 과정을 B, C 순서로 반복합니다.

### A → B → C 보존 조건

- B 적용 뒤 A가 유지
- C 적용 뒤 A/B가 유지
- 3개 업체 각각 12공종 state+amount 유지
- rich metadata는 review-only vendor metadata에 유지
- 운영 이름 저장키는 변하지 않음

## 4. real-origin persistence

A/B/C 적용 상태에서 다음을 확인합니다.

1. 새로고침
2. 같은 URL 재방문
3. 탭 닫기 후 같은 브라우저에서 재접속

각 단계에서 review-only compare 상태가 복원되어야 합니다.

운영 compare key에 의존해 복원되면 FAIL입니다.

## 5. 실제 두 탭 storage event

같은 origin에서 quote-check / quote-compare를 두 탭으로 엽니다.

### stale Apply

1. 탭 1에서 transfer 미리보기 생성
2. 탭 2에서 상태를 변경하거나 새 transfer 상황 생성
3. 탭 1의 오래된 Apply가 새 transfer를 덮어쓰지 않아야 함

### stale Cancel

1. 탭 1에 오래된 preview 유지
2. 탭 2의 newer transfer 존재
3. 탭 1 Cancel이 newer source/handoff를 삭제하지 않아야 함

### writer concurrency

가능하면 두 탭에서 거의 동시에 보내기를 실행해 exactly-one writer 규칙을 재확인합니다.

## 6. 모바일 실제 touch / scroll

최소 확인 폭:

- 360px
- 375px
- 390px
- 430px

필수:

- 페이지 전체 horizontal overflow 없음
- 비교표 내부 horizontal scroll 가능
- dialog viewport 밖 이탈 없음
- 주요 action target 44px 이상
- A/B/C 선택 터치 가능
- Apply / Cancel / recovery controls 터치 가능
- 화면 확대 없이 주요 상태 문구 식별 가능

## 7. storage baseline 재비교

다시 `production-shell/storage-inspector.html`로 돌아옵니다.

`기준점과 비교` 실행.

다음 세 운영 이름 key의 exists / length / SHA-256가 시작 baseline과 **완전히 동일**해야 합니다.

- `interior-quote-v5`
- `interior-compare-v5`
- `interior-compare-v6`

하나라도 달라지면 hosted QA는 FAIL입니다.

## 8. 최종 판정 기록

모두 통과했을 때만 다음 문구를 기록할 수 있습니다.

- self-check 55/55 PASS
- failure probe 8/8 PASS
- writer concurrency 7/7 PASS
- pending recovery 9/9 PASS
- stale transfer 9/9 PASS
- robustness 16/16 PASS
- hosted automatic total 104/104 PASS
- A→B→C persistence PASS
- two-tab native storage event PASS
- mobile touch/scroll PASS
- production-named storage baseline unchanged PASS

## 9. hosted PASS 이후에도 자동으로 하지 않는 것

hosted 검수가 전부 PASS해도 다음은 별도 사용자 승인 없이는 하지 않습니다.

- PR #201 Ready for review 전환
- main merge
- 운영 도메인 배포
- production storage migration
- 기존 운영 quote-check / quote-compare 파일 교체

hosted PASS는 production 적용 승인과 별개입니다.
