# Interior v41 Chromium browser QA

검수 브랜치: `interior-v40-preview`

## 검수 방식

현재 실행 환경 정책 때문에 localhost/file/임의 로컬 origin 직접 이동은 차단됩니다. 외부 프로젝트를 만들지 않고 branch HTML/JS를 Chromium DOM에 주입하고 localStorage는 동일 API 메모리 shim으로 대체해 DOM/CSS/dialog/focus/click/storage-change 회귀를 검수했습니다.

실제 hosted navigation, Web Locks cross-context, origin persistence는 외부 HTTPS preview가 필요합니다.

## 모바일 렌더링

검수 폭: 360 / 375 / 390 / 430px

PASS:

- page-level horizontal overflow 없음
- H1 잘림 없음
- send button 주입
- 주요 action 44px 이상
- native dialog viewport 내부
- focus / A-B-C / cancel / ESC
- Chromium page error 없음
- compare grid 내부 horizontal scroll

## handoff/browser 회귀

- B preview / Apply
- 6 context / 12 items / details
- source/handoff cleanup
- stale Apply 차단
- storage-event preview invalidation
- newer transfer 보존

결과:

- stale Apply/storage-event 17/17 PASS
- Cancel/ownership/orphan 9/9 PASS

## 추가 비호스팅 회귀

- writer 8/8 PASS
- complete/partial cleanup-window 11/11 PASS
- writer↔production compare lock 9/9 PASS
- basic compare parity 6/6 PASS
- stale ownership 8/8 PASS
- malformed exact state machine 6/6 PASS
- numeric boundary 8/8 PASS
- autosave state order 3/3 PASS
- production storage isolation read/write lifecycle 12/12 PASS

## hosted browser 검증 자산

- production storage isolation browser realm read-mask/write-shield lifecycle은 robustness probe 안에서 2개 검사
- autosave failure는 iframe `compareWin.Storage.prototype`에서 강제
- failure probe navigation safety-net은 guard 실패 시 실제 페이지 이탈 방지
- stale probe는 stale exact + fresh malformed exact cleanup runtime 검사
- self-check는 DOMParser로 transformed functional resources 검사

## hosted probe 준비

- self-check 58
- failure 8
- writer concurrency 7
- pending recovery 9
- stale/invalid transfer 9
- robustness 18

총 **109개**. 2026-09-18 외부 비운영 HTTPS 브라우저 QA에서 **109/109 PASS**를 확인했습니다. 최종 브라우저 러너는 110 assertions / 0 failures였습니다.

## 남은 검수

1. hosted automatic 109 / 109
2. actual quote-check → quote-compare navigation
3. real-origin persistence / refresh / revisit
4. A → B → C
5. native two-tab storage event
6. mobile touch/scroll
7. production-named storage hash baseline unchanged

실행 순서는 `HOSTED-QA-RUNBOOK.md`.

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
