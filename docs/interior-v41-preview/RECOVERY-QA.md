# Interior v41 pending transfer recovery QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## recovery rules

quote-check writer는 fresh complete pair뿐 아니라 fresh source-only/handoff-only partial도 점유 상태로 봅니다.

- pair → 비교표 다시 열기 / 대기 전송 취소
- partial → 불완전 전송 정리만 제공
- recovery cancel은 same Web Lock 안에서 expected snapshot 재검증
- stale recovery action은 newer transfer 삭제 금지
- write 성공 직후 `interior-handoff-pending` 이벤트로 navigation 실패 시 현재 페이지에도 recovery UI 즉시 반영

production compare:

- Apply/Cancel cleanup same writer lock
- stale exact pair는 ownership/freshness 분리해 cleanup
- fresh exact지만 적용 불가능한 malformed quote/invalid target/future timestamp pair도 owned exact snapshot일 때 cleanup
- source/handoff mismatch/newer 상태는 보존

기본 compare는 duplicate cleanup lock 없이 common writer partial blocker + ownership rule 사용.

## 비호스팅 회귀

- pending/partial cleanup-window 11/11 PASS
- writer↔production compare lock interleaving 9/9 PASS
- basic compare parity 6/6 PASS
- stale ownership 8/8 PASS
- malformed exact state machine 6/6 PASS

## hosted pending recovery probe

`pending-recovery-probe.html`: **9개**

- complete pending UI / target
- Web Locks
- owned cancel cleanup
- source-only partial recovery
- stale recovery cancel 차단
- newer pair 보존
- production-named storage 불변

## hosted 전체 자동검사

- self-check 58
- failure 8
- writer concurrency 7
- pending recovery 9
- stale/invalid transfer 9
- robustness 18

총 **109개**. 외부 비운영 HTTPS preview에서만 PASS를 기록합니다.

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
