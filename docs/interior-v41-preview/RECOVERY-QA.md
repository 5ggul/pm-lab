# Interior v41 pending transfer recovery QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## 확인한 문제

writer concurrency를 막은 뒤 fresh pending transfer가 있으면 두 번째 전송은 의도적으로 차단됩니다. 그런데 첫 전송의 localStorage 저장은 성공했지만 quote-check → quote-compare 페이지 이동이 중단되거나 브라우저가 닫히면 사용자는 최대 30분 동안 새 전송이 막힐 수 있었습니다.

또한 source/handoff 두 key를 순차 삭제하는 cleanup에는 아주 짧은 source-only 또는 handoff-only 구간이 생길 수 있습니다. 새 writer가 이 구간을 완전한 빈 상태로 오해하면 cleanup과 새 write가 교차할 수 있으므로 fresh partial 상태도 writer 점유 상태로 취급해야 합니다.

## 조치

`assets/quote-check-handoff-v41.js`

1. `currentPendingState()`
   - fresh complete pair → `kind: pair`
   - fresh source-only / handoff-only → `kind: partial`
2. 새 writer는 pair와 partial 모두 존재하면 시작하지 않음
3. `withTransferLock()`을 writer와 pending cancel에 공용 사용
4. `cancelPendingTransfer(expected)`는 lock 안에서 현재 snapshot을 다시 확인
5. 기대 snapshot이 바뀌면 newer transfer를 삭제하지 않고 오류
6. quote-check에 pending recovery panel 자동 주입
7. complete pair이면
   - `대기 중 비교표 열기`
   - `대기 전송 취소`
8. partial이면
   - 비교표 열기 숨김
   - `불완전 전송 정리`만 제공
9. 전송 write 성공 직후 `interior-handoff-pending` 이벤트를 발생시켜 navigation이 실패해 현재 페이지가 남아도 recovery panel이 즉시 보이도록 함

`assets/quote-compare-production-adapter-v41.js`

- writer와 같은 lock name `interior-v41-handoff-write-v41` 사용
- Apply/Cancel의 source/handoff cleanup도 exclusive lock 안에서 수행
- cleanup 도중 새 writer가 들어오는 교차 race 차단
- cleanup 대상이 newer transfer로 바뀌면 새 pair는 삭제하지 않음
- cleanup 자체가 실패하면 성공처럼 preview를 숨기지 않고 재시도 상태를 유지

기본 v41 compare 하네스는 별도 cleanup lock을 쓰지 않지만, writer가 fresh source-only / handoff-only 상태도 차단하고 기본 compare cleanup이 ownership snapshot을 확인하므로 cleanup 중간에 새 writer가 시작되는 실질 race는 차단됩니다.

## VM recovery / cleanup-window 회귀

pending-state / cleanup-window simulation 결과: **11 / 11 PASS**

1. complete fresh pair가 새 writer 차단
2. fresh source-only가 새 writer 차단
3. fresh handoff-only가 새 writer 차단
4. partial state 탐지
5. partial cancel이 자기 artifact 정리
6. 30분 초과 stale state는 새 writer를 막지 않음
7. stale artifacts를 새 transfer가 정상 대체
8. stale cancel이 newer transfer를 거부
9. newer pair 보존
10. compare cleanup의 source-only 중간 상태에서 writer 차단
11. cleanup 완료 후 새 writer 정상 성공

writer↔compare exclusive lock interleaving simulation 결과: **9 / 9 PASS**

- old cleanup 후 new writer 정상 진입
- new source/handoff 보존
- writer가 먼저 lock을 잡은 경우 stale cleanup은 새 pair를 지우지 않음
- pending cancel expected snapshot이 바뀌면 newer transfer 보존
- fresh pending 상태에서 두 번째 writer 차단

## hosted pending recovery probe

`production-shell/pending-recovery-probe.html`: **9개 검사 준비**

1. complete pending recovery panel 표시
2. target 업체 표시
3. Web Locks 사용 가능
4. owned complete pending cancel 후 source/handoff 정리
5. source-only partial recovery UI 표시
6. partial recovery가 자기 artifact 정리
7. stale recovery cancel이 newer transfer를 거부
8. newer pending pair 보존
9. `interior-quote-v5`, `interior-compare-v5`, `interior-compare-v6` 불변

probe 종료 시 source/handoff와 production-named key의 원래 값을 복원합니다.

외부 HTTPS preview가 아직 없으므로 `9/9 PASS`라고 기록하지 않습니다.

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
