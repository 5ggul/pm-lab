# Interior v48 QA 계약

최종 HEAD에서 다음 항목을 실제 Chromium으로 검수한다.

- 완료 + 답변 메모가 있는 질문만 계약서 반영 후보로 생성
- A/B/C 다중 업체 후보 생성
- `서면 반영 확인` 체크 저장
- 계약서/견적서 위치·문구 메모 저장
- 새로고침 후 체크/메모 복원
- 전체 및 업체별 반영 진행률
- 반영 완료 항목은 `미반영 항목만 복사`에서 제외
- 전체 반영 확인본 생성
- `interior-contract-reflection-v48` 외 기존 quote/compare/progress 키 불변
- 반영 기록 초기화 시 v48 키만 삭제
- 390px 모바일 document-level horizontal overflow 없음
- print media에서 반영판은 보이고 액션 버튼은 숨김
- 완료 답변 메모가 없는 상태 안내
- console/page runtime error 없음

가격 적정성, 업체 추천, 법률 효과, 계약 유효성에 대한 자동 판정을 생성하지 않는다.
