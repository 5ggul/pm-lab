# Interior v50 — 변경 후 재검수 큐

비운영 검수 전용 단계입니다.

## 목적

v49가 검수 기준 이후 변경을 감지했을 때 단순 경고로 끝내지 않고, 변경된 저장 영역을 사용자가 다시 확인해야 할 작업으로 변환합니다.

## 동작

- v49 baseline이 없으면 재검수 큐를 만들지 않습니다.
- baseline 대비 변경이 없으면 `현재 재검수할 변경이 없습니다` 상태를 표시합니다.
- 변경이 있으면 다음 4개 논리 작업으로 묶습니다.
  - 견적 입력 다시 확인: `quote`
  - A/B/C 비교 다시 확인: `compare5`, `compare6`을 하나의 작업으로 병합
  - 업체 답변 진행 다시 확인: `progress`
  - 계약서 반영 기록 다시 확인: `reflection`
- 각 작업은 완료 체크와 재검수 메모를 가집니다.
- 진행 기록은 `interior-review-revalidation-v50`에만 저장합니다.
- 작업 서명에는 v49 baseline 생성 시각과 변경 전/후 fingerprint를 포함합니다.
  - 동일 영역이 다시 변경되면 과거 완료 체크를 자동 재사용하지 않습니다.
  - baseline을 새로 저장한 뒤 우연히 예전 값과 같은 값이 나타나도 과거 완료 체크를 재사용하지 않습니다.
- 모든 작업을 완료해도 v49 baseline은 자동 갱신하지 않습니다.
- 사용자가 충분히 재확인한 뒤 v49에서 새 baseline을 저장해야 합니다.

## 보존 규칙

v50은 아래 저장값을 수정하지 않습니다.

- `interior-quote-v5`
- `interior-compare-v5`
- `interior-compare-v6`
- `interior-review-progress-v46`
- `interior-contract-reflection-v48`
- `interior-review-baseline-v49`

서버 전송, 계정 동기화, 가격 적정성 판단, 업체 추천, 계약 효력·법률 판단은 하지 않습니다.

## 비운영 프리뷰

`https://raw.githack.com/5ggul/pm-lab/interior-v50-revalidation-queue/docs/interior-v50-preview/index.html?page=quote-review-report`

사용자 명시 승인 전까지 `main` 병합 및 운영 배포를 하지 않습니다.
