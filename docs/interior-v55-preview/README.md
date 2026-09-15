# Interior v55 — restore conflict guard

비운영 검수 전용 단계입니다.

## 기준

- base: `interior-v54-restore-undo`
- base SHA: `a73103d5f53eed48fc5fb49b2727f8b47dfee3b5`
- head: `interior-v55-restore-conflict-guard`
- `main` / 운영 배포 없음

## 목적

v52/v53에서 백업 파일을 미리 본 뒤 실제 복원을 누르기 전까지 현재 브라우저 저장값이 바뀔 수 있습니다. v55는 미리보기 시점의 현재값과 적용 시점의 현재값을 다시 비교해 오래된 미리보기로 덮어쓰는 것을 막습니다.

## 동작

- 신규 localStorage 없음
- 백업 파일 선택 시 허용 7개 저장영역의 raw 값을 세션 메모리에만 보관
- 백업 파일 내용 hash를 함께 보관해 미리보기 파일과 적용 파일 불일치 차단
- 전체 복원: 7개 영역 전부 재검증
- 선택 복원: 실제 체크한 영역만 재검증
- 확인창 열기 전 1차 preflight
- 확인창 승인 직후 2차 preflight
- 하나라도 미리보기 시점과 다르면 복원 및 v54 체크포인트 생성을 모두 중단
- 충돌 영역 이름을 화면에 표시
- `현재값으로 비교 다시 시작`으로 같은 파일을 현재값 기준으로 다시 비교 가능
- 선택하지 않은 영역의 변경은 선택 복원을 막지 않음
- v54의 전체/선택 복원 체크포인트 및 되돌리기 유지
- 서버 전송 없음
- 인쇄 시 v55 조작 UI 숨김

## 비운영 프리뷰

`https://raw.githack.com/5ggul/pm-lab/interior-v55-restore-conflict-guard/docs/interior-v55-preview/index.html?page=quote-review-report`

사용자 명시 승인 전까지 Draft 상태를 유지하고 `main` 병합 및 운영 배포를 하지 않습니다.
