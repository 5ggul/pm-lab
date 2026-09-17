# Interior v41 production-shell QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

현재 main 동일성 확인 경계: `16d00c5ad807bfb7155a67baadb2084fde377029` (2026-09-17)

초기 production-shell 캡처 기준: `26b8f66b14316743e3bfaff73912a5b15901c48c`

`1fcedb1e... → 16d00c5...` 사이 main 3커밋은 `docs/franchise-ssg-preview/production-candidate-contract-test.json`만 변경했고 인테리어 quote-check/quote-compare HTML/CSS/JS blob은 그대로입니다.

## production storage read/write isolation

production-shell은 운영 이름 key를 검수 DOM에 섞지 않도록 읽기와 쓰기를 모두 분리합니다.

`assets/production-storage-read-mask-v41.js`

- app-v21보다 먼저 defer 실행
- `interior-quote-v5`, `interior-compare-v5`, `interior-compare-v6`의 `getItem`만 초기화 동안 `null` 반환
- review-only key는 원래 `getItem`으로 통과
- write API는 건드리지 않음
- DOMContentLoaded에서 원래 `Storage.prototype.getItem` 복원
- VM read-mask regression: **10 / 10 PASS**

쓰기 방어:

- quote-check 원본 save/reset capture 차단
- quote-compare 원본 save/reset capture 차단
- production-named key는 probe/adapter에서 쓰거나 삭제하지 않음

script order:

- quote-check: `production-storage-read-mask-v41 → app-v21 → production-shell-guard-v41 → quote-check-handoff-v41`
- quote-compare: `production-storage-read-mask-v41 → app-v21 → production-shell-guard-v41 → quote-compare-production-adapter-v41`

self-check는 두 wrapper 모두 mask marker와 이 순서를 검사하고, mask asset이 protected 3키를 가리고 DOMContentLoaded restore를 등록하는지도 확인합니다.

## production-shell adapter

파일: `assets/quote-compare-production-adapter-v41.js`

- handoff 12개 `state + amount`를 선택 A/B/C 칸으로 변환
- 기존 다른 업체 칸 보존
- app-v21의 `input/change` 흐름으로 합계·차이·chart 갱신
- 6 context + `qty/unit/spec/memo`는 review metadata 보존
- review-only key `interior-quote-compare-shell-v41`
- target 12×state/amount 선검증
- review 저장 성공 후에만 visible DOM 변경
- review 저장 실패 시 DOM 미변경 + source/handoff/preview 유지
- Apply/Cancel cleanup은 writer와 동일한 `interior-v41-handoff-write-v41` lock 사용

## autosave / numeric robustness

- `commitAutosave()`는 복사본을 `saveReview(next)`한 뒤에만 in-memory review 교체
- 강제 storage failure 시 기존 in-memory review 유지
- quote-check / production compare 모두 amount capture guard 사용
- blank 또는 0 이상의 finite number만 허용
- 단일 금액과 업체별 합계는 `Number.MAX_SAFE_INTEGER` 이내
- app-v21의 `Number()` 합산/차트 계산 전에 unsafe 값을 비움
- handoff / Apply 직전 전체 quote 합계 재검증

비호스팅 회귀:

- numeric boundary 8 / 8 PASS
- autosave storage-order 3 / 3 PASS

## robustness probe cross-realm fix

`robustness-probe.html`은 quote-compare를 iframe에 로드합니다. 실제 대상 realm에서 저장 실패를 강제하기 위해 `compareWin.Storage.prototype`을 패치하고, 같은 realm의 `DOMException`을 사용하며, `finally`에서 prototype 원복을 확인합니다.

## stale transfer ownership / cleanup

- freshness는 적용 가능 여부에만 사용
- ownership은 exact source/handoff snapshot 일치로 판단
- 30분이 지난 exact pair도 자기 snapshot이면 same Web Lock 안에서 안전 cleanup
- production-shell compare 진입 시 stale exact pair 자동 정리
- 만료 preview Apply는 적용 거부 + exact stale pair cleanup
- newer/mismatched transfer 보존

stale ownership 회귀: **8 / 8 PASS**

## quote-check writer / pending recovery

- Web Locks exclusive writer serialization
- fresh complete pair + fresh source-only/handoff-only partial 모두 점유 상태
- pending/partial이 있으면 새 writer 차단
- write 후 exact persisted snapshot 재검증
- 실패 cleanup은 자기 snapshot만 삭제
- production-shell Web Locks 미지원은 fail-closed
- navigation 중단 후 complete pending recovery panel
- partial state는 안전 cleanup만 제공
- recovery cancel도 same lock에서 expected snapshot 재검증
- unsafe 금액은 handoff 전에 차단

비호스팅 회귀:

- writer VM 8 / 8 PASS
- pending/partial cleanup-window VM 11 / 11 PASS
- writer↔production compare lock interleaving 9 / 9 PASS
- 기본 quote-compare cleanup parity state machine 6 / 6 PASS
- stale ownership/cleanup 8 / 8 PASS
- numeric/autosave robustness 11 / 11 PASS
- production storage read mask 10 / 10 PASS

## wrapper / navigation audit

- stylesheet → pinned local CSS
- app script → pinned local app-v21
- workflow quote links → review-local relative path
- 나머지 production-prefix anchor → resolved pathname guard가 차단
- absolute `https://.../pm-lab/interior-cost-preview/...` 링크도 차단
- site search → submit capture 차단
- canonical / og:url / JSON-LD URL → inert metadata
- failure probe는 guard 실패 시에도 safety-net으로 실제 navigation을 막으면서 capture guard 성공 여부를 구분

self-check는 transformed quote-check/compare에 unresolved production `src`, form `action`, stylesheet `href`가 없는지 검사합니다.

## 기존 Chromium production-shell 회귀

current-main selector/event 구조 기반 검수: **26 / 26 PASS**

- B handoff preview/state/amount
- 기존 A/C 보존
- 합계 및 production events
- review state + context/detail metadata
- production key sentinel 미변경
- reload-equivalent 복원
- stale-tab Apply 차단
- 새 transfer 보존
- page error 없음

## hosted 자동 검사 준비

`SNAPSHOT-MANIFEST.json`의 `hosted_checks`가 source-of-truth입니다.

- `self-check.html`: **55개**
- `failure-probe.html`: **8개**
- `writer-concurrency-probe.html`: **7개**
- `pending-recovery-probe.html`: **9개**
- `stale-transfer-probe.html`: **9개**
- `robustness-probe.html`: **16개**
- 합계 **104개**

self-check는 실제 생성된 검사 행 수가 manifest의 `self_check`와 다르면 summary 자체를 FAIL로 처리합니다.

외부 HTTPS preview가 아직 없으므로 위 항목을 PASS로 기록하지 않습니다.

## 남은 실호스팅 검수

1. hosted 자동 검사 104개
2. storage 기준점 기록 및 운영 이름 key SHA 불변
3. 실제 quote-check → quote-compare navigation
4. real-origin localStorage 지속성
5. refresh / 브라우저 재접속 복원
6. A → B → C 연속 handoff
7. 실제 두 탭 native `storage` event
8. 모바일 실제 touch / horizontal scroll

실행 순서는 `HOSTED-QA-RUNBOOK.md`에 고정하며, sessionStorage baseline 비교는 동일 inspector 탭에서 수행합니다.

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- production quote/compare 저장키 변경 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
