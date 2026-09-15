# Interior v53 selective restore

비운영 검수 전용 단계입니다.

- base: `interior-v52-local-backup`
- `main` / 운영 배포 변경 없음
- v52 전체 백업/복원 유지
- v53에서 동일한 백업 JSON을 현재 브라우저 저장값과 영역별 비교
- 상태: `동일`, `내용 다름`, `백업에만 있음`, `현재에만 있음`, `둘 다 저장값 없음`
- 실제로 다른 영역만 기본 선택
- `달라진 항목 선택`, `전체 선택`, `선택 해제`
- 선택한 저장 영역만 복원
- 선택하지 않은 허용 저장 영역은 byte-for-byte 유지
- 허용 7개 이외 localStorage 유지
- 선택 복원 중 실패 시 선택한 영역을 시작 전 값으로 롤백
- v52의 format/version/exact key set/value type/2MB 검증을 그대로 재사용
- 서버 저장 없음

비운영 프리뷰:

`https://raw.githack.com/5ggul/pm-lab/interior-v53-selective-restore/docs/interior-v53-preview/index.html?page=quote-review-report`

사용자 명시 승인 전까지 Draft PR을 유지하고 `main` 병합 및 운영 배포를 하지 않습니다.
