# Interior v48 — 계약서 반영 확인판

비운영 검수 전용 단계입니다.

## 목적

v47 계약 전 최종 확인 요약에서 확인 완료 + 업체 답변 메모가 있는 항목만 가져와, 실제 견적서·계약서 등 서면에 답변 내용이 반영됐는지 사용자가 직접 체크합니다.

## 저장 원칙

- 신규 키: `interior-contract-reflection-v48`
- 저장 항목: 서면 반영 체크, 계약서/견적서 위치·문구 메모
- 변경 금지: `interior-quote-v5`, `interior-compare-v5`, `interior-compare-v6`, `interior-review-progress-v46`
- 서버 전송/계정 동기화 없음

## 기능

- 업체별 서면 반영 대상 목록
- 전체/A/B/C 업체별 반영 진행률
- 항목별 `서면 반영 확인`
- 계약서/견적서 위치·문구 메모
- 업체별 `미반영 항목만 복사`
- 전체 반영 확인본 복사
- 반영 기록만 초기화
- 인쇄 대응

이 기능은 계약의 유효성·법률 효과·가격 적정성·업체 품질을 판정하지 않습니다.

## 비운영 프리뷰

https://raw.githack.com/5ggul/pm-lab/interior-v48-contract-reflection/docs/interior-v48-preview/index.html?page=quote-review-report

사용자 명시 승인 전에는 `main` 병합 또는 운영 배포를 하지 않습니다.
