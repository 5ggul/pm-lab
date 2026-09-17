# Interior v41 production-shell QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

현재 main 동일성 확인 경계: `918d62e9eec5d0b19653523822e8d4ab797f4776` (2026-09-17)

초기 production-shell 캡처 기준: `26b8f66b14316743e3bfaff73912a5b15901c48c`

초기 캡처 이후 main의 추가 변경은 프랜차이즈/데이터 봇 산출물이었고 인테리어 quote-check/quote-compare HTML/CSS/JS blob은 `918d62e9...`까지 동일합니다.

## 현재 main 재대조

- quote-check: 6 context (`supply`, `exclusive`, `building`, `region`, `scope`, `bathrooms`)
- quote-check: 12 공종
- 상태값: `included`, `separate`, `missing`
- 상세 필드: `amount`, `qty`, `unit`, `spec`, `memo`
- quote-compare 공개 입력: A/B/C 각각 `state + amount`
- current bundle: `app-v21-bundle.js` SHA `4a82f3be0d598d9593f6eff21259f98e32ff231d`
- `app-v22` 없음
- main에는 `docs/interior-v41-preview/` 경로 없음

## production-shell adapter

파일: `assets/quote-compare-production-adapter-v41.js`

- handoff 12개 `state + amount`를 선택 A/B/C 칸으로 변환
- 기존 다른 업체 칸 보존
- app-v21의 `input/change` 흐름으로 합계·차이·chart 갱신
- 6 context + `qty/unit/spec/memo`는 review metadata 보존
- review-only key `interior-quote-compare-shell-v41`
- 운영 compare key 사용 금지 / 원본 save-reset capture 차단
- target 12×state/amount 선검증
- review 저장 성공 후에만 visible DOM 변경
- review 저장 실패 시 DOM 미변경 + source/handoff/preview 유지
- Apply/Cancel cleanup은 writer와 동일한 `interior-v41-handoff-write-v41` lock 사용

## autosave / numeric robustness

기존 autosave는 storage 쓰기 전에 in-memory `review.flat`을 바꿨기 때문에 저장 실패 뒤 메모리와 storage가 어긋날 수 있었습니다.

현재:

- `commitAutosave()`가 복사본 `next`를 생성
- `saveReview(next)` 성공 후에만 `replaceReview(review,next)`
- 강제 storage failure 시 기존 in-memory review 유지

main `app-v21`은 quote/compare 금액을 `Number(value || 0)`로 직접 합산하고 v6 chart width를 `value / total * 100`으로 계산합니다. 따라서 programmatic restore/import를 통해 비정상 값이 들어오면 `∞만원` 또는 `NaN%`가 가능했습니다.

현재 quote-check / production compare 공통 원칙:

- blank 허용
- 0 이상의 finite number만 허용
- 단일 금액과 업체별 합계 모두 `Number.MAX_SAFE_INTEGER` 범위 안에서 유지
- capture 단계에서 app-v21 bubble 계산보다 먼저 unsafe 값을 비움
- handoff Apply/전송 직전에도 전체 quote 합계를 다시 검증
- 임의 사업상 가격 상한은 만들지 않음

비호스팅 회귀:

- numeric boundary 8 / 8 PASS
- autosave storage-order 3 / 3 PASS
- 합계 11 / 11 PASS

## stale transfer ownership / cleanup

기존 adapter는 ownership 판단에 `getMatchedQuote()`를 사용해 freshness에 의존했습니다. 따라서 exact 자기 transfer도 30분이 지나면 ownership=false가 되어 cleanup되지 않을 수 있었습니다.

현재 동작:

- freshness는 적용 가능 여부에만 사용
- ownership은 `transferId + createdAt + source quote snapshot + handoff target` exact 일치로 판단
- 30분이 지난 exact pair도 자기 snapshot이면 같은 Web Lock 안에서 안전 cleanup
- production-shell compare 진입 시 stale exact pair 자동 정리
- fresh preview를 30분 넘게 열어 둔 뒤 Apply하면 적용은 거부하고 exact stale pair는 정리
- newer/mismatched transfer는 ownership 불일치로 보존

stale ownership 회귀: **8 / 8 PASS**

## quote-check writer / pending recovery

파일: `assets/quote-check-handoff-v41.js`

- Web Locks exclusive writer serialization
- fresh complete pair + fresh source-only/handoff-only partial 모두 점유 상태
- fresh pending/partial이 있으면 새 writer 차단
- write 후 exact persisted snapshot 재검증
- 실패 cleanup은 자기 snapshot만 삭제
- production-shell Web Locks 미지원은 fail-closed
- navigation 중단 후 complete pending recovery panel
- partial state는 안전 cleanup만 제공
- recovery cancel도 같은 lock에서 expected snapshot 재검증
- unsafe 금액은 handoff 전에 차단

비호스팅 회귀:

- writer VM 8 / 8 PASS
- pending/partial cleanup-window VM 11 / 11 PASS
- writer↔production compare lock interleaving 9 / 9 PASS
- 기본 quote-compare cleanup parity state machine 6 / 6 PASS
- stale ownership/cleanup 8 / 8 PASS
- numeric/autosave robustness 11 / 11 PASS

기본 `quote-compare/`는 별도 cleanup lock을 중복 추가하지 않습니다. 공통 writer가 fresh partial 상태까지 차단하고 ownership-aware cleanup을 사용하므로, 순차 cleanup의 중간 상태에서도 새 writer가 진입하지 못한다는 것을 6/6 상태 머신으로 확인했습니다.

## wrapper / absolute production path audit

pinned quote-check / quote-compare HTML에 남아 있는 `/pm-lab/interior-cost-preview/` 참조를 기능성/비기능성으로 분류했습니다.

- stylesheet → pinned local CSS로 rewrite
- app script → pinned local app-v21로 rewrite
- workflow quote-check/quote-compare links → review-local relative path로 rewrite
- 나머지 내부 anchor → production-shell guard가 capture 차단
- site search → production-shell guard가 submit 차단
- canonical / og:url / JSON-LD URL → inert metadata

self-check는 변환 뒤 unresolved production `src`, form `action`, stylesheet `href`가 없는지 quote-check/compare 각각 검사합니다.

## script 순서

- quote-check: `app-v21 → production-shell-guard-v41 → quote-check-handoff-v41`
- quote-compare: `app-v21 → production-shell-guard-v41 → quote-compare-production-adapter-v41`

## production-shell navigation/storage guard

- quote-check 원본 `[data-save-quote]`, `[data-reset-quote]` capture 차단
- compare 원본 save/reset capture 차단
- `[data-site-search]` submit capture 차단
- workflow 밖 `/pm-lab/interior-cost-preview/` 절대 내부링크 차단
- CSV / 결과 복사 / 인쇄 등 비저장 기능은 유지

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

- `self-check.html`: **54개**
- `failure-probe.html`: **8개**
- `writer-concurrency-probe.html`: **7개**
- `pending-recovery-probe.html`: **9개**
- `stale-transfer-probe.html`: **9개**
- `robustness-probe.html`: **15개**
- 합계 **102개**

외부 HTTPS preview가 아직 없으므로 위 항목을 PASS로 기록하지 않습니다.

## 아직 남은 실호스팅 검수

1. hosted 자동 검사 102개
2. storage 기준점 기록 및 운영 이름 key SHA 불변
3. 실제 quote-check → quote-compare navigation
4. real-origin localStorage 지속성
5. refresh / 브라우저 재접속 복원
6. A → B → C 연속 handoff
7. 실제 두 탭 native `storage` event
8. 모바일 실제 touch / horizontal scroll

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- production quote/compare 저장키 변경 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
