# Interior v49 baseline integrity preview

비운영 검수 전용 단계입니다.

## 목적

v48까지 견적·업체답변·계약서 반영 확인을 마친 뒤 현재 브라우저 저장 상태를 `검수 기준`으로 저장하고, 이후 저장값이 달라졌는지 감지합니다.

## 추적 대상

- `interior-quote-v5`
- `interior-compare-v5`
- `interior-compare-v6`
- `interior-review-progress-v46`
- `interior-contract-reflection-v48`

## 저장 방식

신규 키 `interior-review-baseline-v49`에 각 추적 대상의 존재 여부, 문자열 길이, 해시만 저장합니다. 원본 견적·답변·계약서 메모 문자열은 복제하지 않습니다.

## 상태

- 기준 미저장
- 검수 기준 이후 변경 없음
- 변경 감지: 새로 생성 / 삭제됨 / 내용 변경

변경 여부만 표시하며 가격 적정성, 업체 우열, 계약 효력 또는 법률 판단을 하지 않습니다.

## 비운영 프리뷰

https://raw.githack.com/5ggul/pm-lab/interior-v49-baseline-integrity/docs/interior-v49-preview/index.html?page=quote-review-report

사용자 명시 승인 전까지 `main` 병합 및 운영 배포를 하지 않습니다.
