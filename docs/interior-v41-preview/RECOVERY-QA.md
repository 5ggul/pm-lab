# Interior v41 pending transfer recovery QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## 확인한 문제

writer concurrency를 막은 뒤 fresh pending transfer가 있으면 두 번째 전송은 의도적으로 차단됩니다. 그런데 첫 전송의 localStorage 저장은 성공했지만 quote-check → quote-compare 페이지 이동이 중단되거나 브라우저가 닫히면 사용자는 새 전송을 시작하기 전에 기존 pending을 복구하거나 정리할 수 있어야 합니다.

또 compare cleanup은 source/handoff 두 key를 순차 삭제하므로 아주 짧게 source-only 또는 handoff-only 상태가 생길 수 있습니다. 이 순간 새 writer가 들어오지 않도록 complete pair뿐 아니라 fresh partial 상태도 writer 점유 상태로 취급합니다.

## 조치

`assets/quote-check-handoff-v41.js`

1. `currentPendingState()`
   - fresh complete pair → `kind: pair`
   - fresh source-only / handoff-only → `kind: partial`
2. 새 writer는 pair/partial 모두 존재하면 시작하지 않음
3. `withTransferLock()`을 writer와 pending cancel이 공용 사용
4. `cancelPendingTransfer(expected)`는 lock 안에서 snapshot 재확인
5. expected snapshot이 바뀌면 newer transfer 삭제 금지
6. quote-check pending recovery panel 자동 주입
7. pair: `대기 중 비교표 열기` / `대기 전송 취소`
8. partial: 비교표 열기 숨김 / `불완전 전송 정리`
9. write 성공 직후 `interior-handoff-pending` 이벤트로 현재 페이지에 recovery panel 즉시 반영

`assets/quote-compare-production-adapter-v41.js`

- writer와 동일 lock `interior-v41-handoff-write-v41`
- Apply/Cancel source/handoff cleanup도 exclusive lock 안에서 수행
- cleanup 도중 새 writer 교차 진입 차단
- newer transfer로 바뀐 경우 새 pair 삭제 금지

기본 `quote-compare/`는 별도 cleanup lock을 중복 추가하지 않습니다. 공통 writer가 fresh source-only/handoff-only partial도 점유 상태로 차단하므로 cleanup 중간에 새 write가 시작되지 않습니다.

## 비호스팅 회귀

pending/partial cleanup-window: **11 / 11 PASS**

writer↔production compare lock interleaving: **9 / 9 PASS**

기본 compare cleanup parity state machine: **6 / 6 PASS**

- cleanup 전 writer는 complete pair 때문에 차단
- handoff-first cleanup 중 writer는 source-only partial 때문에 차단
- source-first cleanup 중 writer는 handoff-only partial 때문에 차단
- cleanup 완료 후 새 writer 정상 성공
- 오래된 cleanup은 ownership 비교 때문에 newer pair 보존

## hosted pending recovery probe

`production-shell/pending-recovery-probe.html`: **9개 검사 준비**

1. complete pending recovery panel 표시
2. target 업체 표시
3. Web Locks 사용 가능
4. owned complete pending cancel 후 source/handoff 정리
5. source-only partial recovery UI 표시
6. partial recovery가 자기 artifact 정리
7. stale recovery cancel이 newer transfer 거부
8. newer pending pair 보존
9. production-named storage 3개 불변

probe 종료 시 review transfer와 production-named key 원래 값을 복원합니다.

## 현재 hosted 검수 준비 수

- self-check: 44
- failure-probe: 8
- writer-concurrency-probe: 7
- pending-recovery-probe: 9

총 **68개** hosted 자동 검사 항목이 준비되어 있습니다. 실제 PASS 수치는 외부 비운영 HTTPS preview에서만 기록합니다.

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
