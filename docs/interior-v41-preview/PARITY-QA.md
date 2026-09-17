# Interior v41 basic-harness parity QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## 목적

production-shell은 compare Apply/Cancel cleanup을 `interior-v41-handoff-write-v41` Web Lock 안에서 수행합니다. 기본 v41 `quote-compare/`는 기존 ownership-aware 순차 cleanup을 유지하므로 두 경로의 안전성이 달라지는지 별도로 확인했습니다.

## 공통 안전 조건

quote-check writer는 새 전송 전에 `currentPendingState()`를 확인합니다.

- fresh complete source+handoff pair → `pair`
- fresh source-only 또는 handoff-only → `partial`
- `pair` 또는 `partial`이면 새 writer 시작 금지
- stale/expired artifact는 writer를 영구 차단하지 않음
- 삭제는 expected snapshot과 일치하는 key만 수행

따라서 기본 compare가 두 key를 순차 삭제하는 아주 짧은 구간도 writer 관점에서는 `partial` 점유 상태입니다.

## 상태 머신 강제 재현

결과: **6 / 6 PASS**

1. cleanup 전 새 writer → complete pair 감지, 차단
2. handoff 먼저 삭제된 cleanup 중간 → source-only partial 감지, writer 차단
3. handoff→source cleanup 완료 뒤 → 새 writer 정상 성공
4. source 먼저 삭제된 cleanup 중간 → handoff-only partial 감지, writer 차단
5. source→handoff cleanup 완료 뒤 → 새 writer 정상 성공
6. 오래된 cleanup이 실행될 때 이미 newer pair가 있으면 ownership 비교로 newer source/handoff 보존

## 판정

기본 `quote-compare/`에 production-shell과 동일한 cleanup lock 코드를 중복 추가하지 않습니다.

- production-shell: compare cleanup 자체도 writer lock에 참여
- 기본 harness: writer가 fresh partial까지 점유로 간주해 cleanup 중간 진입 차단
- 두 경로 모두 newer transfer 삭제 방지와 cleanup-window write 방지 조건 만족

즉 구현 방식은 다르지만 동시성 안전 조건은 동일합니다. 기본 하네스 HTML을 불필요하게 재작성하지 않고 공통 writer를 단일 안전 규칙으로 유지합니다.

## 관련 회귀

- writer VM: 8 / 8 PASS
- pending/partial cleanup-window VM: 11 / 11 PASS
- writer↔production compare lock interleaving: 9 / 9 PASS
- basic compare cleanup parity state machine: 6 / 6 PASS

Hosted 자동검사 준비 합계: **68개**

- self-check 44
- failure 8
- writer concurrency 7
- pending recovery 9

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
