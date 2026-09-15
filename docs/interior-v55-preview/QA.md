# Interior v55 QA contract

최신 v55 HEAD에서 아래 항목을 실제 Chromium으로 검증한다.

## 통합

- `quote-review-restore-conflict-v55.js`가 실제 `quote-review-report/index.html`에서 자동 로드된다.
- `InteriorQuoteReview52`, `53`, `54`, `55` API가 모두 존재한다.
- v52 전체 복원 버튼과 v53 선택 복원 버튼이 v55 최종 handler로 래핑된다.
- v55는 자체 localStorage 키를 만들지 않는다.

## 전체 복원 충돌

1. 백업 파일을 선택한다.
2. 미리보기 뒤 `interior-quote-v5`를 수정한다.
3. 전체 복원을 누른다.
4. confirm 창 전에 충돌이 감지되어 복원과 v54 체크포인트 생성이 모두 중단된다.
5. 변경된 현재값은 그대로 남는다.
6. `현재값으로 비교 다시 시작` 후에는 정상 복원이 가능하다.
7. 정상 복원 뒤 v54 체크포인트에는 재비교 시점의 복원 전 값이 들어간다.
8. v54 되돌리기로 복원 전 값이 정확히 복구된다.

## 선택 복원 범위

- 선택된 영역이 미리보기 뒤 바뀌면 복원을 차단한다.
- 재비교 후 선택되지 않은 tracked 영역만 바뀐 경우 선택 복원은 허용한다.
- 선택되지 않은 영역의 후속 변경은 byte-for-byte 유지한다.
- v54 선택 복원 체크포인트에는 선택된 영역만 들어간다.
- 되돌리기도 선택된 영역만 되돌린다.

## confirm 경계 race

- 1차 preflight가 통과한 뒤 confirm 경계에서 tracked 값을 변경하는 결정적 테스트를 수행한다.
- native modal이 다른 CDP 탭 호출까지 막는 브라우저 특성 때문에, 테스트에서는 `window.confirm`을 제어해 **1차 preflight 이후 / 2차 preflight 이전**과 정확히 같은 타이밍에 localStorage를 변경한다.
- confirm 승인 직후 2차 preflight가 해당 변경을 감지한다.
- 실제 복원과 v54 체크포인트 생성은 모두 중단된다.

## 실패 안전성

- v54의 기존 체크포인트가 있는 상태에서 선택 복원 쓰기 실패를 강제로 발생시킨다.
- tracked 값 전체가 복원 시도 전 상태를 유지한다.
- 기존 v54 체크포인트가 유지된다.
- 내부 예외 문자열은 사용자 메시지에 노출하지 않는다.

## 모바일 / 인쇄

- 390×844에서 document-level horizontal overflow 없음.
- v55 상태 카드가 보인다.
- print media에서는 v55 조작 UI가 숨겨진다.
- browser console/runtime error 없음.

## 운영 보호

- `main` / 운영 배포 없음.
- production-surface 보호 검사를 최신 HEAD에서 통과해야 한다.
