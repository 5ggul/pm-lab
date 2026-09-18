# Interior v41 production-shell QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

현재 main 동일성 확인 경계: `340fe0683ccf49d4d3ab8a1eb0bcbb0597542db4` (2026-09-18)

초기 production-shell 캡처 기준: `26b8f66b14316743e3bfaff73912a5b15901c48c`

`5dd0e9ed... → 340fe068...` 사이 main 7커밋은 franchise production contract JSON 하나만 변경했고 인테리어 quote-check/quote-compare HTML/CSS/JS blob은 그대로입니다.

## production storage read/write isolation

`assets/production-storage-read-mask-v41.js`

- app-v21보다 먼저 defer 실행
- `interior-quote-v5`, `interior-compare-v5`, `interior-compare-v6` read만 초기화 동안 null
- review-only key는 원래 reader 통과
- review-only write는 통과하지만 protected production 3키의 `setItem/removeItem`은 shell document lifetime 동안 차단
- DOMContentLoaded에서 원래 `Storage.prototype.getItem` 복원
- actual asset protected read/write / one-shot / DOMContentLoaded read-restore / persistent write-shield simulation: **12 / 12 PASS**

robustness hosted probe도 실제 production key를 쓰지 않는 `srcdoc` realm에서 mask active/restore를 검사합니다.

쓰기 방어:

- Storage API layer에서 protected production 3키 `setItem/removeItem` 차단
- document capture 단계에서 quote-check/compare save/reset 선차단
- page-specific save/reset guard는 UX/2차 방어로 유지
- production-named key는 probe/adapter에서 쓰거나 삭제하지 않음

script order:

- quote-check: `production-storage-read-mask-v41 → app-v21 → production-shell-guard-v41 → quote-check-handoff-v41`
- quote-compare: `production-storage-read-mask-v41 → app-v21 → production-shell-guard-v41 → quote-compare-production-adapter-v41`

## production-shell adapter

- handoff 12개 `state + amount`를 선택 A/B/C 칸으로 변환
- 기존 다른 업체 칸 보존
- 6 context + `qty/unit/spec/memo` review metadata 보존
- review-only key `interior-quote-compare-shell-v41`
- target 12×state/amount 선검증
- review 저장 성공 후 visible DOM 변경
- review 저장 실패 시 DOM/source/handoff/preview 보존
- Apply/Cancel cleanup은 writer와 동일 Web Lock

## autosave / numeric robustness

- `commitAutosave()`는 `saveReview(next)` 성공 뒤 in-memory review 교체
- storage failure 시 기존 memory 유지
- quote-check / production compare amount capture guard
- blank 또는 0 이상의 finite number
- 단일 금액/업체 합계 `Number.MAX_SAFE_INTEGER` 이내
- app-v21 계산 전에 unsafe 값 제거
- handoff / Apply 직전 전체 quote 재검증

비호스팅:

- numeric boundary 8 / 8 PASS
- autosave state-order 3 / 3 PASS

## stale / invalid exact transfer cleanup

- freshness는 적용 가능 여부
- ownership은 exact source/handoff snapshot
- 30분 초과 exact pair → safe cleanup
- 만료 preview Apply → 적용 거부 + exact stale cleanup
- fresh exact라도 malformed quote / invalid target / future timestamp 등 적용 불가 → owned exact pair cleanup
- source/handoff mismatch/newer 상태 → exact가 아니므로 보존

회귀:

- stale ownership 8 / 8 PASS
- malformed exact state machine 6 / 6 PASS
- exact transfer snapshot race 8 / 8 PASS
- cleanup ownership-loss reconciliation: old cleanup은 false 완료를 표시하지 않고 current transfer를 재조회하며, valid newer pair면 새 preview를 재표시

`stale-transfer-probe.html` 9개 안에서 stale exact cleanup과 fresh malformed exact cleanup을 모두 runtime 검사합니다.

## writer / pending recovery

- Web Locks exclusive writer serialization
- fresh complete + fresh partial 점유
- second writer 차단
- write 후 exact snapshot 재검증
- failure cleanup ownership-aware
- production-shell Web Locks 미지원 fail-closed
- complete pending recovery / partial cleanup
- recovery cancel same lock + expected snapshot check

비호스팅:

- writer 8 / 8 PASS
- partial cleanup-window 11 / 11 PASS
- writer↔production compare lock interleaving 9 / 9 PASS
- basic compare parity 6 / 6 PASS

## navigation / resource isolation

- stylesheet → pinned local CSS
- app script → pinned local app-v21
- quote workflow → review-local relative path
- path형 / absolute production URL → resolved pathname guard
- site search → submit capture 차단
- canonical / OG / JSON-LD → inert metadata
- failure probe는 guard 실패 시 safety-net으로 실제 navigation을 막으면서 guard 성공 여부 판별
- self-check는 DOMParser로 `src`, `srcset`, form `action`, stylesheet `href` 검사

## 기존 Chromium production-shell 회귀

current-main selector/event 구조 기반: **26 / 26 PASS**

## hosted 자동 검사 준비

manifest `hosted_checks`가 source-of-truth:

- self-check 55
- failure 8
- writer concurrency 7
- pending recovery 9
- stale/invalid transfer 9
- robustness 18
- total **106**

robustness 18개에는 browser realm storage isolation lifecycle 2개가 포함됩니다.

self-check는 실제 결과 행 수가 manifest `self_check`와 다르면 summary FAIL입니다.

외부 HTTPS preview가 아직 없으므로 hosted PASS로 기록하지 않습니다.

## 남은 실호스팅 검수

1. hosted 자동검사 106개
2. storage baseline 및 production key SHA 불변
3. 실제 quote-check → quote-compare navigation
4. real-origin persistence / refresh / revisit
5. A → B → C
6. 실제 two-tab native `storage` event
7. 모바일 touch / horizontal scroll

실행 순서는 `HOSTED-QA-RUNBOOK.md`, baseline 재비교는 동일 inspector 탭에서 수행합니다.

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- production quote/compare 저장키 변경 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
