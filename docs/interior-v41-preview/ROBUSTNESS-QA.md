# Interior v41 robustness QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## 이번 묶음에서 확인한 결함

### 1. compare autosave 실패 시 메모리 상태가 저장소보다 앞서갈 수 있었음

기존 `bindReviewAutosave()`는 다음 순서였습니다.

1. `review.flat = readDomFlat(host)`
2. `saveReview(review)`

따라서 review-only localStorage 쓰기가 실패해도 메모리 `review.flat`은 이미 새 화면값으로 바뀌었습니다. 이후 다른 성공 동작에서 저장되지 않았던 값이 섞일 수 있었습니다.

조치:

- `commitAutosave(review, host)` 추가
- `next = normalizeReview(review)` 복사본 생성
- DOM 값을 `next.flat`에 반영
- `saveReview(next)` 성공 후에만 `replaceReview(review, next)` 수행
- 저장 실패 시 기존 `review` 객체는 그대로 유지

### 2. main app-v21의 금액 계산이 비정상 숫자를 그대로 `Number()`로 합산함

고정된 main `app-v21-bundle.js`의 quote/compare 합계와 v6 차트는 금액을 `Number(value || 0)`로 바로 계산합니다.

비정상 입력이 DOM/storage를 통해 들어오면 다음이 가능합니다.

- `1e309` → `Infinity`
- 합계 표시 → `∞만원`
- 차트에서 `Infinity / Infinity` → `NaN%`
- 음수 또는 JS 안전 범위를 넘는 값이 합계에 포함

HTML의 `type=number min=0`만으로는 programmatic restore/import와 모든 브라우저 입력 경로를 충분히 방어하지 못합니다.

조치:

`assets/quote-check-handoff-v41.js`

- `MAX_SAFE_AMOUNT = Number.MAX_SAFE_INTEGER`
- `amountCheck()`
- `validateQuoteAmounts()`
- quote-check amount capture guard
- 음수 / non-finite / JS 안전범위 초과 / 12개 합계 안전범위 초과 시 해당 입력을 비움
- app-v21 bubble listener보다 capture 단계에서 먼저 정리
- handoff 직전에도 quote 전체 금액을 다시 검증

`assets/quote-compare-production-adapter-v41.js`

- 동일한 안전 금액 규칙 적용
- A/B/C 각 업체별 12개 합계를 안전범위 안에서 유지
- manual input, app-v21 restore, review restore, handoff apply 경로 모두 방어
- invalid imported quote는 Apply 전에 거부

임의의 사업상 최대 견적액을 만들지 않고 JavaScript가 유한하고 안정적으로 정수 단위 계산 가능한 기술적 상한만 사용합니다.

## 비호스팅 강제 회귀

금액 경계 simulation: **8 / 8 PASS**

1. blank 허용
2. 정상 소수 금액 허용
3. 음수 거부
4. `1e309` 거부
5. `NaN` 거부
6. `Number.MAX_SAFE_INTEGER + 1` 거부
7. 두 항목 합계가 safe range를 넘으면 거부
8. safe-range 경계값 허용

autosave state simulation: **3 / 3 PASS**

1. 강제 저장 실패 예외 확인
2. 실패 후 in-memory review unchanged
3. 저장 성공 후에만 in-memory review 갱신

합계: **11 / 11 PASS**

## pinned snapshot `/pm-lab/` 기능 경로 audit

quote-check / quote-compare pinned HTML의 `/pm-lab/interior-cost-preview/` 참조를 기능성과 비기능성으로 나눴습니다.

기능성 외부 참조:

- stylesheet `site-v21-bundle.css`
- script `app-v21-bundle.js`

두 파일은 wrapper에서 모두 `production-shell/snapshot-assets/` 상대경로로 교체됩니다.

남는 참조:

- 내부 `<a href>`: production-shell guard가 workflow 밖 이동을 capture 차단
- site search: production-shell guard가 submit 차단
- canonical / og:url / JSON-LD URL: 메타데이터이며 브라우저 기능 fetch/navigation 경로로 사용하지 않음

self-check에 quote-check/compare 각각 unresolved production `src`, form `action`, stylesheet `href`가 없는지 검사를 추가했습니다.

## hosted robustness probe

`production-shell/robustness-probe.html`: **15개 검사 준비**

1. compare adapter API 로드
2. 정상 금액 허용
3. 음수 거부
4. Infinity 거부
5. unsafe integer 거부
6. 업체 합계 overflow quote 거부
7. manual 업체 합계 overflow 입력 자동 정리
8. compare DOM에 `∞` / `NaN` 미노출
9. autosave 강제 실패 재현
10. autosave 실패 후 메모리 review 불변
11. autosave 성공 후 메모리 review 갱신
12. quote-check amount API 로드
13. quote-check 음수 입력 자동 정리
14. quote-check 합계 overflow 입력 자동 정리
15. production-named storage 3개 불변

probe 종료 시 review/source/handoff와 production-named key 원값을 복원합니다.

## self-check 확장

기존 44개에서 다음 10개를 추가해 **54개**가 됩니다.

- stale-transfer probe manifest entrypoint
- robustness probe manifest entrypoint
- quote-check unresolved functional production asset 없음
- quote-compare unresolved functional production asset 없음
- quote-check amount capture guard
- quote-check safe amount validator
- compare amount capture guard
- compare safe amount validator
- compare autosave storage-before-memory
- compare ownership이 freshness와 분리됐는지 검사

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
