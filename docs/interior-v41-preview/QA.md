# Interior v41 handoff QA

검수 대상: `interior-v40-preview` / Draft PR #201

## 이번 수정

- `quote-check`에서 선택한 A/B/C 업체 칸으로 넘긴 견적을 `quote-compare`에서 자동 적용하지 않고 미리보기 후 적용/취소합니다.
- 적용된 비교 상태를 검수 전용 키 `interior-quote-compare-state-v41`에 저장해 새로고침 후에도 유지합니다.
- 다른 업체 칸에 새 견적을 적용해도 기존 업체 칸은 보존합니다.
- 취소 시 handoff 플래그만 지우고 기존 비교표와 원본 견적 저장값은 유지합니다.
- 30분이 지난 stale handoff는 자동 제거합니다.
- 검수 저장 초기화는 비교표 검수 전용 상태만 삭제하고 원본 견적 키 `interior-quote-v5`는 유지합니다.
- URL에는 견적 payload를 넣지 않습니다.
- 페이지는 `noindex,nofollow,noarchive,nosnippet`을 유지합니다.

## 자동 검증 결과

- `quote-check-handoff-v41.js` Node 문법 검사: PASS
- `quote-compare/index.html` 내부 JS Node 문법 검사: PASS
- VM 로직 검증: 13 / 13 PASS
  - fresh handoff 미리보기 표시
  - B 업체 target 표시
  - B 업체 적용 저장
  - 적용 후 handoff 제거
  - 적용 완료 상태 표시
  - 재실행 시 저장 비교표 복원
  - 취소 시 기존 B 상태 보존
  - 취소 시 C 미적용
  - 취소 후 handoff 제거
  - stale handoff 제거
  - stale 상태 메시지 표시
  - 비교 검수 상태 초기화
  - 원본 견적 상태 유지

## 남은 실브라우저 검수

현재 실행 환경에서는 localhost 및 임의 로컬 origin 접근이 `ERR_BLOCKED_BY_ADMINISTRATOR`로 차단되어 실제 Chromium 클릭 자동화는 완료하지 못했습니다.

새 외부 프리뷰 호스팅 프로젝트는 만들지 않았습니다. 기존 원칙대로 명시적 승인 후에만 외부 프리뷰를 만들고 아래 순서를 실제 URL에서 다시 검증합니다.

1. 견적 입력
2. A / B / C 대상 선택
3. 비교표 이동
4. 미리보기 확인
5. 적용 / 취소
6. 새로고침
7. 재접속 후 저장 상태 확인
8. 모바일 폭 및 터치 동작 확인

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
