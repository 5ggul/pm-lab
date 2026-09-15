# Interior v54 restore undo preview

비운영 검수용 브랜치입니다.

- base: `interior-v53-selective-restore`
- v52 전체 복원과 v53 선택 복원을 유지합니다.
- 신규 체크포인트 키: `interior-review-restore-checkpoint-v54`
- 전체 복원 직전에는 허용 7개 저장 영역의 기존 값을 한 번 보관합니다.
- 선택 복원 직전에는 실제 선택한 저장 영역의 기존 값만 보관합니다.
- 성공한 복원 뒤 `복원 전 상태로 되돌리기`를 한 번 사용할 수 있습니다.
- 선택 복원을 되돌릴 때는 선택했던 영역만 복원 전 값으로 돌아가므로, 복원 뒤 다른 저장 영역을 수정해도 그 수정은 유지됩니다.
- 새 전체/선택 복원을 적용하면 이전 체크포인트는 새 체크포인트로 교체됩니다.
- 복원 적용 자체가 실패하면 v54가 새 체크포인트를 폐기하고 그 전에 있던 체크포인트를 복구합니다.
- 체크포인트는 v52/v53 백업 JSON의 7개 허용 키에 포함되지 않습니다.
- 서버 전송, 계정 동기화, `main` 병합, 운영 배포는 없습니다.

비운영 프리뷰:

`https://raw.githack.com/5ggul/pm-lab/interior-v54-restore-undo/docs/interior-v54-preview/index.html?page=quote-review-report`

사용자 명시 승인 전까지 이 브랜치는 검수 전용으로 유지합니다.
