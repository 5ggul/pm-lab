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

1. 실제 quote-check → quote-compare URL navigation
2. 실제 origin localStorage 지속성
3. 브라우저 refresh / 재접속 복원
4. A → B → C 연속 handoff
5. 실제 두 탭 storage event
6. 모바일 실제 touch / horizontal scroll

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- production compare 저장키 변경 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
