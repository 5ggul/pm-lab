# Interior v41 robustness QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## 확인한 결함

### 1. compare autosave 실패 시 메모리 상태 선행

기존 autosave는 storage write 전에 in-memory review를 바꿀 수 있었습니다.

조치:

- `commitAutosave(review, host)`
- 복사본 `next`에 DOM 반영
- `saveReview(next)` 성공 후에만 `replaceReview(review, next)`
- 저장 실패 시 기존 in-memory review 유지

### 2. app-v21 비정상 숫자 합산

pinned main app-v21은 quote/compare 금액을 `Number(value || 0)` 계열로 직접 합산합니다.

가능 문제:

- `1e309` → Infinity
- 합계 `∞만원`
- 차트 `NaN%`
- 음수 / JS 안전범위 초과 값 포함

조치:

- `MAX_SAFE_AMOUNT = Number.MAX_SAFE_INTEGER`
- quote-check / production compare `amountCheck()` / aggregate validation
- capture 단계 amount guard
- handoff / Apply 직전 전체 quote 재검증
- 임의의 사업상 가격 상한은 만들지 않음

### 3. iframe autosave failure의 Storage realm 오류

robustness probe의 compare adapter는 iframe realm에서 실행됩니다.

조치:

- 부모 `Storage.prototype` 대신 `compareWin.Storage.prototype` 패치
- same-realm `DOMException`
- `finally`에서 `setItem` 원복
- prototype 원복 여부 자체 검사

### 4. production storage isolation의 hosted runtime 검증 부족

production-shell은 `production-storage-read-mask-v41.js`를 app-v21보다 먼저 실행해 초기 production read를 숨기고, protected production 3키의 `setItem/removeItem`도 shell document lifetime 동안 차단합니다.

비호스팅 storage isolation simulation은 12/12 PASS이며, 실제 browser realm에서도 확인하기 위해 robustness probe에 별도 `srcdoc` iframe을 사용합니다.

실제 production key는 쓰지 않습니다. srcdoc iframe 내부에서만 underlying `Storage.prototype.getItem`을 fake sentinel reader로 바꾼 뒤 mask asset을 **두 번 연속 로드**해 duplicate-load one-shot guard까지 검증합니다.

검증:

- DOMContentLoaded 전 `interior-quote-v5`, `interior-compare-v5`, `interior-compare-v6` → null
- review key → fake underlying reader 값 통과
- mask `active === true`
- DOMContentLoaded 뒤 underlying fake reader 복원
- mask `active === false`

iframe은 probe 종료 시 폐기되므로 부모 realm과 실제 production storage 값은 건드리지 않습니다.

## 비호스팅 강제 회귀

금액 경계: **8 / 8 PASS**

autosave state order: **3 / 3 PASS**

production storage isolation actual asset read/write/one-shot/restore: **12 / 12 PASS**

## pinned snapshot functional path audit

- stylesheet → pinned local CSS
- app script → pinned local app-v21
- path형 / absolute production navigation → resolved pathname guard
- site search → capture guard
- canonical / OG / JSON-LD → inert metadata

self-check는 DOMParser로 transformed quote-check/compare의 `src`, `srcset`, form `action`, stylesheet `href`를 검사합니다.

## hosted robustness probe

`production-shell/robustness-probe.html`: **18개 검사 준비**

1. DOMContentLoaded 전 production 3키 read를 숨기고 production set/remove를 차단하며 review read/write는 통과
2. DOMContentLoaded 뒤 underlying reader 복원
3. compare adapter API 로드
4. 정상 금액 허용
5. 음수 거부
6. Infinity 거부
7. unsafe integer 거부
8. 업체 합계 overflow quote 거부
9. manual 업체 합계 overflow 입력 자동 정리
10. compare DOM에 `∞` / `NaN` 미노출
11. iframe realm autosave 강제 실패 재현
12. autosave 실패 후 in-memory review 불변
13. iframe `Storage.prototype.setItem` 원복
14. autosave 성공 후 in-memory review 갱신
15. quote-check amount API 로드
16. quote-check 음수 입력 자동 정리
17. quote-check 합계 overflow 입력 자동 정리
18. production-named storage 3개 불변

## self-check 현재 범위

`production-shell/self-check.html`: **58개**

- manifest hosted-check inventory 58/8/7/9/9/18 = 109
- storage isolation prelude + load order
- DOMParser production resource audit
- amount guards
- autosave storage-before-memory
- stale + invalid exact cleanup marker
- ownership/freshness 분리
- absolute production URL guard

## hosted 전체 자동검사

- self-check: 58
- failure: 8
- writer concurrency: 7
- pending recovery: 9
- stale/invalid transfer: 9
- robustness: 18

총 **109개**입니다. 외부 HTTPS preview가 아직 없으므로 hosted PASS로 기록하지 않습니다.

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
