# Interior v41 production-shell failure-path QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## 확인한 결함

### 1. review compare 저장 실패 시 DOM만 먼저 바뀔 수 있었음

조치:

- target 12개 `state + amount` field 선검증
- review-only storage write 성공 후 visible DOM 변경
- 실패 시 source/handoff/preview 유지
- status에 명시적 오류
- autosave 실패도 status 경고
- autosave는 `saveReview(next)` 성공 뒤에만 in-memory review 교체

### 2. production-shell 검색/내부 메뉴 이탈 가능

조치:

- `production-shell-guard-v41.js`
- site search submit capture 차단
- quote-check/quote-compare workflow 상대경로 허용
- workflow 밖 `/pm-lab/interior-cost-preview/` 절대 내부 링크 차단
- pinned stylesheet/app script는 local snapshot으로 rewrite
- transformed wrapper에 unresolved production functional asset이 없는지 self-check

### 3. writer/cleanup/recovery 오류 경로

추가 조치:

- Web Locks writer serialization
- fresh complete + fresh partial 상태에서 새 writer 차단
- write failure ownership cleanup
- navigation 중단 후 recovery UI
- recovery cancel expected snapshot 재검증
- production compare Apply/Cancel cleanup shared lock
- 기본 compare cleanup은 partial blocker + ownership rule로 parity 확보
- stale exact transfer는 freshness와 ownership을 분리해 안전 cleanup

### 4. 비정상 숫자 / autosave failure probe

- quote-check / production compare amount capture guard
- negative / Infinity / unsafe integer / aggregate overflow 차단
- app-v21 계산 전에 unsafe 값을 비움
- robustness probe는 iframe realm의 `compareWin.Storage.prototype`을 패치해 실제 adapter 저장 실패를 강제
- prototype 원복도 별도 확인

## 비호스팅 회귀

- writer VM: 8 / 8 PASS
- partial/cleanup-window: 11 / 11 PASS
- writer↔production compare lock interleaving: 9 / 9 PASS
- basic compare cleanup parity: 6 / 6 PASS
- stale ownership/cleanup: 8 / 8 PASS
- numeric boundary: 8 / 8 PASS
- autosave state order: 3 / 3 PASS

## hosted self-check

`production-shell/self-check.html`: **55개**

검사 범위:

- snapshot metadata / 4 blob hash
- wrapper rewrite / script order
- production functional asset 잔존 여부
- storage/navigation guards
- storage-before-DOM atomic compare commit
- writer Web Locks / lock name / pending blocker / ownership cleanup / fail-closed
- complete/partial pending detection
- recovery panel/cancel
- stale exact cleanup / ownership-freshness 분리
- quote-check / compare amount guard
- autosave storage-before-memory
- production compare cleanup shared lock

외부 HTTPS preview 전이므로 아직 55/55 PASS로 기록하지 않습니다.

## hosted failure probe

`production-shell/failure-probe.html`: **8개**

1. 사이트 검색 이탈 차단
2. workflow 밖 내부링크 차단
3. handoff preview 생성
4. review localStorage 강제 실패 시 B DOM 미변경
5. 실패 후 source 유지
6. 실패 후 handoff 유지
7. 실패 상태 안내
8. production-named storage 3개 불변

## hosted 전체 자동검사

- self-check 55
- failure 8
- writer concurrency 7
- pending recovery 9
- stale transfer 9
- robustness 16

총 **104개**입니다. 실제 PASS 수치는 외부 비운영 HTTPS preview에서만 기록합니다.

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
