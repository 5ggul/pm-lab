# Interior v41 production-shell QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

검수 기준 main HEAD: `26b8f66b14316743e3bfaff73912a5b15901c48c` (2026-09-17)

## 현재 main 재대조

현재 main은 v41 review branch보다 145 commits 앞서 있지만, 견적 도구의 공개 스키마는 변경되지 않았습니다.

- quote-check: 6개 context (`supply`, `exclusive`, `building`, `region`, `scope`, `bathrooms`)
- quote-check: 12개 공종 (`demolition`, `waste`, `waterproof`, `bathroom`, `kitchen`, `wallpaper`, `flooring`, `carpentry`, `electrical`, `window`, `management`, `vat`)
- 상태값: `included`, `separate`, `missing`
- 상세 필드: `amount`, `qty`, `unit`, `spec`, `memo`
- quote-compare 공개 입력: 업체 A/B/C 각각 `state + amount`
- 현재 bundle: `app-v21-bundle.js` SHA `4a82f3be0d598d9593f6eff21259f98e32ff231d`
- `app-v22` 없음
- main에는 `docs/interior-v41-preview/` 경로 없음

최근 인테리어 관련 main 변경은 공식자료 source-watch 기간 JSON 갱신이며 quote-check/quote-compare DOM 스키마 변경은 확인되지 않았습니다.

## production-shell adapter

파일:

`assets/quote-compare-production-adapter-v41.js`

목적:

- 실제 main quote-compare의 `[data-compare-row]`, `[data-vendor]`, `[data-state]`, `[data-amount]` 구조에 v41 handoff가 들어갈 수 있는지 검증
- 기존 운영 저장키를 변경하지 않고 production-shell 동작을 확인

동작:

1. quote-check handoff의 12개 `state`와 `amount`를 선택한 A/B/C 업체 칸의 현재 compare DOM으로 변환
2. 기존 다른 업체 칸의 값은 보존
3. `input` / `change` 이벤트를 발생시켜 기존 app-v21의 합계·조건차이·v6 chart 갱신 흐름을 그대로 타게 함
4. compare UI가 직접 표현하지 않는 6개 context와 `qty/unit/spec/memo`는 review metadata에 보존
5. reload 검증용 review-only key `interior-quote-compare-shell-v41` 사용
6. 운영 키 `interior-compare-v5`, `interior-compare-v6`는 사용하지 않음
7. production-shell 검수 중 운영 `비교 저장` / `초기화` 버튼은 capture 단계에서 차단해 운영 키 오염 방지
8. Apply 직전 persisted transfer를 다시 확인해 오래된 탭의 stale apply 차단
9. storage event가 다른 transfer를 감지하면 현재 preview 무효화

### 로드 순서 조건

실제 production-shell 프리뷰에 연결할 때 adapter는 `app-v21-bundle.js` **뒤에서 실행되어야 합니다**.

권장 순서:

1. 현재 quote-compare HTML 렌더링
2. `app-v21-bundle.js` 실행 및 기존 `interior-compare-v5/v6` 복원
3. `quote-compare-production-adapter-v41.js` 실행
4. review-only `interior-quote-compare-shell-v41` 상태를 마지막으로 DOM에 반영

두 스크립트를 `defer`로 넣는 경우 문서 순서상 app-v21 다음에 adapter를 배치합니다. adapter가 먼저 실행되면 app-v21의 기존 compare 복원 로직이 뒤에서 review DOM 값을 다시 덮을 수 있으므로 해당 구성은 검수 대상이 아닙니다.

## quote-check production storage guard

production-shell quote-check는 현재 main의 `app-v21-bundle.js`를 그대로 실행하기 때문에 원본 `브라우저에 저장` / `초기화` 버튼이 그대로 동작하면 preview origin의 `interior-quote-v5`를 변경할 수 있었습니다. 실제 운영 origin과는 분리되어 있지만, 검수 전용 저장키 격리 원칙과 sentinel 회귀 검증을 흐릴 수 있어 차단했습니다.

조치:

- `quote-check-handoff-v41.js`에서 production-shell 경로만 감지
- `[data-save-quote]`, `[data-reset-quote]`를 capture 단계에서 차단
- `interior-quote-v5`는 변경하지 않음
- CSV 저장 / 결과 복사 / 인쇄는 그대로 사용 가능
- 차단 시 `role=status` 문구로 검수 전용 화면임을 표시

