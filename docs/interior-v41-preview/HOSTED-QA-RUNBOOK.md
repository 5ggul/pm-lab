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

main이 이동했으면 아래 4개 경로를 현재 main과 다시 비교합니다.

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

**baseline은 sessionStorage이므로 storage-inspector 탭을 닫지 말고 유지합니다. 마지막 기준점 재비교도 반드시 이 same tab에서 실행합니다.**

검수 중에는 이 세 key를 쓰거나 삭제하지 않습니다.

## 2. 자동검사 106개

`SNAPSHOT-MANIFEST.json`의 `hosted_checks`를 검사 개수 source-of-truth로 사용합니다.

### 2-1. self-check — 55 / 55

`production-shell/self-check.html`

필수 조건: **55 / 55 PASS**

범위:

- snapshot blob SHA / manifest hosted-check inventory
- production storage read-mask marker 및 `mask → app-v21 → guard → handoff/adapter` 순서
- wrapper asset rewrite / unresolved functional production resource 검사
- production path + absolute URL navigation guard
- Web Locks writer rule
- pending pair / partial recovery
- stale + malformed exact pair cleanup marker
- numeric amount guard
- autosave storage-before-memory

실제 검사 행 수가 manifest `self_check`와 다르면 summary 자체가 FAIL이어야 합니다.

### 2-2. failure probe — 8 / 8

`production-shell/failure-probe.html`

- search 이탈 차단
- production path 링크 + absolute production URL 이탈 차단
- guard가 실패해도 probe safety-net 때문에 실제 페이지 이동은 발생하지 않음
- review storage write failure
- 저장 실패 시 DOM 미변경 / source-handoff 유지
- production-named storage 불변

### 2-3. writer concurrency — 7 / 7

`production-shell/writer-concurrency-probe.html`

- same-origin two-context Web Lock 공유
- 정확히 한 writer 성공 / 두 번째 writer 차단
- persisted pair 승자 일치
- production-named storage 불변

### 2-4. pending recovery — 9 / 9

`production-shell/pending-recovery-probe.html`

- complete pending recovery UI
- partial source-only cleanup
- stale recovery cancel 차단
- newer transfer 보존
- production-named storage 불변

### 2-5. stale / invalid transfer — 9 / 9

`production-shell/stale-transfer-probe.html`

- 30분 초과 exact pair cleanup
- stale cleanup 상태
- fresh malformed exact quote pair cleanup
- invalid cleanup 상태
- 정상 fresh pair preview / 보존 / B target / valid quote
- production-named storage 불변

### 2-6. robustness — 18 / 18

`production-shell/robustness-probe.html`

- srcdoc browser realm에서 production storage read-mask active 동작
- DOMContentLoaded 이후 underlying `getItem` restore
- negative / Infinity / unsafe integer 거부
- 업체 합계 overflow 거부
- DOM `∞` / `NaN` 미노출
- iframe realm storage write failure 재현
- autosave 실패 후 memory unchanged
- iframe `Storage.prototype.setItem` 원복
- quote-check 금액 guard
- production-named storage 불변

자동검사 총계: **106 / 106 PASS**

## 3. 실제 quote-check → quote-compare navigation

`production-shell/quote-check/`

1. A 업체로 전송
2. 실제 URL이 `production-shell/quote-compare/`로 이동하는지 확인
3. URL query/hash에 견적 payload가 들어가지 않는지 확인
4. A 미리보기 자동 적용 금지
5. Apply 후 A 값 확인
6. source/handoff review key cleanup 확인

같은 과정을 B, C 순서로 반복합니다.

### A → B → C 보존 조건

- B 적용 뒤 A 유지
- C 적용 뒤 A/B 유지
- 3개 업체 각각 12공종 state+amount 유지
- rich metadata는 review-only vendor metadata에 유지
- 운영 이름 저장키는 변하지 않음

## 4. real-origin persistence

A/B/C 적용 상태에서:

1. 새로고침
2. 같은 URL 재방문
3. 탭 닫기 후 같은 브라우저 재접속

각 단계에서 review-only compare 상태가 복원되어야 합니다. 운영 compare key에 의존해 복원되면 FAIL입니다.

## 5. 실제 두 탭 storage event

### stale Apply

1. 탭 1에서 transfer preview
2. 탭 2에서 newer transfer 상황
3. 탭 1 오래된 Apply가 새 transfer를 덮어쓰지 않아야 함

### stale Cancel

1. 탭 1 오래된 preview
2. 탭 2 newer transfer
3. 탭 1 Cancel이 newer source/handoff 삭제 금지

### writer concurrency

가능하면 두 탭에서 거의 동시에 보내기를 실행해 exactly-one writer 규칙 재확인.

## 6. 모바일 실제 touch / scroll

최소 폭:

- 360px
- 375px
- 390px
- 430px

필수:

- page-level horizontal overflow 없음
- compare 내부 horizontal scroll 가능
- dialog viewport 내부
- 주요 action 44px 이상
- A/B/C / Apply / Cancel / recovery 터치 가능
- 확대 없이 상태 문구 식별 가능

## 7. storage baseline 재비교

**1단계에서 baseline을 기록한 동일한 storage-inspector 탭**으로 돌아옵니다.

`기준점과 비교` 실행.

다음 세 key의 exists / length / SHA-256가 시작 baseline과 완전히 동일해야 합니다.

- `interior-quote-v5`
- `interior-compare-v5`
- `interior-compare-v6`

하나라도 달라지면 hosted QA는 FAIL입니다.

## 8. 최종 판정 기록

모두 통과했을 때만 다음을 기록합니다.

- self-check 55/55 PASS
- failure probe 8/8 PASS
- writer concurrency 7/7 PASS
- pending recovery 9/9 PASS
- stale/invalid transfer 9/9 PASS
- robustness 18/18 PASS
- hosted automatic total 106/106 PASS
- A→B→C persistence PASS
- two-tab native storage event PASS
- mobile touch/scroll PASS
- production-named storage baseline unchanged PASS

## 9. hosted PASS 이후에도 자동으로 하지 않는 것

hosted 검수가 전부 PASS해도 별도 사용자 승인 없이는 하지 않습니다.

- PR #201 Ready for review 전환
- main merge
- 운영 도메인 배포
- production storage migration
- 기존 운영 quote-check / quote-compare 파일 교체

hosted PASS는 production 적용 승인과 별개입니다.
