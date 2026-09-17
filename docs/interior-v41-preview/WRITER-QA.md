# Interior v41 writer concurrency QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## 확인한 결함

기존 quote-check writer는 `clearTransfer()` → source write → handoff write 순서였습니다.

두 quote-check 탭이 거의 동시에 전송하면 다음 문제가 가능했습니다.

- 한 탭의 무조건 cleanup이 다른 탭의 새 transfer를 삭제
- source는 한 탭, handoff는 다른 탭 값이 되는 교차 pair
- 두 번째 탭이 첫 번째 fresh pair를 덮어씀
- 부분 저장 실패 cleanup이 현재 자기 소유가 아닌 key까지 지울 수 있음

## 조치

`assets/quote-check-handoff-v41.js`

1. `navigator.locks.request()` Web Locks 사용
2. lock name: `interior-v41-handoff-write-v41`
3. writer는 exclusive lock 안에서만 transfer write
4. fresh complete pair뿐 아니라 fresh source-only / handoff-only partial도 점유 상태
5. 점유 상태가 있으면 두 번째 전송은 같은 탭/다른 탭 구분 없이 차단
6. source/handoff write 후 persisted snapshot exact 검증
7. 실패 cleanup은 자기 snapshot과 일치하는 key만 삭제
8. production-shell Web Locks 미지원은 fail-closed
9. 일반 비 production harness만 Web Locks 미지원 시 동기 fallback 허용
10. confirm 버튼 async 전송 중 disabled

## VM writer 회귀

결과: **8 / 8 PASS**

- 첫 writer 정상 저장
- fresh pending 중 두 번째 writer 차단
- 첫 source/handoff 보존
- 부분 write 실패 ownership cleanup
- stale/malformed state가 새 writer를 영구 차단하지 않음
- production-shell Web Locks 미지원 fail-closed
- queued concurrent writer에서 정확히 첫 writer만 성공

추가 cleanup-window / partial-state 회귀: **11 / 11 PASS**

writer↔production compare exclusive-lock interleaving: **9 / 9 PASS**

기본 `quote-compare/` cleanup parity state machine: **6 / 6 PASS**

기본 compare는 별도 cleanup lock을 추가하지 않아도 안전합니다. cleanup 중 source-only 또는 handoff-only가 되는 순간 공통 writer가 이를 fresh partial로 보고 차단하며, cleanup 완료 뒤에만 새 writer가 성공합니다. 오래된 cleanup은 ownership 비교 때문에 newer pair를 지우지 않습니다.

## hosted writer concurrency probe

`production-shell/writer-concurrency-probe.html`: **7개 검사 준비**

- two same-origin iframe handoff API 로드
- 정확히 한 writer 성공 / 한 writer 차단
- persisted source/handoff pair 일치
- persisted pair가 승자 writer 소유
- 운영 이름 저장키 3개 불변

## hosted self-check

`production-shell/self-check.html`: **44개 항목 준비**

writer/recovery 관련 marker:

- writer concurrency / pending recovery manifest entrypoint
- Web Locks exclusive serialization / 고정 lock name
- complete+partial pending blocker
- ownership-aware cleanup
- production-shell Web Locks 미지원 fail-closed
- recovery panel / recovery cancel
- production compare cleanup shared lock

외부 HTTPS preview가 없으므로 hosted PASS로 기록하지 않습니다.

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