## production-shell relative path 검증

wrapper는 절대 `/pm-lab/...` 경로에 의존하지 않습니다.

검증한 배치 예:

1. `https://preview.example.com/docs/interior-v41-preview/production-shell/quote-check/`
2. `https://preview.example.com/interior-v41-preview/production-shell/quote-check/`
3. `https://preview.example.com/production-shell/quote-check/`

각 배치에서 다음 상대경로는 동일 디렉터리 구조를 유지하는 한 정상 해석됩니다.

- `../snapshots/quote-check-main.html`
- `../snapshot-assets/site-v21-bundle.css`
- `../../assets/quote-check-handoff-v41.js`
- `../quote-compare/`

## Chromium production-shell 회귀

현재 main과 같은 compare selector/event 구조를 실제 Chromium DOM으로 구성하고 adapter를 실행했습니다.

결과: **26 / 26 PASS**

확인 항목:

1. B 업체 handoff preview 주입
2. B target 문구 표시
3. B `demolition` 상태 적용
4. B `demolition` 금액 적용
5. 기존 A 값 보존
6. 기존 C 값 보존
7. 12개 B 금액 합계 재계산
8. production `input/change` 이벤트 발생
9. review flat state 저장
10. review A 상태 보존
11. review C 상태 보존
12. 6개 context metadata 보존
13. `spec` 등 상세 metadata 보존
14. Apply 후 source cleanup
15. Apply 후 handoff cleanup
16. `interior-compare-v5` sentinel 미변경
17. `interior-compare-v6` sentinel 미변경
18. 운영 저장/초기화 버튼 차단
19. 차단 상태 메시지 표시
20. Chromium page error 없음
21. reload equivalent에서 B 복원
22. reload equivalent에서 A 복원
23. reload equivalent에서 C 복원
24. reload equivalent에서 합계 재계산
25. 오래된 탭 Apply 차단
26. 다른 탭의 새 transfer 보존

Adapter Node syntax check: PASS

## hosted self-check

`production-shell/self-check.html`은 외부 HTTPS preview가 생기면 브라우저에서 아래 **22개 항목**을 자동 확인하도록 확장했습니다.

- main commit manifest 일치
- pinned snapshot 4개 Git blob SHA 일치
- quote-check 12공종 / 6 context / report marker
- quote-compare 12공종 / save marker
- CSS/app-v21 local rewrite
- handoff/adapter injection
- app-v21 → adapter load order
- quote-check/quote-compare wrapper pinned snapshot fetch path
- quote-check 운영 저장/초기화 guard 존재
- handoff 상대 `../quote-compare/` 이동
- quote-compare 운영 저장/초기화 guard 존재

이 self-check는 실제 HTTPS origin에서 실행해야 하므로 현재는 코드 구성만 검수했으며 `22/22 PASS`라고 아직 주장하지 않습니다.

## 확인된 구조적 제한

현재 quote-compare UI 자체는 `state + amount`만 직접 표현합니다. 따라서 quote-check의 아래 정보는 handoff 시 잃지 않도록 별도 metadata로 보존하지만 현재 표에서 직접 보이지 않습니다.

- 공급평수 / 전용평수 / 건물유형 / 지역 / 공사범위 / 욕실 수
- 수량 / 단위 / 사양 / 메모

운영 통합 전에 결정해야 할 사항:

- 비교 화면에 업체별 기본조건 요약을 노출할지
- 공종별 상세정보를 펼침/상세 패널로 보여줄지
- 또는 현재처럼 비교 핵심은 상태+금액만 유지하고 상세정보는 내부 metadata로만 보존할지

v41에서는 제품 결정을 임의로 확정하지 않고 데이터 손실만 막는 방향으로 metadata를 보존합니다.

## 아직 남은 실호스팅 검수

외부 비운영 URL에서만 최종 확인 가능한 항목:

1. self-check 22개 실제 실행
2. 실제 quote-check → quote-compare URL navigation
3. 실제 origin localStorage 지속성
4. 브라우저 refresh / 재접속 복원
5. A → B → C 연속 handoff
6. 실제 두 탭 storage event
7. 모바일 실제 touch / horizontal scroll

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- production quote/compare 저장키 변경 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
