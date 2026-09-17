# Interior v41 production-shell QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

현재 main HEAD: `50821ea293e17f709d28164f6873b3c19e279bef` (2026-09-17)

초기 production-shell 캡처 기준: `26b8f66b14316743e3bfaff73912a5b15901c48c`

`26b8f66..50821ea` 사이의 변경은 프랜차이즈 contract JSON 1개뿐이며 인테리어 quote-check/quote-compare HTML/CSS/JS blob은 현재 main에서도 동일합니다.

## 현재 main 재대조

견적 도구의 공개 스키마는 변경되지 않았습니다.

- quote-check: 6개 context (`supply`, `exclusive`, `building`, `region`, `scope`, `bathrooms`)
- quote-check: 12개 공종 (`demolition`, `waste`, `waterproof`, `bathroom`, `kitchen`, `wallpaper`, `flooring`, `carpentry`, `electrical`, `window`, `management`, `vat`)
- 상태값: `included`, `separate`, `missing`
- 상세 필드: `amount`, `qty`, `unit`, `spec`, `memo`
- quote-compare 공개 입력: 업체 A/B/C 각각 `state + amount`
- 현재 bundle: `app-v21-bundle.js` SHA `4a82f3be0d598d9593f6eff21259f98e32ff231d`
- `app-v22` 없음
- main에는 `docs/interior-v41-preview/` 경로 없음

## production-shell adapter

파일: `assets/quote-compare-production-adapter-v41.js`

동작:

1. quote-check handoff의 12개 `state`와 `amount`를 선택한 A/B/C 업체 칸의 현재 compare DOM으로 변환
2. 기존 다른 업체 칸의 값은 보존
3. `input` / `change` 이벤트를 발생시켜 기존 app-v21의 합계·조건차이·v6 chart 갱신 흐름 사용
4. compare UI가 직접 표현하지 않는 6개 context와 `qty/unit/spec/memo`는 review metadata에 보존
5. reload 검증용 review-only key `interior-quote-compare-shell-v41` 사용
6. 운영 키 `interior-compare-v5`, `interior-compare-v6`는 사용하지 않음
7. production-shell 검수 중 운영 `비교 저장` / `초기화` 버튼은 capture 단계에서 차단
8. Apply 직전 persisted transfer 재검증
9. storage event가 다른 transfer를 감지하면 현재 preview 무효화

### 로드 순서 조건

adapter는 `app-v21-bundle.js` 뒤에서 실행되어야 합니다.

1. quote-compare HTML 렌더링
2. `app-v21-bundle.js` 실행 및 기존 v5/v6 복원
3. `quote-compare-production-adapter-v41.js` 실행
4. review-only 상태를 마지막으로 DOM에 반영

## quote-check production storage guard

production-shell quote-check는 현재 main의 app-v21을 그대로 실행하므로 원본 `브라우저에 저장` / `초기화` 버튼이 preview origin의 `interior-quote-v5`를 변경할 수 있었습니다.

조치:

- production-shell 경로에서 `[data-save-quote]`, `[data-reset-quote]` capture 차단
- `interior-quote-v5` 미변경
- CSV 저장 / 결과 복사 / 인쇄는 유지
- 차단 상태는 `role=status` 문구로 표시

## production-shell relative path 검증

wrapper는 절대 `/pm-lab/...` 경로에 의존하지 않습니다.

검증 배치 예:

1. `/docs/interior-v41-preview/production-shell/quote-check/`
2. `/interior-v41-preview/production-shell/quote-check/`
3. `/production-shell/quote-check/`

다음 상대경로는 동일 디렉터리 구조를 유지하는 한 정상 해석됩니다.

- `../snapshots/quote-check-main.html`
- `../snapshot-assets/site-v21-bundle.css`
- `../../assets/quote-check-handoff-v41.js`
- `../quote-compare/`

## Chromium production-shell 회귀

현재 main과 같은 compare selector/event 구조를 실제 Chromium DOM으로 구성하고 adapter를 실행했습니다.

결과: **26 / 26 PASS**

- B 업체 handoff preview / state / amount 적용
- 기존 A/C 보존
- 12개 B 금액 합계 재계산
- production input/change 이벤트 발생
- review flat state와 6 context / 상세 metadata 보존
- Apply 후 source/handoff cleanup
- `interior-compare-v5/v6` sentinel 미변경
- 운영 저장/초기화 버튼 차단
- reload-equivalent A/B/C 복원 및 합계 재계산
- 오래된 탭 Apply 차단
- 다른 탭 새 transfer 보존
- Chromium page error 없음

Adapter Node syntax check: PASS

## hosted self-check

`production-shell/self-check.html`은 외부 HTTPS preview에서 **22개 항목**을 자동 확인합니다.

- current main commit manifest
- pinned snapshot 4개 Git blob SHA
- quote-check 12공종 / 6 context / report marker
- quote-compare 12공종 / save marker
- CSS/app-v21 local rewrite
- handoff/adapter injection
- app-v21 → adapter load order
- wrapper pinned snapshot fetch path
- quote-check 운영 저장/초기화 guard
- handoff 상대 `../quote-compare/` 이동
- quote-compare 운영 저장/초기화 guard

실제 HTTPS origin에서 실행 전이므로 아직 `22/22 PASS`라고 주장하지 않습니다.

## storage inspector

`production-shell/storage-inspector.html`을 추가했습니다.

- 운영 이름 키 3개는 읽기만 함
- 존재 여부 / 길이 / SHA-256만 표시
- sessionStorage에 기준점 저장 후 흐름 완료 뒤 비교 가능
- review-only 키만 별도 버튼으로 삭제 가능
- 운영 이름 키는 inspector가 쓰거나 지우지 않음

운영 이름 키:

- `interior-quote-v5`
- `interior-compare-v5`
- `interior-compare-v6`

## 아직 남은 실호스팅 검수

1. self-check 22개 실제 실행
2. storage 기준점 기록
3. 실제 quote-check → quote-compare URL navigation
4. 실제 origin localStorage 지속성
5. browser refresh / 재접속 복원
6. A → B → C 연속 handoff
7. 실제 두 탭 storage event
8. 모바일 실제 touch / horizontal scroll
9. 흐름 종료 후 운영 이름 키 SHA 기준점 불변 확인

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- production quote/compare 저장키 변경 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
