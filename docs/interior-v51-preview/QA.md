# Interior v51 QA contract

최종 HEAD에서 실제 Chromium으로 확인해야 하는 항목입니다.

- 실제 `quote-review-report/index.html`에서 v48/v49/v50/v51 API 자동 로드
- v51 상태판이 기존 도구 영역보다 먼저 표시
- 상태 카드 6개 고정
- `견적 없음 → 비교 없음 → 업체 답변 → 서면 반영 → 기준 저장 → 재검수 → 기준 갱신` 우선순위
- 기준 clean 상태에서 불필요한 다음 행동을 만들지 않음
- v51 `render()` 전후 추적 저장값 byte-for-byte 불변
- baseline 저장은 기존 v49 버튼 동작만 사용
- 변경 감지 후 v50 재검수 미완료를 우선 안내
- 재검수 완료 후 새 baseline 저장을 안내
- 390x844 모바일 document-level horizontal overflow 없음
- print media에서 상태판 노출
- 프리뷰 wrapper에서 견적/비교 `다음 확인` 링크가 wrapper 내부 경로를 사용
- 브라우저 console/runtime error 없음
- production surface check PASS

v51은 읽기 전용 상태 요약 계층이며 가격 적정성, 업체 우열, 계약 효력 또는 법률 판단을 하지 않습니다.
