# Interior v41 writer concurrency QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## 확인한 결함

기존 quote-check writer는 cleanup과 source/handoff write가 탭 간에 교차할 수 있었습니다.

가능했던 문제:

- 한 탭 cleanup이 다른 탭의 새 transfer 삭제
- source는 한 탭, handoff는 다른 탭 값이 되는 교차 pair
- 두 번째 탭이 첫 번째 fresh pair 덮어쓰기
- 부분 저장 실패 cleanup이 현재 자기 소유가 아닌 key 삭제

## 조치

`assets/quote-check-handoff-v41.js`

1. `navigator.locks.request()` Web Locks 사용
2. lock name: `interior-v41-handoff-write-v41`
3. writer는 exclusive lock 안에서만 transfer write
4. fresh complete pair + fresh source-only / handoff-only partial 모두 점유 상태
5. 점유 상태가 있으면 두 번째 전송 차단
6. source/handoff write 후 persisted snapshot exact 검증
7. 실패 cleanup은 자기 snapshot과 일치하는 key만 삭제
8. production-shell Web Locks 미지원은 fail-closed
9. 일반 비 production harness만 Web Locks 미지원 시 동기 fallback 허용
10. confirm 버튼 async 전송 중 disabled

## 비호스팅 writer/cleanup 회귀

- writer VM: **8 / 8 PASS**
- cleanup-window / partial-state: **11 / 11 PASS**
- writer↔production compare exclusive-lock interleaving: **9 / 9 PASS**
- 기본 `quote-compare/` cleanup parity state machine: **6 / 6 PASS**

기본 compare는 cleanup 자체에 duplicate Web Lock을 넣지 않습니다. cleanup 중 source-only 또는 handoff-only가 되는 순간 공통 writer가 이를 fresh partial로 보고 차단하며, cleanup 완료 뒤에만 새 writer가 성공합니다. 오래된 cleanup은 ownership 비교 때문에 newer pair를 지우지 않습니다.

production-shell compare는 Apply/Cancel cleanup 자체도 writer와 같은 Web Lock에 참여합니다.

## hosted writer concurrency probe

`production-shell/writer-concurrency-probe.html`: **7개 검사 준비**

- two same-origin iframe handoff API 로드
- 정확히 한 writer 성공 / 한 writer 차단
- persisted source/handoff pair 일치
- persisted pair가 승자 writer 소유
- 운영 이름 저장키 3개 불변

## hosted self-check

`production-shell/self-check.html`: **55개 항목 준비**

writer/recovery 관련 marker:

- writer concurrency / pending recovery / stale / robustness manifest entrypoint
- Web Locks exclusive serialization / 고정 lock name
- complete+partial pending blocker
- ownership-aware cleanup
- production-shell Web Locks 미지원 fail-closed
- recovery panel / recovery cancel
- stale exact cleanup / ownership-freshness 분리
- production compare cleanup shared lock
- amount guard / autosave state-order marker

## hosted 전체 자동검사

- self-check 55
- failure 8
- writer concurrency 7
- pending recovery 9
- stale transfer 9
- robustness 16

총 **104개**입니다. 외부 HTTPS preview가 없으므로 hosted PASS로 기록하지 않습니다.

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
