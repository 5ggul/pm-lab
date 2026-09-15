# Interior v41 handoff QA

검수 대상: `interior-v40-preview` / Draft PR #201

## 이번 수정

- `quote-check`에서 선택한 A/B/C 업체 칸으로 넘긴 견적을 `quote-compare`에서 자동 적용하지 않고 미리보기 후 적용/취소합니다.
- 적용된 비교 상태를 검수 전용 키 `interior-quote-compare-state-v41`에 저장해 새로고침 후에도 유지합니다.
- 원본 견적도 검수 전용 키 `interior-quote-source-v41`로 분리했습니다. 기존 `interior-quote-v5`를 더 이상 사용하지 않습니다.
- 다른 업체 칸에 새 견적을 적용해도 기존 업체 칸은 보존합니다.
- 취소 시 handoff 플래그만 지우고 기존 비교표와 검수용 원본 견적 저장값은 유지합니다.
- 30분이 지난 stale handoff는 자동 제거합니다.
- 12개 필수 공종 또는 상태값이 누락·손상된 원본 견적은 적용하지 않고 handoff만 제거합니다.
- 검수 저장 초기화는 비교표 검수 전용 상태만 삭제하고 검수용 원본 견적은 유지합니다.
- URL에는 견적 payload를 넣지 않습니다.
- 페이지는 `noindex,nofollow,noarchive,nosnippet`을 유지합니다.

## 추가 회귀에서 발견한 결함과 조치

### 1. 검수 하네스가 기존 원본 견적 키를 덮어쓸 수 있었음

기존 v41 handoff는 원본 견적에 `interior-quote-v5`를 사용하고 있었습니다. 같은 origin에서 실제 견적 확인 기능이 이 키를 사용하면 검수 하네스가 기존 저장값을 덮어쓸 수 있으므로 검수 격리가 불완전했습니다.

조치:

- 원본 견적 키를 `interior-quote-source-v41`로 변경
- 비교표 키 `interior-quote-compare-state-v41`와 함께 v41 검수 데이터 전체를 별도 namespace로 격리
- 테스트에서 `interior-quote-v5`, `interior-compare-v5`, `interior-compare-v6` sentinel 값이 변경되지 않는지 확인

### 2. fresh handoff + 누락/손상 quote가 반복해서 남을 수 있었음

handoff는 정상 시간이지만 quote JSON이 없거나 12개 공종 중 일부가 누락된 경우, 기존 로직은 handoff를 명시적으로 제거하지 않고 비교 페이지에 남길 수 있었습니다. 또한 불완전한 quote가 target 업체 칸에 적용될 여지가 있었습니다.

조치:

- 12개 공종 존재 여부 검증
- 상태값을 `included`, `separate`, `missing` 중 하나로 제한
- 불완전한 quote는 적용 금지
- 관련 handoff 즉시 제거
- 기존 A/B/C 저장 비교표는 보존

## 자동 검증 결과

- `quote-check-handoff-v41.js` Node 문법 검사: PASS
- `quote-compare/index.html` 내부 JS Node 문법 검사: PASS
- 기존 VM persistence 로직: 13 / 13 PASS
- 확장된 quote-check → quote-compare 통합 VM 회귀: 30 / 30 PASS

확장 회귀에서 확인한 항목:

1. 검수 전용 원본 견적 키 사용
2. 기존 `interior-quote-v5` 미변경
3. B 업체 handoff 생성
4. URL에 payload 없이 비교 경로로 이동
5. 12개 공종 전체 캡처
6. context 값 보존
7. amount / qty / unit / spec / memo 보존
8. fresh handoff 미리보기 표시
9. B target 표시
10. 정상 quote 스키마 허용
11. B 업체 적용 저장
12. 상세 필드까지 저장 보존
13. 적용 후 handoff 제거
14. 기존 `interior-compare-v5` 미변경
15. 기존 `interior-compare-v6` 미변경
16. 재실행 시 B 업체 저장 상태 복원
17. reload 상태 문구 확인
18. 손상 quote 거부
19. 손상 quote handoff 제거
20. 손상 quote가 C 칸을 덮어쓰지 않음
21. 손상 quote 상황에서도 기존 B 상태 보존
22. 불완전 handoff 상태 문구 확인
23. stale handoff 제거
24. stale handoff가 A 칸을 적용하지 않음
25. 취소 시 handoff 제거
26. 취소 시 검수용 원본 견적 보존
27. 취소 시 기존 B 비교 상태 보존
28. reset 시 검수 비교표만 삭제
29. reset 후 검수용 원본 견적 보존
30. reset 이후에도 기존 운영/기존 preview sentinel 저장값 미변경

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
9. 기존 사이트 localStorage 값이 실제 브라우저에서도 변하지 않는지 확인

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
