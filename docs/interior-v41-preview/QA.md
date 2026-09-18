# Interior v41 handoff QA

검수 대상: `interior-v40-preview` / Draft PR #201

## 현재 구조

- quote-check → quote-compare same-origin handoff
- review-only storage namespace 사용
- source/handoff v2 `transferId + createdAt` pair 검증
- A/B/C 자동 적용 금지, 미리보기 후 Apply/Cancel
- 6 context + 12 공종 + `amount/qty/unit/spec/memo`
- URL에 견적 payload 없음
- review pages noindex
- production-named storage read/write isolation

## production storage isolation

app-v21 초기화 동안 `production-storage-read-mask-v41.js`가 다음 production key의 `getItem`을 `null` 처리하고, 같은 3키의 `setItem/removeItem`은 shell document lifetime 동안 차단합니다.

- `interior-quote-v5`
- `interior-compare-v5`
- `interior-compare-v6`

review-only storage read/write는 그대로 통과합니다. DOMContentLoaded에서 원래 `Storage.prototype.getItem`만 복원하며, protected production key write shield는 document lifetime 동안 유지합니다.

write/reset은 quote-check / compare capture guard가 차단합니다.

storage isolation actual-asset read/write/one-shot/restore simulation: **12 / 12 PASS**

robustness hosted probe도 실제 production key를 쓰지 않는 `srcdoc` browser realm에서 mask active/restore를 검사합니다.

production-shell load order:

- quote-check: `storage-read-mask → app-v21 → shell guard → handoff`
- quote-compare: `storage-read-mask → app-v21 → shell guard → production adapter`

## 동시성/복구 안전 규칙

### writer

- Web Locks exclusive lock `interior-v41-handoff-write-v41`
- fresh complete pair + fresh source-only/handoff-only partial 모두 점유 상태
- pending/partial이 있으면 두 번째 writer 차단
- write 후 persisted snapshot exact 검증
- write failure cleanup ownership-aware
- production-shell Web Locks 미지원 fail-closed

### pending / stale / invalid exact

- 이동 실패 후 complete pending: 비교표 다시 열기 / 취소
- source-only 또는 handoff-only partial: 안전 cleanup만 제공
- recovery cancel도 same lock에서 expected snapshot 재검증
- freshness와 ownership 분리
- exact 자기 transfer는 30분이 지나도 ownership 유지
- stale preview 적용 금지 + exact stale pair cleanup
- fresh exact라도 quote 손상 / invalid target / future timestamp 등 적용 불가면 exact owned pair만 cleanup
- source/handoff mismatch/newer 상태는 exact가 아니므로 보존

회귀:

- stale ownership/cleanup 8 / 8 PASS
- malformed exact state machine 6 / 6 PASS

### compare cleanup

- production-shell Apply/Cancel cleanup은 writer와 같은 lock 사용
- 기본 v41 quote-compare는 공통 writer fresh partial blocker로 cleanup-window 진입을 막음
- basic compare cleanup parity: 6 / 6 PASS

## numeric / autosave robustness

- quote-check / production compare amount capture guard
- blank 또는 0 이상의 finite 금액만 허용
- 단일 금액 및 업체별 합계 `Number.MAX_SAFE_INTEGER` 이내
- app-v21 `Number()` 합산/차트 계산 전에 unsafe 값을 비움
- handoff / Apply 직전 quote 합계 재검증
- autosave는 storage 성공 후에만 in-memory review 교체
- robustness probe는 iframe `compareWin.Storage.prototype`을 패치/복원해 실제 대상 realm 저장 실패 강제

## navigation/resource isolation

- stylesheet / app script → pinned local asset
- quote workflow link → review-local 상대경로
- workflow 밖 path형/absolute production URL → resolved pathname guard
- site search → capture 차단
- failure probe는 guard 실패 시 safety-net으로 실제 navigation을 막으면서 guard 성공 여부 구분
- self-check는 DOMParser로 transformed HTML의 `src`, `srcset`, form `action`, stylesheet `href` 검사
- canonical / Open Graph / JSON-LD production URL은 inert metadata

## 누적 비호스팅 QA

- persistence: 13 / 13 PASS
- quote-check → quote-compare 통합 VM: 30 / 30 PASS
- portable route + transfer pair: 13 / 13 PASS
- actual handoff code VM: 14 / 14 PASS
- Chromium 360 / 375 / 390 / 430px overflow/dialog/focus/touch target/B Apply: PASS
- stale Apply/storage-event: 17 / 17 PASS
- Cancel/ownership/orphan: 9 / 9 PASS
- production-shell adapter: 26 / 26 PASS
- writer VM: 8 / 8 PASS
- pending/partial cleanup-window: 11 / 11 PASS
- writer↔production compare lock interleaving: 9 / 9 PASS
- basic compare cleanup parity: 6 / 6 PASS
- stale ownership/cleanup: 8 / 8 PASS
- malformed exact state machine: 6 / 6 PASS
- numeric boundary: 8 / 8 PASS
- autosave state order: 3 / 3 PASS
- production storage isolation read/write/one-shot/restore: 12 / 12 PASS
- exact transfer snapshot race: 8 / 8 PASS

## pinned current-main shell

캡처 commit: `26b8f66b14316743e3bfaff73912a5b15901c48c`

동일성 확인 경계: `2fa0d48fc4a13f1401a319e3690b3122fa06da97`

고정 blob:

- quote-check HTML `17027e5b3c2370c8b34be14187d33ca973e9cc99`
- quote-compare HTML `04a41335095677a0ac13aea33390dd60b411ede2`
- site-v21 CSS `42839ad56e96b1f5c49245fd1ca518482a45bd66`
- app-v21 JS `4a82f3be0d598d9593f6eff21259f98e32ff231d`

## hosted 자동검사 준비

`SNAPSHOT-MANIFEST.json`의 `hosted_checks`가 source-of-truth입니다.

- self-check: 58
- failure-probe: 8
- writer-concurrency-probe: 7
- pending-recovery-probe: 9
- stale-transfer-probe: 9
- robustness-probe: 18
- total **109**

self-check는 실제 생성 행 수와 manifest `self_check`가 다르면 summary를 FAIL로 처리합니다.

외부 HTTPS preview가 아직 없으므로 hosted PASS로 기록하지 않습니다.

## 남은 실호스팅 검수

1. 109개 hosted 자동검사
2. 실제 quote-check → quote-compare navigation
3. real-origin localStorage refresh/revisit
4. A → B → C 연속 handoff
5. 실제 서로 다른 탭 native `storage` event
6. 모바일 실제 touch/scroll
7. 같은 storage-inspector 탭에서 baseline 대비 production-named key 불변 확인

실행 순서는 `HOSTED-QA-RUNBOOK.md`에 고정합니다.

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
