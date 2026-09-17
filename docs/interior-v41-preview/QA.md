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
- production-named storage 미변경

## 동시성/복구 안전 규칙

### writer

- Web Locks exclusive lock `interior-v41-handoff-write-v41`
- fresh complete pair + fresh source-only/handoff-only partial 모두 점유 상태
- pending/partial이 있으면 두 번째 writer 차단
- write 후 persisted snapshot exact 검증
- write failure cleanup은 ownership-aware
- production-shell에서 Web Locks 미지원 시 fail-closed

### pending recovery

- 이동 실패 후 complete pending: 비교표 다시 열기 / 취소
- source-only 또는 handoff-only partial: 안전 cleanup만 제공
- recovery cancel도 같은 lock에서 expected snapshot 재검증
- stale recovery action이 newer transfer를 삭제하지 않음

### compare cleanup

- production-shell Apply/Cancel cleanup은 writer와 같은 lock 사용
- 기본 v41 quote-compare는 공통 writer의 fresh partial blocker로 cleanup-window 새 writer 진입을 막음
- 기본 compare cleanup parity state machine: 6 / 6 PASS

### stale transfer

- freshness와 ownership 분리
- exact 자기 transfer는 30분이 지나도 ownership 유지
- 30분 초과 exact pair는 production-shell compare 진입 시 safe cleanup
- preview 만료 뒤 Apply는 적용하지 않고 exact stale pair만 cleanup
- newer/mismatched transfer는 ownership 불일치로 보존

### numeric / autosave robustness

- quote-check / production compare amount capture guard
- blank 또는 0 이상의 finite 금액만 허용
- 단일 금액 및 업체별 합계가 `Number.MAX_SAFE_INTEGER`를 넘지 않도록 방어
- app-v21의 `Number()` 합산/차트 계산 전에 unsafe 값을 비움
- quote handoff / compare Apply 직전에 금액 합계를 다시 검증
- autosave는 storage 성공 후에만 in-memory review를 교체
- storage failure 시 in-memory review는 마지막 성공 저장 상태 유지
- robustness probe는 iframe의 `compareWin.Storage.prototype`을 패치/원복해 실제 대상 realm의 저장 실패를 강제

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
- numeric boundary: 8 / 8 PASS
- autosave state order: 3 / 3 PASS

## pinned current-main shell

캡처 commit: `26b8f66b14316743e3bfaff73912a5b15901c48c`

동일성 확인 경계: `1fcedb1e01a1a0372d35a3916a5c92646f901cfb`

고정 blob:

- quote-check HTML `17027e5b3c2370c8b34be14187d33ca973e9cc99`
- quote-compare HTML `04a41335095677a0ac13aea33390dd60b411ede2`
- site-v21 CSS `42839ad56e96b1f5c49245fd1ca518482a45bd66`
- app-v21 JS `4a82f3be0d598d9593f6eff21259f98e32ff231d`

`918d62e9... → 1fcedb1e...` 사이 main 29커밋은 updown 데이터 3개와 franchise production contract JSON만 변경했고 위 4개 interior blob은 그대로입니다.

## wrapper 기능 경로 audit

- production-prefix stylesheet / app script는 pinned local asset으로 rewrite
- quote workflow link는 review-local 상대경로 rewrite
- workflow 밖 production-prefix anchor와 site search는 guard 차단
- canonical / Open Graph / JSON-LD의 production URL은 inert metadata
- transformed quote-check / compare에서 unresolved production `src`, form `action`, stylesheet `href`가 없는지 self-check 포함

## hosted 자동검사 준비

- self-check: 55
- failure-probe: 8
- writer-concurrency-probe: 7
- pending-recovery-probe: 9
- stale-transfer-probe: 9
- robustness-probe: 16

총 **104개**.

외부 HTTPS preview가 아직 없으므로 hosted PASS로 기록하지 않습니다.

## 남은 실호스팅 검수

1. 104개 hosted 자동검사
2. 실제 quote-check → quote-compare navigation
3. real-origin localStorage refresh/revisit
4. A → B → C 연속 handoff
5. 실제 서로 다른 탭 native `storage` event
6. 모바일 실제 touch/scroll
7. storage inspector 기준점 대비 production-named key 불변

실행 순서는 `HOSTED-QA-RUNBOOK.md`에 고정합니다.

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
