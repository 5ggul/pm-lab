# Interior v53 QA contract

## Functional

- 실제 `quote-review-report/index.html`에서 v52/v53 자동 로드
- 유효한 v52 백업 JSON 선택 시 7개 저장 영역 차이 표시
- 상태 분류: same / different / backup-only / current-only / empty
- 실제 차이가 있는 영역만 기본 체크
- 선택한 키만 백업 값으로 복원
- 백업 값이 `null`이면 선택한 키 삭제
- 선택하지 않은 허용 키는 변경 금지
- 허용되지 않은 backup key는 거부
- 선택 복원 중 쓰기 실패 시 선택한 키 전부 롤백
- unrelated localStorage 변경 금지

## UX

- 파일 비교 전 현재 저장값 무변경
- 7개 항목 표시
- 달라진 항목 선택 / 전체 선택 / 선택 해제
- 선택 항목 0개면 적용 버튼 비활성화
- 적용 전 confirm
- desktop / 390x844 mobile
- document-level horizontal overflow 없음
- print media에서 v53 조작 UI 숨김

## Safety

- v52 백업 format/version/exact key set/value type 검증 재사용
- 2MB 파일 상한 재사용
- 서버 전송 없음
- `main` / production 변경 없음
