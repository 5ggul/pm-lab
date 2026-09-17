# Interior v41 production-shell failure-path QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## 이번 단계에서 확인한 결함

### 1. review compare 저장 실패 시 DOM만 먼저 바뀔 수 있었음

기존 production-shell adapter는 Apply 시 다음 순서였습니다.

1. 현재 DOM + incoming quote를 review 상태에 합침
2. incoming 값을 compare DOM에 반영
3. `interior-quote-compare-shell-v41`에 저장

따라서 localStorage quota/권한 문제로 3번이 실패하면 화면은 적용된 것처럼 보이지만 새로고침 후 사라질 수 있었습니다.

조치:

- 선택 대상 A/B/C의 12개 `state + amount` DOM 필드가 모두 존재하는지 `hasTargetFields()`로 선검증
- `commitReview()`가 review-only 저장키 기록을 먼저 완료
- 저장 성공 후에만 compare DOM을 변경
- 저장 실패 시 source/handoff와 preview를 유지해 재시도 가능
- status에 `적용하지 않았습니다` 오류를 명시
- 수동 compare 편집 autosave 실패도 status 경고 표시

즉 Apply는 review 저장 성공 전에는 화면을 적용 상태로 바꾸지 않습니다.

### 2. production-shell에서 사이트 검색/다른 내부 메뉴로 이탈할 수 있었음

main snapshot의 header/search는 원본 `/pm-lab/interior-cost-preview/...` 동작을 유지합니다. 외부 preview base path가 다를 경우 검색 또는 quote workflow 밖의 메뉴를 누르면 404 또는 검수 범위 이탈이 생길 수 있었습니다.

조치:

- `assets/production-shell-guard-v41.js` 추가
- `[data-site-search]` submit을 capture 단계에서 차단
- quote-check/quote-compare wrapper가 상대경로로 바꾼 workflow 링크는 허용
- 그 외 `/pm-lab/interior-cost-preview/` 절대 내부 링크는 capture 단계에서 차단
- 차단 시 사용자에게 production-shell 범위 밖 이동이라는 상태 메시지 표시

wrapper script 순서:

- quote-check: `app-v21 → production-shell-guard → quote-check-handoff`
- quote-compare: `app-v21 → production-shell-guard → production adapter`

## hosted self-check 확장

`production-shell/self-check.html`은 현재 **44개 항목**을 검사합니다.

확인 범위:

- snapshot 캡처 commit과 verified-through commit 메타데이터
- quote-check/compare wrapper shell guard marker
- app-v21 → guard → handoff/adapter 순서
- quote-check 운영 저장/초기화 guard
- quote-compare 운영 저장/초기화 guard
- compare atomic commit helper (`commitReview`, `hasTargetFields`)
- 저장 실패 시 DOM 변경보다 review 저장이 먼저 수행되는 코드 순서
- 검색 submit capture guard
- workflow 밖 production-prefix 링크 guard
- writer Web Locks / 고정 lock / pair·partial blocker
- pending recovery panel / cancel helper
- quote-compare shared cleanup lock / exclusive cleanup helper

외부 HTTPS preview가 아직 없으므로 이 44개 self-check의 실행 결과는 아직 기록하지 않습니다.

## hosted failure probe

`production-shell/failure-probe.html`

외부 preview에서 다음 8개를 실제 브라우저로 강제 재현합니다.

1. 사이트 검색 이탈 차단
2. workflow 밖 운영 내부링크 이탈 차단
3. handoff preview 생성
4. review-only localStorage 쓰기를 강제로 실패시켰을 때 B DOM 미변경
5. 저장 실패 후 source 유지
6. 저장 실패 후 handoff 유지
7. 저장 실패 상태 안내
8. 운영 이름 저장키 `interior-quote-v5`, `interior-compare-v5`, `interior-compare-v6` 불변

probe는 시작 전 review key 원값을 메모리에 보관하고 종료 시 원상복구합니다. 운영 이름 저장키는 읽기/비교만 하며 쓰지 않습니다.

## 실행 환경 제한

현재 컨테이너 Chromium은 DBus/관리자 정책 단계에서 DOM output 없이 멈춰 hosted wrapper를 대신 실행할 수 없었습니다. 따라서 아래 항목은 외부 HTTPS preview에서만 최종 판정합니다.

- self-check 44 / 44
- failure-probe 8 / 8
- writer-concurrency-probe 7 / 7
- pending-recovery-probe 9 / 9
- real-origin localStorage refresh/revisit
- 실제 두 탭 storage event
- 모바일 실제 touch/scroll

Hosted 자동검사 준비 합계: **68개**.

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
