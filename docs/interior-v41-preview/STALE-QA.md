# Interior v41 stale / invalid transfer cleanup QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## 확인한 결함 1 — stale exact ownership

기존 production-shell compare adapter의 `ownsTransfer()`는 fresh matched quote일 때만 ownership을 true로 판단했습니다.

문제:

- transferId / createdAt / quote snapshot이 정확히 자기 transfer와 같아도 30분이 지나면 cleanup되지 않을 수 있음
- page load 시 stale exact source/handoff가 남을 수 있음
- 오래 연 preview Apply는 거부돼도 stale key가 남을 수 있음

조치:

- freshness와 ownership 분리
- `sameSourceSnapshot()` / `sameHandoffSnapshot()` exact ownership
- `ownsTransfer()`는 freshness에 의존하지 않음
- `exactPair()` / `isStaleExactPair()`
- 30분 초과 exact pair는 same Web Lock 안에서 cleanup
- newer/mismatched pair 보존

비호스팅 stale ownership 회귀: **8 / 8 PASS**

## 확인한 결함 2 — fresh malformed exact pair 잔존

production-shell compare는 source/handoff envelope가 exact pair여도 quote가 손상되었거나 target/timestamp가 적용 규칙을 통과하지 못하면 `readTransfer().quote`가 `null`이 됩니다.

기존 동작은:

- preview 없음
- stale도 아니면 cleanup 없음
- exact source/handoff가 storage에 남음
- quote-check recovery에서 다시 compare를 열어도 같은 no-op 상태 반복 가능

기본 `quote-compare/`는 malformed pair를 정리하므로 production-shell과 parity 차이도 있었습니다.

조치:

adapter init 순서:

1. fresh valid matched quote → preview
2. stale exact pair → stale cleanup
3. 그 외 exact pair인데 적용 불가 → `적용할 수 없는 handoff` cleanup
4. source/handoff가 exact pair조차 아니면 newer/mismatch 가능성이 있으므로 건드리지 않음

cleanup은 기존 `clearOwnedTransferExclusive()`를 사용하므로 lock 획득 뒤 persisted exact snapshot ownership을 다시 확인합니다.

## malformed exact 상태 머신 회귀

결과: **6 / 6 PASS**

1. 정상 fresh exact pair → 유지 / preview 대상
2. stale exact pair → cleanup branch
3. fresh exact + 손상 quote → invalid cleanup branch
4. exact + 잘못된 target → invalid cleanup branch
5. exact + future timestamp → invalid cleanup branch
6. source/handoff transferId mismatch → exact가 아니므로 보존

## hosted stale/invalid transfer probe

`production-shell/stale-transfer-probe.html`: **9개 검사 준비**

1. adapter API 로드
2. 31분 지난 stale exact pair source+handoff 정리
3. stale cleanup 상태 문구
4. fresh malformed exact quote pair 정리
5. invalid cleanup 상태 문구
6. 정상 fresh preview 노출
7. 정상 fresh pair action 전 보존
8. B target + `readTransfer().quote` 유효
9. production-named storage 3개 불변

probe 종료 시 review transfer와 production-named key 원래 값을 복원합니다.

## hosted 전체 자동검사

- self-check: 55
- failure-probe: 8
- writer-concurrency-probe: 7
- pending-recovery-probe: 9
- stale-transfer-probe: 9
- robustness-probe: 16

총 **104개**입니다. 외부 HTTPS preview가 아직 없으므로 hosted PASS로 기록하지 않습니다.

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
