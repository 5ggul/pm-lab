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

### 2. production-shell 검색/내부 메뉴 이탈 가능

조치:

- `production-shell-guard-v41.js`
- site search submit capture 차단
- quote-check/quote-compare workflow 상대경로 허용
- workflow 밖 `/pm-lab/interior-cost-preview/` 절대 내부 링크 차단

### 3. writer/cleanup/recovery 오류 경로

추가 조치:

- Web Locks writer serialization
- fresh complete + fresh partial 상태에서 새 writer 차단
- write failure ownership cleanup
- navigation 중단 후 recovery UI
- recovery cancel expected snapshot 재검증
- production compare Apply/Cancel cleanup shared lock
- 기본 compare cleanup은 partial blocker + ownership rule로 parity 확보

## 비호스팅 회귀

- writer VM: 8 / 8 PASS
- partial/cleanup-window: 11 / 11 PASS
- writer↔production compare lock interleaving: 9 / 9 PASS
- basic compare cleanup parity: 6 / 6 PASS

## hosted self-check

`production-shell/self-check.html`: **44개**

검사 범위:

- snapshot metadata / 4 blob hash
- wrapper rewrite / script order
- storage/navigation guards
- storage-before-DOM atomic compare commit
- writer Web Locks / lock name / pending blocker / ownership cleanup / fail-closed
- complete/partial pending detection
- recovery panel/cancel
- production compare cleanup shared lock

외부 HTTPS preview 전이므로 아직 44/44 PASS로 기록하지 않습니다.

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

## 실행 환경 제한

현재 환경에서는 actual hosted wrapper 실행을 대체할 수 없습니다. 최종 판정은 외부 HTTPS preview에서 진행합니다.

현재 hosted 자동검사 준비 합계: **68개**

- self-check 44
- failure 8
- writer concurrency 7
- pending recovery 9

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
