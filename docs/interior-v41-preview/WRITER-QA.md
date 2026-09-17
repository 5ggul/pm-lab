# Interior v41 writer concurrency QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## 확인한 결함

기존 quote-check writer는 `clearTransfer()` → source write → handoff write 순서였습니다.

두 quote-check 탭이 거의 동시에 전송하면 다음 문제가 가능했습니다.

- 한 탭의 무조건 cleanup이 다른 탭의 새 transfer를 삭제
- source는 한 탭, handoff는 다른 탭 값이 되는 교차 pair
- 두 번째 탭이 첫 번째 fresh pair를 덮어씀
- 부분 저장 실패 cleanup이 현재 자기 소유가 아닌 key까지 지울 수 있음

compare 쪽의 transferId/createdAt 검증만으로는 writer가 먼저 pair를 파괴하는 문제를 막을 수 없었습니다.

## 조치

`assets/quote-check-handoff-v41.js`

1. `navigator.locks.request()` Web Locks 사용
2. lock name: `interior-v41-handoff-write-v41`
3. writer는 exclusive lock 안에서만 transfer write
4. fresh complete pair가 이미 있으면 두 번째 전송 차단
5. fresh source-only / handoff-only partial도 점유 상태로 취급해 cleanup 중간에 새 writer가 진입하지 못하게 함
6. 같은 탭/다른 탭 예외를 두지 않음
7. source/handoff write 후 persisted snapshot을 다시 읽어 exact pair 검증
8. 실패 cleanup은 자기 snapshot과 일치하는 key만 삭제
9. production-shell에서 Web Locks가 없으면 unsafe fallback 대신 fail-closed
10. 일반 비 production harness만 Web Locks 미지원 시 동기 fallback 허용
11. confirm 버튼은 async 전송 중 disabled 처리
12. navigation 실패 뒤 pending recovery UI를 제공하고 cancel도 같은 lock 안에서 수행

## VM writer 회귀

writer storage/lock simulation 결과: **8 / 8 PASS**

1. 첫 writer 정상 저장
2. fresh pair가 있는 동안 두 번째 writer 차단
3. 두 번째 writer 차단 후 첫 source/handoff 보존
4. handoff 부분 write 실패 시 자기 source만 cleanup, 기존 unrelated handoff 보존
5. 30분 초과 stale complete pair는 새 transfer로 교체 가능
6. malformed/mismatched pair는 새 transfer를 영구 차단하지 않음
7. production-shell + Web Locks 미지원은 fail-closed, storage 미변경
8. queued concurrent writer simulation에서 첫 writer만 성공하고 두 번째 writer는 pending error

partial / cleanup-window simulation 결과: **11 / 11 PASS**

- complete pair, source-only, handoff-only 모두 fresh 상태에서는 새 writer 차단
- partial 상태 감지 및 자기 artifact 정리
- stale artifact는 새 writer를 막지 않음
- stale cancel은 newer transfer를 삭제하지 않음
- cleanup 중간 source-only 상태에서 writer 차단
- cleanup 완료 뒤 새 writer 정상 성공

writer↔compare cleanup lock interleaving simulation: **9 / 9 PASS**

- old cleanup과 new writer가 동시에 경합해도 새 pair 보존
- writer가 먼저 lock을 잡으면 stale cleanup이 새 pair를 지우지 않음
- expected snapshot이 바뀐 recovery cancel은 newer transfer를 거부

## hosted writer concurrency probe

`production-shell/writer-concurrency-probe.html`

외부 HTTPS preview에서 two same-origin iframe을 사용해 실제 Web Locks/localStorage 공유 상태를 재현합니다.

검사: **7개 예정**

1. iframe A handoff API 로드
2. iframe B handoff API 로드
3. 정확히 한 writer만 성공
4. 정확히 한 writer는 차단
5. persisted source/handoff transferId 일치
6. persisted pair가 실제 성공한 writer 소유
7. `interior-quote-v5`, `interior-compare-v5`, `interior-compare-v6` 불변

probe 종료 시 review transfer source/handoff는 실행 전 값으로 원상복구합니다.

## hosted self-check

`production-shell/self-check.html`은 writer/recovery/cleanup lock marker까지 포함해 현재 **44개 항목**을 검사합니다.

writer 관련 확인:

- manifest writer concurrency / pending recovery entrypoint
- Web Locks exclusive serialization marker
- 고정 lock name
- pair/partial pending blocker
- ownership-aware cleanup
- production-shell Web Locks 미지원 fail-closed
- pair/partial state classifier
- pending recovery panel / cancel helper
- quote-compare shared lock / exclusive cleanup helper

외부 HTTPS preview가 없으므로 `44/44 PASS`, writer concurrency `7/7 PASS`라고 아직 기록하지 않습니다.

## UX 동작

fresh complete pending transfer가 있는 동안 사용자가 다시 보내기를 누르면 기존 pair를 덮어쓰지 않고 다음 의미의 오류를 보여 줍니다.

`이미 비교표 전송이 진행 중입니다. 기존 전송을 적용하거나 취소한 뒤 다시 시도해 주세요.`

fresh partial 상태에서는 새 전송을 막고 recovery panel에서 `불완전 전송 정리`를 제공합니다.

complete pending은 recovery panel에서 기존 비교표를 다시 열거나 안전하게 취소할 수 있습니다.

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
