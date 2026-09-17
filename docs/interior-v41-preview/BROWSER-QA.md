# Interior v41 Chromium browser QA

검수 브랜치: `interior-v40-preview`

## 검수 방식

현재 실행 환경의 브라우저 정책 때문에 localhost, file URL, 임의 로컬 origin 직접 이동은 `ERR_BLOCKED_BY_ADMINISTRATOR` 또는 브라우저 실행 정책 단계에서 차단됩니다.

따라서 외부 프로젝트를 새로 만들지 않고 실제 branch HTML/JS를 Chromium DOM에 주입하고 localStorage는 동일 API 메모리 shim으로 대체해 DOM/CSS/dialog/focus/click/storage-change 회귀를 검수했습니다. 실제 hosted navigation 및 origin persistence는 외부 HTTPS preview가 필요합니다.

## 모바일 렌더링

검수 폭: 360 / 375 / 390 / 430px

PASS:

- page-level horizontal overflow 없음
- H1 잘림 없음
- `비교표로 보내기` 주입
- 주요 action 44px 이상
- native dialog viewport 내부
- 최초 focus / A-B-C 선택 / cancel / ESC
- Chromium page error 없음
- compare 내부 grid만 필요 시 horizontal scroll

## handoff/browser 회귀

- B target preview / Apply
- 6 context / 12 공종 / detail fields 보존
- source/handoff cleanup
- stale Apply 차단
- storage event preview 무효화
- newer transfer 보존

결과:

- stale Apply/storage-event: 17 / 17 PASS
- Cancel/ownership/orphan: 9 / 9 PASS

## writer / cleanup / robustness 추가 회귀

- writer concurrency: 8 / 8 PASS
- complete/partial cleanup-window: 11 / 11 PASS
- writer↔production compare lock interleaving: 9 / 9 PASS
- basic quote-compare sequential cleanup parity: 6 / 6 PASS
- stale ownership/cleanup: 8 / 8 PASS
- numeric boundary: 8 / 8 PASS
- autosave state order: 3 / 3 PASS

기본 compare는 cleanup 자체에 duplicate lock을 넣지 않습니다. 공통 writer가 fresh complete와 source-only/handoff-only partial을 모두 점유 상태로 보므로 cleanup 중간에 새 writer가 들어오지 못하고, ownership 비교가 newer transfer를 보호합니다.

production-shell compare는 Apply/Cancel cleanup 자체도 writer와 같은 Web Lock에 참여합니다.

## hosted probe 준비

- self-check 55
- failure-probe 8
- writer-concurrency-probe 7
- pending-recovery-probe 9
- stale-transfer-probe 9
- robustness-probe 16

총 **104개** hosted 자동검사가 준비됐으며 실제 외부 HTTPS preview 전에는 PASS로 기록하지 않습니다.

`robustness-probe.html`은 iframe에 로드된 compare adapter realm의 `Storage.prototype`을 직접 패치해 autosave failure를 강제하고 원복 여부까지 확인합니다.

## 아직 남은 검수

1. hosted 자동검사 104 / 104
2. 실제 quote-check URL → quote-compare URL navigation
3. real-origin localStorage persistence
4. refresh/revisit restore
5. A → B → C
6. 실제 native storage event timing
7. 모바일 실제 touch/scroll
8. production-named storage hash 불변

실행 순서는 `HOSTED-QA-RUNBOOK.md`에 고정합니다.

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
