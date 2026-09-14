# Interior v50 QA

## 반드시 통과해야 하는 항목

- 실제 `quote-review-report` HTML에서 `InteriorQuoteReview48`, `InteriorQuoteReview49`, `InteriorQuoteReview50` 자동 로드
- v49 baseline 미저장 상태 안내
- baseline 저장 직후 재검수 큐 비어 있음
- quote 변경 → 견적 재검수 작업 생성
- compare v5/v6 변경 → A/B/C 비교 재검수 작업 1개로 병합
- progress 변경 → 업체 답변 진행 재검수 작업 생성
- reflection 변경 → 계약서 반영 기록 재검수 작업 생성
- 5개 저장영역 변경 시 논리 재검수 카드 총 4개
- 재검수 완료 체크 및 메모 저장
- 같은 영역이 다시 바뀌면 기존 완료 체크가 이어지지 않음
- 기준 스냅샷과 변경 전/후 fingerprint가 다른 경우 과거 완료 상태를 재사용하지 않음
- v49 baseline 새로 저장 시 현재 큐가 clean 상태로 전환
- v50 초기화 시 `interior-review-revalidation-v50`만 삭제
- v50 렌더링/완료/초기화가 quote/compare/progress/reflection/v49 baseline을 수정하지 않음
- 데스크톱 Chromium
- 모바일 390x844
- document-level horizontal overflow 없음
- print media에서 재검수 내용 표시, 액션 숨김
- 브라우저 console/runtime error 없음
- 비운영 프리뷰의 견적/비교 재검수 링크가 wrapper 안에서 이동 가능

## 보호 범위

`main`, 운영 도메인, custom domain, index/canonical 정책, AdSense 운영 배포는 이 단계에서 변경하지 않습니다.
