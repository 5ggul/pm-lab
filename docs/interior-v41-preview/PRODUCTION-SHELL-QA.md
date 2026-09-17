# Interior v41 production-shell QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

현재 main 동일성 확인 경계: `84d330a2893abcf2a6c6841ab6e871c55954ac83` (2026-09-17)

초기 production-shell 캡처 기준: `26b8f66b14316743e3bfaff73912a5b15901c48c`

초기 캡처 이후 main의 추가 변경은 프랜차이즈/데이터 봇 산출물이었고 인테리어 quote-check/quote-compare HTML/CSS/JS blob은 `84d330a...`까지 동일합니다.

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

## quote-check writer serialization

파일: `assets/quote-check-handoff-v41.js`

- Web Locks exclusive lock `interior-v41-handoff-write-v41`
- fresh pending source/handoff pair가 있으면 두 번째 전송을 덮어쓰지 않고 차단
- 같은 탭/다른 탭 예외 없음
- write 후 persisted source/handoff exact snapshot 재검증
- 실패 cleanup은 `clearOwnedTransfer(source,handoff)`로 자기 snapshot만 삭제
- production-shell에서 Web Locks 미지원 시 fail-closed
- confirm 버튼 async 처리 중 disabled

writer VM 회귀: **8 / 8 PASS**

hosted `writer-concurrency-probe.html`: **7개 검사 준비**, 외부 HTTPS 전이라 아직 실행 전

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

storage-first Apply와 navigation guard, Web Locks writer는 hosted probes에서 최종 판정합니다. 현재 컨테이너 Chromium은 DBus/관리자 정책 단계에서 hosted wrapper를 대신 실행할 수 없습니다.

## hosted self-check

`production-shell/self-check.html`: **38개 항목 준비**

추가 writer 확인:

- writer concurrency probe manifest entrypoint
- Web Locks exclusive serialization marker
- 고정 lock name
- fresh pending blocker
- ownership-aware writer cleanup
- production-shell Web Locks 미지원 fail-closed

외부 HTTPS preview가 아직 없으므로 `38/38 PASS`로 기록하지 않습니다.

## hosted failure probe

`production-shell/failure-probe.html`: **8개 항목 준비**

- 사이트 검색 이탈 차단
- workflow 밖 운영 내부링크 이탈 차단
- handoff preview 생성
- review localStorage 강제 실패 시 B DOM 미변경
- 실패 후 source/handoff 유지
- 실패 상태 안내
- 운영 이름 저장키 3개 불변

## hosted writer concurrency probe

`production-shell/writer-concurrency-probe.html`: **7개 항목 준비**

- two same-origin iframe에서 handoff API 로드
- 정확히 한 writer 성공 / 한 writer 차단
- persisted source/handoff 일치
- persisted pair가 승자 writer 소유
- 운영 이름 저장키 3개 불변

probe 종료 시 review transfer key는 실행 전 값으로 복원합니다.

## storage inspector

`production-shell/storage-inspector.html`

- 운영 이름 키 3개 읽기 전용
- 존재 여부 / 길이 / SHA-256 표시
- sessionStorage 기준점 기록 후 전/후 비교
- review-only 키만 삭제 가능

## 아직 남은 실호스팅 검수

1. self-check 38 / 38
2. failure-probe 8 / 8
3. writer concurrency probe 7 / 7
4. storage 기준점 기록
5. 실제 quote-check → quote-compare navigation
6. real-origin localStorage 지속성
7. refresh / 재접속 복원
8. A → B → C 연속 handoff
9. 실제 두 탭 storage event
10. 모바일 실제 touch / horizontal scroll
11. 운영 이름 storage SHA 기준점 불변

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- production quote/compare 저장키 변경 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
