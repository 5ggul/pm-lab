# DealOps Daangn Cloud

당근 카페 자동화를 로컬 Windows 작업 스케줄러에서 GitHub Actions로 옮긴 버전입니다.

## 동작 방식

- GitHub Actions가 KST 08:30~22:30에 매시간 1회 실행합니다.
- 하루 최대 15건까지만 게시합니다.
- 기본 배분은 꿀팁 5, 핫딜 5, 오늘어디가지 3, 카드 1, 생활이슈 1입니다.
- 좋은 후보가 부족하면 억지로 15개를 채우지 않습니다.
- 원본 URL, 제목 정규화, needs-review 기록으로 중복 게시를 막습니다.
- 제출 후 게시 URL을 확인하지 못한 글은 자동 재시도하지 않습니다.

## 콘텐츠 품질 게이트

- 제목에 `｜` 사용 금지
- `확인됩니다`, `확인해주세요`, `쿠폰 적용 여부` 같은 반복 문구 금지
- 핫딜은 비교가격이 있어야 하며 최소 10% 이상 차이가 있어야 함
- 실제 상품 이미지가 있는 핫딜만 통과
- 꿀팁은 정책브리핑 기사 본문의 숫자/날짜가 있는 내용만 사용
- 오늘어디가지는 한국관광공사 행사 중 무료 또는 할인 근거가 있는 행사만 사용
- 제목은 금액, 할인폭, 무료, 마감 등 실제 근거를 앞쪽에 배치

## 최초 1회 설정

당근 로그인 세션을 GitHub Secret으로 한 번만 옮기면 이후에는 PC가 꺼져 있어도 동작합니다.

Windows에서:

```powershell
powershell -ExecutionPolicy Bypass -File ops/daangn-cloud/bootstrap-secret.ps1
```

Secret 이름은 `DAANGN_AUTH_STATE_B64` 입니다. 인증 값은 저장소 파일에 커밋하지 않습니다.

## 인증이 만료됐을 때

GitHub Actions 로그에 `AUTH_EXPIRED`가 나오면 PC에서 당근 로그인을 갱신한 뒤 `bootstrap-secret.ps1`을 다시 한 번 실행합니다.

## 수동 테스트

GitHub Actions > DealOps Daangn Cloud > Run workflow에서 `collect_only=true`로 실행하면 게시 없이 큐만 검증할 수 있습니다.
