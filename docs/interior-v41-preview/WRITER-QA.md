# Interior v41 writer concurrency QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## writer hardening

- Web Locks exclusive lock `interior-v41-handoff-write-v41`
- fresh complete pair + source-only/handoff-only partial 모두 점유
- second writer 차단
- write 후 persisted source/handoff exact snapshot 재검증
- failure cleanup은 자기 snapshot만 삭제
- production-shell Web Locks 미지원 fail-closed
- async confirm 중복 클릭 차단

## 비호스팅 회귀

- writer VM 8/8 PASS
- cleanup-window / partial 11/11 PASS
- writer↔production compare lock interleaving 9/9 PASS
- basic compare sequential cleanup parity 6/6 PASS
- stale ownership/cleanup 8/8 PASS
- malformed exact state machine 6/6 PASS

production-shell compare는 Apply/Cancel cleanup도 same lock에 참여합니다. 기본 compare는 duplicate cleanup lock 없이 공통 writer의 partial blocker + ownership rule로 동일 안전 조건을 만족합니다.

## storage isolation 관계

production-shell app-v21 초기화 전에 `production-storage-read-mask-v41.js`가 production-named 3키 read를 숨기고 protected set/remove를 document lifetime 동안 차단합니다. writer/recovery review-only read/write는 그대로 통과하며 DOMContentLoaded에서는 reader만 복원합니다. VM 12/12 PASS.

## hosted writer concurrency probe

`production-shell/writer-concurrency-probe.html`: **7개**

- same-origin two-context API
- exactly-one writer
- loser 차단
- persisted pair 승자 일치
- production-named storage 불변

## hosted 전체 자동검사

- self-check 58
- failure 8
- writer concurrency 7
- pending recovery 9
- stale/invalid transfer 9
- robustness 18

총 **109개**. 2026-09-18 외부 비운영 HTTPS 브라우저 QA에서 **109/109 PASS**를 확인했습니다.

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
