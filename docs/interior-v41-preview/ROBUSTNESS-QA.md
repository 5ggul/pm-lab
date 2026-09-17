# Interior v41 robustness QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## 이번 묶음에서 확인한 결함

### 1. compare autosave 실패 시 메모리 상태가 저장소보다 앞서갈 수 있었음

기존 `bindReviewAutosave()`는 저장 전에 in-memory `review.flat`을 먼저 바꿀 수 있어 review-only localStorage 쓰기가 실패하면 메모리 상태가 저장소보다 앞서갈 수 있었습니다.

조치:

- `commitAutosave(review, host)` 추가
- `next = normalizeReview(review)` 복사본 생성
- DOM 값을 `next.flat`에 반영
- `saveReview(next)` 성공 후에만 `replaceReview(review, next)` 수행
- 저장 실패 시 기존 `review` 객체는 그대로 유지

### 2. main app-v21의 금액 계산이 비정상 숫자를 그대로 `Number()`로 합산함

고정된 main `app-v21-bundle.js`의 quote/compare 합계와 차트 계산은 금액을 `Number(value || 0)` 계열로 직접 사용합니다. programmatic restore/import를 통해 비정상 값이 들어오면 다음이 가능합니다.

- `1e309` → `Infinity`
- 합계 표시 → `∞만원`
- 차트 계산 → `NaN%`
- 음수 또는 JavaScript 안전 정수 범위를 넘는 값이 합계에 포함

HTML의 `type=number min=0`만으로는 programmatic restore/import와 모든 브라우저 입력 경로를 충분히 방어하지 못합니다.

조치:

`assets/quote-check-handoff-v41.js`

- `MAX_SAFE_AMOUNT = Number.MAX_SAFE_INTEGER`
- `amountCheck()` / `validateQuoteAmounts()`
- quote-check amount capture guard
- 음수 / non-finite / JS 안전범위 초과 / 12개 합계 안전범위 초과 시 해당 입력을 비움
- app-v21 bubble listener보다 capture 단계에서 먼저 정리
- handoff 직전에도 quote 전체 금액을 다시 검증

`assets/quote-compare-production-adapter-v41.js`

- 동일한 안전 금액 규칙 적용
- A/B/C 각 업체별 12개 합계를 안전범위 안에서 유지
- manual input, app-v21 restore, review restore, handoff apply 경로 모두 방어
- invalid imported quote는 Apply 전에 거부

임의의 사업상 최대 견적액을 만들지 않고 JavaScript가 유한하고 안정적으로 계산 가능한 기술적 상한만 사용합니다.

### 3. iframe probe에서 잘못된 Storage realm을 패치할 수 있었음

`robustness-probe.html`은 production-shell quote-compare를 iframe에 띄워 실제 adapter를 검사합니다. 이때 부모 문서의 `Storage.prototype`을 패치하면 테스트 대상 iframe의 `localStorage.setItem()`까지 강제로 실패하지 않을 수 있습니다.

조치:

- 테스트 대상 iframe의 `compareWin.Storage.prototype`을 직접 패치
- 같은 iframe realm의 `DOMException` 사용
- `finally`에서 원래 `setItem`으로 복원
- prototype이 실제로 원복됐는지 별도 검사 추가

`failure-probe.html`은 adapter를 부모 문서에 직접 로드하므로 기존 부모 `Storage.prototype` 패치가 맞습니다. 따라서 cross-realm 수정 대상은 robustness probe만입니다.

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
- canonical / og:url / JSON-LD URL: inert metadata

self-check는 quote-check/compare 변환 결과에 unresolved production `src`, form `action`, stylesheet `href`가 없는지 각각 검사합니다.

## hosted robustness probe

`production-shell/robustness-probe.html`: **16개 검사 준비**

1. compare adapter API 로드
2. 정상 금액 허용
3. 음수 거부
4. Infinity 거부
5. unsafe integer 거부
6. 업체 합계 overflow quote 거부
7. manual 업체 합계 overflow 입력 자동 정리
8. compare DOM에 `∞` / `NaN` 미노출
9. iframe realm autosave 강제 실패 재현
10. autosave 실패 후 메모리 review 불변
11. iframe `Storage.prototype` 원복 확인
12. autosave 성공 후 메모리 review 갱신
13. quote-check amount API 로드
14. quote-check 음수 입력 자동 정리
15. quote-check 합계 overflow 입력 자동 정리
16. production-named storage 3개 불변

probe 종료 시 review/source/handoff와 production-named key 원값을 복원합니다.

## self-check 현재 범위

현재 `production-shell/self-check.html` 소스 기준 **55개 항목**입니다.

robustness 관련 marker:

- robustness probe manifest entrypoint
- quote-check / quote-compare unresolved functional production asset 없음
- quote-check amount capture guard / safe amount validator
- compare amount capture guard / safe amount validator
- compare autosave storage-before-memory
- compare ownership이 freshness와 분리됐는지 검사
- stale exact pair cleanup marker

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
