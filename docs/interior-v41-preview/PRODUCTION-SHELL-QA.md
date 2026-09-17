# Interior v41 production-shell QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

현재 main HEAD: `50821ea293e17f709d28164f6873b3c19e279bef` (2026-09-17)

초기 production-shell 캡처 기준: `26b8f66b14316743e3bfaff73912a5b15901c48c`

`26b8f66..50821ea` 사이의 변경은 프랜차이즈 contract JSON 1개뿐이며 인테리어 quote-check/quote-compare HTML/CSS/JS blob은 현재 main에서도 동일합니다.

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

동작:

1. handoff의 12개 `state + amount`를 선택한 A/B/C 업체 칸으로 변환
2. 기존 다른 업체 칸 보존
3. `input/change` 이벤트로 app-v21 합계·조건차이·chart 흐름 사용
4. 6 context와 `qty/unit/spec/memo`는 review metadata에 보존
5. review-only key `interior-quote-compare-shell-v41` 사용
6. 운영 `interior-compare-v5/v6` 사용하지 않음
7. 운영 `비교 저장` / `초기화` capture 차단
8. Apply 직전 persisted transfer 재검증
9. storage event로 stale preview 무효화
10. `hasTargetFields()`로 target의 12개 `state + amount` 필드 선검증
11. `commitReview()`가 review-only 저장 성공을 먼저 확인한 뒤 visible DOM 변경
12. review 저장 실패 시 visible DOM 미변경, source/handoff와 preview 유지
13. autosave 실패도 status 경고 표시

### script 순서

- quote-check: `app-v21 → production-shell-guard-v41 → quote-check-handoff-v41`
- quote-compare: `app-v21 → production-shell-guard-v41 → quote-compare-production-adapter-v41`

## quote-check production storage guard

production-shell quote-check에서 원본 app-v21의 `[data-save-quote]`, `[data-reset-quote]`를 capture 단계에서 차단합니다.

- `interior-quote-v5` 미변경
- CSV / 결과 복사 / 인쇄 유지
- 차단 상태는 `role=status`로 표시

## production-shell navigation guard

파일: `assets/production-shell-guard-v41.js`

- `[data-site-search]` submit capture 차단
- wrapper가 상대경로로 바꾼 quote-check / quote-compare workflow 링크 허용
- 남아 있는 `/pm-lab/interior-cost-preview/` 절대 내부 링크는 capture 단계에서 차단
- 외부 preview base path의 404/검수 이탈 방지

## relative path 검증

다음 배치에서도 동일 디렉터리 구조를 유지하면 상대경로가 정상 해석됩니다.

1. `/docs/interior-v41-preview/production-shell/quote-check/`
2. `/interior-v41-preview/production-shell/quote-check/`
3. `/production-shell/quote-check/`

핵심 상대경로:

- `../snapshots/quote-check-main.html`
- `../snapshot-assets/site-v21-bundle.css`
- `../../assets/production-shell-guard-v41.js`
- `../../assets/quote-check-handoff-v41.js`
- `../../assets/quote-compare-production-adapter-v41.js`
- `../quote-compare/`

## 기존 Chromium production-shell 회귀

current-main selector/event 구조 기반 검수: **26 / 26 PASS**

- B handoff preview / state / amount 적용
- 기존 A/C 보존
- 12개 B 합계 재계산
- production input/change 이벤트
- review state + context/detail metadata 보존
- Apply cleanup
- `interior-compare-v5/v6` sentinel 미변경
- 운영 저장/초기화 버튼 차단
- reload-equivalent A/B/C 복원
- stale-tab Apply 차단
- 새 transfer 보존
- page error 없음

이번 단계에서 추가한 storage-first Apply와 navigation guard는 hosted probe에서 최종 판정합니다. 현재 컨테이너 Chromium은 DBus/관리자 정책 단계에서 DOM output 없이 멈춰 실제 wrapper 실행 대체 검증은 불가능했습니다.

## hosted self-check

`production-shell/self-check.html`: **31개 항목**

- current main manifest
- pinned snapshot 4개 Git blob SHA
- quote-check 12공종 / 6 context / report marker
- quote-compare 12공종 / save marker
- local CSS/app-v21 rewrite
- shell guard + handoff/adapter injection
- app-v21 → guard → handoff/adapter 순서
- wrapper pinned snapshot 경로
- quote-check 운영 저장/초기화 guard
- relative compare navigation
- compare 운영 저장/초기화 guard
- atomic `commitReview` / `hasTargetFields`
- review 저장이 visible DOM 변경보다 먼저 수행되는 코드 순서
- 사이트 검색 / workflow 밖 내부링크 차단

외부 HTTPS preview가 아직 없으므로 `31/31 PASS`로 기록하지 않습니다.

## hosted failure probe

`production-shell/failure-probe.html`: **8개 항목**

1. 사이트 검색 이탈 차단
2. workflow 밖 운영 내부링크 이탈 차단
3. handoff preview 생성
4. review localStorage 강제 실패 시 B DOM 미변경
5. 실패 후 source 유지
6. 실패 후 handoff 유지
7. 실패 상태 안내
8. 운영 이름 저장키 3개 불변

probe는 review key 원값을 메모리에 보관하고 종료 시 원상복구합니다. 운영 이름 키는 읽기/비교만 합니다.

## storage inspector

`production-shell/storage-inspector.html`

- 운영 이름 키 3개 읽기 전용
- 존재 여부 / 길이 / SHA-256 표시
- sessionStorage 기준점 기록 후 전/후 비교
- review-only 키만 삭제 가능

운영 이름 키:

- `interior-quote-v5`
- `interior-compare-v5`
- `interior-compare-v6`

## 아직 남은 실호스팅 검수

1. self-check 31 / 31
2. failure-probe 8 / 8
3. storage 기준점 기록
4. 실제 quote-check → quote-compare navigation
5. real-origin localStorage 지속성
6. refresh / 재접속 복원
7. A → B → C 연속 handoff
8. 실제 두 탭 storage event
9. 모바일 실제 touch / horizontal scroll
10. 운영 이름 storage SHA 기준점 불변

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- production quote/compare 저장키 변경 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
