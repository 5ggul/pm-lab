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
- 비교표만 내부 가로 스크롤되고 페이지 전체는 가로로 밀리지 않음

## 임시 전달 데이터 정리 회귀

현재 동작:

1. Apply 성공 → 현재 탭이 소유한 source/handoff만 삭제 + compare 저장 유지
2. Cancel → 현재 탭이 소유한 source/handoff만 삭제
3. stale handoff → 해당 stale source/handoff만 삭제
4. fresh partial source/handoff는 새 writer가 덮어쓰지 않고 recovery 대상으로 처리
5. compare 저장 실패 → source/handoff를 유지해 재시도 가능

## 다중탭 race 검수

### 오래된 미리보기 Apply

조치:

- Apply 직전 source/handoff를 localStorage에서 다시 읽음
- target / transferId / createdAt / quote snapshot이 현재 미리보기와 모두 일치할 때만 적용
- 불일치하면 compare를 수정하지 않고 미리보기 무효화
- `storage` 이벤트로 source/handoff 변경을 감지하면 오래된 미리보기 무효화
- 다른 탭이 만든 새 transfer는 삭제하지 않음

Chromium 회귀: **17 / 17 PASS**

### 오래된 미리보기 Cancel / ownership

조치:

- 삭제 전 현재 저장값이 이 탭이 처음 읽은 transfer snapshot과 같은지 재검증
- 현재 탭이 소유한 transfer만 삭제
- 다른 탭이 만든 새 source/handoff 보존
- fresh partial 상태는 writer 점유로 취급

Chromium 회귀: **9 / 9 PASS**

## 추가 VM 동시성 회귀

실 origin을 만들 수 없는 동시성 구간은 storage/lock simulation으로 보강했습니다.

- writer concurrency: **8 / 8 PASS**
- pair/partial cleanup-window: **11 / 11 PASS**
- writer↔compare cleanup lock interleaving: **9 / 9 PASS**

검증된 핵심 조건:

- fresh complete pair가 두 번째 writer 차단
- fresh source-only / handoff-only partial도 두 번째 writer 차단
- old cleanup이 새 transfer를 삭제하지 않음
- production-shell Apply/Cancel cleanup과 writer가 같은 Web Lock 사용
- navigation 실패 뒤 pending recovery cancel이 newer transfer를 지우지 않음

Node syntax check: PASS

## hosted에서만 남은 검수

외부 비운영 HTTPS URL에서 다음을 실제 브라우저로 실행해야 합니다.

- self-check **44 / 44**
- failure-probe **8 / 8**
- writer-concurrency-probe **7 / 7**
- pending-recovery-probe **9 / 9**
- 실제 quote-check URL → quote-compare URL 이동
- real-origin localStorage refresh / revisit
- A → B → C 순차 handoff
- 실제 서로 다른 탭의 native `storage` event
- 실제 모바일 touch / horizontal scroll
- 운영 이름 storage baseline hash 불변

Hosted 자동검사 준비 합계: **68개**.

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- 외부 preview 프로젝트 생성 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
