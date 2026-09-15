# Interior v52 local backup preview

비운영 검수 전용 단계입니다.

## 목표

브라우저 localStorage에만 있던 검수 기록을 사용자가 직접 JSON으로 보관하고 다른 브라우저에서 복원할 수 있게 합니다.

## 포함 범위

허용 저장 키 7개만 백업/복원합니다.

- `interior-quote-v5`
- `interior-compare-v5`
- `interior-compare-v6`
- `interior-review-progress-v46`
- `interior-contract-reflection-v48`
- `interior-review-baseline-v49`
- `interior-review-revalidation-v50`

백업 파일은 각 값의 raw localStorage 문자열을 보존합니다. 다른 localStorage 키는 포함하거나 수정하지 않습니다.

## 복원 안전장치

- JSON / format / version / 정확한 7개 키 검증
- 2MB 파일 상한
- 파일 선택 후 미리보기 전에는 현재 기록 무변경
- 항목별 데이터 유무와 byte 크기만 미리보기
- 명시적인 `이 백업으로 복원` + 확인 대화상자 후 적용
- 적용 실패 시 시작 전 7개 값으로 롤백
- 허용 7개 외 localStorage 유지

## Preview

`https://raw.githack.com/5ggul/pm-lab/interior-v52-local-backup/docs/interior-v52-preview/index.html?page=quote-review-report`

사용자 명시 승인 전에는 `main` 병합 또는 운영 배포를 하지 않습니다.
