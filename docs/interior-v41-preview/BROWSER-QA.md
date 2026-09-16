# Interior v41 Chromium browser QA

검수 브랜치: `interior-v40-preview`

## 검수 방식

현재 실행 환경의 브라우저 정책 때문에 localhost, file URL, 임의 로컬 origin으로 직접 이동하면 `ERR_BLOCKED_BY_ADMINISTRATOR`가 발생합니다.

따라서 외부 프로젝트를 새로 만들지 않고, 현재 브랜치의 실제 HTML/JS를 Chromium `about:blank` 문서에 직접 주입했습니다. `localStorage`만 동일 API를 가진 테스트용 메모리 저장소로 대체했습니다.

이 방식으로 실제 Chromium의 DOM 생성, CSS 레이아웃, native dialog, focus, 클릭, radio 선택, ESC, apply/cancel 이벤트와 다중탭 저장소 변경 상황을 검수했습니다. 다만 실제 호스팅 URL 사이의 navigation과 진짜 origin 단위 localStorage 지속성은 검증 범위 밖입니다.

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

Chromium 검수에서 handoff 완료 뒤 `interior-quote-source-v41`가 계속 남는 문제를 발견해 수정했습니다.

현재 동작:

1. Apply 성공 → 현재 탭이 소유한 source/handoff만 삭제 + compare 저장 유지
2. Cancel → 현재 탭이 소유한 source/handoff만 삭제
3. 30분 초과 stale handoff → 해당 stale source/handoff만 삭제
4. handoff 없는 source는 저장 중간 상태일 수 있으므로 fresh 상태에서는 보존하고, 30분이 지난 stale orphan만 삭제
5. compare 저장 실패 → source/handoff를 유지해 사용자가 재시도할 수 있음

## 다중탭 race 검수

추가 검수에서 두 가지 race를 확인해 수정했습니다.

### 1. 오래된 미리보기 Apply

기존 탭이 B 업체 transfer 미리보기를 띄운 뒤 다른 탭이 C 업체 새 transfer를 저장해도, 기존 탭 메모리에는 예전 B 견적이 남아 있었습니다.

조치:

- Apply 직전 source/handoff를 localStorage에서 다시 읽음
- target / transferId / createdAt / quote snapshot이 현재 미리보기와 모두 일치할 때만 적용
- 불일치하면 compare를 수정하지 않고 미리보기를 닫음
- `storage` 이벤트로 source/handoff 변경을 감지하면 오래된 미리보기를 즉시 무효화
- 다른 탭이 만든 새 transfer는 삭제하지 않음

Chromium 회귀: 17 / 17 PASS

주요 확인 항목:

- 정상 B Apply 저장
- Apply 후 현재 transfer 정리
- 다른 탭이 새 C transfer로 덮어쓴 뒤 old B Apply 차단
- 차단 시 compare 미저장
- 새 C transfer 보존
- storage event 수신 시 old preview 즉시 숨김
- storage event 처리 시 새 source 보존
- 360 / 375 / 390 / 430px 페이지 overflow 없음
- 각 폭 Apply 버튼 44px 이상

### 2. 오래된 미리보기 Cancel

storage 이벤트가 도착하기 직전 사용자가 기존 탭에서 Cancel을 누르면, 기존 구현은 localStorage의 현재 source/handoff를 무조건 지워 다른 탭이 막 만든 새 transfer까지 삭제할 수 있었습니다.

조치:

- source/handoff 삭제 전에 현재 저장값이 이 탭이 처음 읽은 transfer snapshot과 같은지 재검증
- 현재 탭이 소유한 transfer만 삭제
- 다른 탭이 만든 새 source/handoff는 보존
- fresh orphan source는 source→handoff 순차 저장 중간일 수 있어 즉시 삭제하지 않음
- 30분 지난 stale orphan만 정리

Chromium 회귀: 9 / 9 PASS

확인 항목:

- 정상 Cancel은 자기 transfer 삭제
- stale 탭 Cancel은 새 source 보존
- stale 탭 Cancel은 새 handoff 보존
- stale 탭 Apply 차단
- stale Apply 뒤 새 transfer 보존
- fresh orphan source 보존
- stale orphan source 정리
- 정상 Apply는 B 저장 유지
- 정상 Apply 뒤 자기 transfer 정리

Node syntax check: PASS

## 아직 남은 검수

외부 비운영 URL이 있어야 아래 항목을 최종 확인할 수 있습니다.

1. 실제 quote-check URL → quote-compare URL 이동
2. 실제 origin localStorage 지속성
3. 새로고침 뒤 compare 복원
4. 브라우저를 닫았다가 다시 접속했을 때 compare 복원
5. A → B → C 연속 전송
6. 실제 서로 다른 탭 사이의 native `storage` event 타이밍
7. 모바일 실제 touch/scroll 감각

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- 외부 preview 프로젝트 생성 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
