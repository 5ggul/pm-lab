# Interior v41 stale / invalid transfer cleanup QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## stale exact ownership

기존 adapter는 freshness와 ownership이 묶여 30분 지난 exact 자기 transfer를 cleanup하지 못할 수 있었습니다.

조치:

- freshness = 적용 가능 여부
- ownership = exact source/handoff snapshot
- stale exact pair same Web Lock cleanup
- newer/mismatched pair 보존

비호스팅: **8 / 8 PASS**

## fresh malformed exact pair

exact envelope라도 quote가 손상되거나 target/timestamp가 적용 규칙을 통과하지 못하면 `readTransfer().quote`가 null이 됩니다.

adapter init:

1. fresh valid matched quote → preview
2. stale exact → stale cleanup
3. fresh exact but unusable → invalid cleanup
4. source/handoff mismatch → newer/interleaving 가능성이 있어 보존

비호스팅 malformed exact state machine: **6 / 6 PASS**

## same-ID exact snapshot race

production adapter는 Apply 직전과 `storage` event에서 `sameTransferSnapshot()`으로 source quote + handoff target/version/id/time 전체 snapshot을 재검증합니다.

상태 simulation: **8 / 8 PASS**.

hosted stale probe는 같은 transferId/createdAt을 유지한 채 source quote만 변경하는 경우와 target만 변경하는 경우를 실제 iframe storage event로 재현해 기존 preview 무효화와 newer snapshot 보존을 확인합니다.

## cleanup ownership-loss reconciliation

stale/invalid auto-cleanup이 Web Lock을 기다리는 사이 다른 탭이 pair를 바꾸면 cleanup ownership이 false가 될 수 있습니다. 이때 거짓 `정리 완료`를 표시하지 않고 current transfer를 다시 읽습니다.

- current valid → 새 preview 재표시
- invalid/partial → 현재 데이터 보존 안내
- already removed → 이미 정리됨 안내

hosted stale probe는 lock을 의도적으로 선점해 이 race를 재현합니다.

- valid fresh 유지
- stale exact cleanup
- malformed quote cleanup
- invalid target cleanup
- future timestamp cleanup
- mismatched pair 보존

## hosted stale/invalid probe

`stale-transfer-probe.html`: **9개**

1. adapter API
2. stale exact pair cleanup
3. stale status
4. fresh malformed exact cleanup
5. invalid status
6. normal fresh preview
7. normal fresh pair 보존
8. B target + valid quote
9. production-named storage 불변

## hosted 전체 자동검사

- self-check 58
- failure 8
- writer concurrency 7
- pending recovery 9
- stale/invalid transfer 9
- robustness 18

총 **109개**. 아직 external HTTPS에서 실행하지 않았습니다.

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
