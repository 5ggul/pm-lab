# Interior v41 Chromium browser QA

검수 브랜치: `interior-v40-preview`

## 검수 방식

현재 실행 환경의 브라우저 정책 때문에 localhost, file URL, 임의 로컬 origin으로 직접 이동하면 `ERR_BLOCKED_BY_ADMINISTRATOR`가 발생합니다.

따라서 외부 프로젝트를 새로 만들지 않고, 현재 브랜치의 실제 HTML/JS를 Chromium `about:blank` 문서에 직접 주입했습니다. `localStorage`만 동일 API를 가진 테스트용 메모리 저장소로 대체했습니다.

이 방식으로 실제 Chromium의 DOM 생성, CSS 레이아웃, native dialog, focus, 클릭, radio 선택, ESC, apply/cancel 이벤트를 검수했습니다. 다만 실제 호스팅 URL 사이의 navigation과 진짜 origin 단위 localStorage 지속성은 검증 범위 밖입니다.

## 모바일 렌더링

검수 폭: 360 / 375 / 390 / 430px

공통 PASS:

- document/body 폭이 viewport를 초과하지 않음
- H1 잘림/가로 넘침 없음
- `비교표로 보내기` 주입 정상
- 주요 action button 최소 높이 44px
- dialog가 viewport 좌우 안쪽에 유지
- dialog 최초 focus가 A 업체 radio에 진입
- A/B/C 선택 가능
- 취소 버튼으로 dialog 닫힘
- ESC로 dialog 닫힘
- Chromium page error 없음

quote-check 기본조건 grid:

- 360px: 1열
- 375px: 1열
- 390px: 2열
- 430px: 2열

Dialog 폭:

- 360px viewport → 328px
- 375px viewport → 343px
- 390px viewport → 358px
- 430px viewport → 398px

A/B/C 선택 영역 높이: 각 88px

## quote-compare 적용 검수

v2 source/handoff를 B 업체 target으로 주입한 뒤 실제 `#apply` 버튼을 클릭했습니다.

PASS:

- handoff 미리보기 노출
- `B 업체 칸으로 가져옵니다.` 표시
- 적용 후 B 업체 compare state 저장
- 6개 context 유지
- 12개 공종 유지
- amount/qty/unit/spec/memo 유지
- handoff 제거
- 임시 source 제거
- preview 닫힘
- 적용 완료 상태 문구 표시

360px 적용 후 비교표:

- page document width: 360px
- grid client width: 328px
- grid scroll width: 388px
- 즉 비교표만 내부 가로 스크롤되고 페이지 전체는 가로로 밀리지 않음

## 임시 전달 데이터 정리 회귀

이번 Chromium 검수에서 handoff 완료 뒤 `interior-quote-source-v41`가 계속 남는 문제를 발견해 수정했습니다.

현재 동작:

1. Apply 성공 → source 삭제 + handoff 삭제 + compare 저장 유지
2. Cancel → source 삭제 + handoff 삭제
3. 30분 초과 stale handoff → source 삭제 + handoff 삭제
4. handoff 없는 orphan source → 페이지 진입 시 source 삭제
5. compare 저장 실패 → source/handoff를 유지해 사용자가 재시도할 수 있음

Node syntax check: PASS

## 아직 남은 검수

외부 비운영 URL이 있어야 아래 항목을 최종 확인할 수 있습니다.

1. 실제 quote-check URL → quote-compare URL 이동
2. 실제 origin localStorage 지속성
3. 새로고침 뒤 compare 복원
4. 브라우저를 닫았다가 다시 접속했을 때 compare 복원
5. A → B → C 연속 전송
6. 두 탭에서 순차 전송 시 transferId mismatch 차단
7. 모바일 실제 touch/scroll 감각

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- 외부 preview 프로젝트 생성 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
