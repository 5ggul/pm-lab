# Interior v41 stale transfer cleanup QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## 확인한 결함

production-shell compare adapter의 기존 `ownsTransfer()`는 persisted source/handoff가 fresh matched quote일 때만 ownership을 true로 판단했습니다.

문제:

- transferId / createdAt / quote snapshot이 정확히 자기 transfer와 같아도 30분이 지나면 freshness 때문에 cleanup되지 않을 수 있음
- page load 시 stale exact source/handoff가 남을 수 있음
- Apply 버튼을 오래 열어 둔 뒤 누르면 적용은 거부돼도 stale key가 남을 수 있음

## 조치

`assets/quote-compare-production-adapter-v41.js`

1. freshness와 ownership 분리
2. `sameSourceSnapshot()` / `sameHandoffSnapshot()`으로 exact snapshot ownership 판단
3. `ownsTransfer()`는 `getMatchedQuote()` freshness에 의존하지 않음
4. `exactPair()` / `isStaleExactPair()` 추가
5. stale exact pair도 자기 snapshot이면 same Web Lock 안에서 cleanup 가능
6. production-shell compare 진입 시 30분 초과 exact pair 자동 정리
7. fresh preview가 30분을 넘긴 뒤 Apply하면 적용은 거부하고 exact stale pair 정리
8. newer transfer / mismatched pair는 ownership 비교 때문에 삭제하지 않음

## 비호스팅 stale ownership 회귀

상태/스토리지 시뮬레이션 결과: **8 / 8 PASS**

1. stale exact pair 탐지
2. stale exact pair도 ownership 유지
3. stale exact pair cleanup 성공
4. old stale snapshot은 newer pair ownership을 얻지 못함
5. old stale cleanup이 newer pair 보존
6. mismatched stale pair는 exact pair가 아님
7. mismatched snapshot은 ownership false
8. fresh exact pair ownership 정상

## hosted stale transfer probe

`production-shell/stale-transfer-probe.html`: **9개 검사 준비**

1. production adapter API 로드
2. 31분 지난 stale source 자동 제거
3. 31분 지난 stale handoff 자동 제거
4. stale cleanup 완료 상태 문구
5. fresh transfer preview 노출
6. fresh source/handoff action 전 보존
7. fresh B target 표시
8. fresh `readTransfer().quote` 유효
9. `interior-quote-v5`, `interior-compare-v5`, `interior-compare-v6` 불변

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
