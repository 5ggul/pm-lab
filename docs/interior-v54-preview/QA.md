# v54 QA contract

## Integration

- `quote-review-report/index.html`에서 v52 → v53 → v54 순서로 실제 스크립트를 직접 로드한다.
- `InteriorQuoteReview52`, `InteriorQuoteReview53`, `InteriorQuoteReview54`가 실제 HTML 로드 후 사용 가능해야 한다.
- v54가 v52 전체 복원 버튼과 v53 선택 복원 버튼을 안전 체크포인트 경로로 감싼다.

## Full restore undo

- 전체 복원 직전에 7개 허용 저장 영역의 raw 값을 `interior-review-restore-checkpoint-v54`에 저장한다.
- 체크포인트 mode는 `full`, keys는 7개 전체여야 한다.
- 전체 복원 후 unrelated localStorage는 그대로 유지되어야 한다.
- `복원 전 상태로 되돌리기` 실행 후 7개 저장 영역이 복원 직전 byte 값으로 돌아와야 한다.
- 성공한 되돌리기 뒤 체크포인트는 삭제되어야 한다.

## Selective restore undo

- 선택 복원 직전에는 실제 선택한 key만 체크포인트에 저장한다.
- 체크포인트 mode는 `selective`여야 한다.
- 선택 복원 후 다른 tracked key를 사용자가 수정한 뒤 되돌려도, 선택 복원 대상이 아니었던 key의 후속 수정은 유지되어야 한다.
- 되돌리기는 선택 복원했던 key만 복원 직전 값으로 되돌려야 한다.

## Failure safety

- 이미 유효한 기존 체크포인트가 있는 상태에서 새 복원이 실패하면, 실패한 복원 때문에 기존 체크포인트가 교체되면 안 된다.
- 강제 write failure 시 tracked storage와 unrelated localStorage가 시작 전 값으로 유지되는지 확인한다.
- 사용자 화면에는 내부 예외 문자열을 그대로 노출하지 않고 안전한 복원 실패 문구를 표시한다.

## UI / responsive

- 체크포인트가 없을 때 안내 상태를 표시한다.
- 체크포인트가 있으면 전체/선택 구분, 저장 시각, 대상 영역 수와 이름을 표시한다.
- `복원 전 상태로 되돌리기`, `되돌리기 기록 삭제`를 제공한다.
- 모바일 390×844에서 document-level horizontal overflow가 없어야 한다.
- print media에서는 v54 조작 UI를 숨긴다.
- console/runtime error가 없어야 한다.

## Non-production guard

- `main` 및 운영 배포를 변경하지 않는다.
- 사용자 명시 승인 전까지 Draft PR 상태를 유지한다.
