# Interior v41 production-shell failure-path QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## 확인한 결함과 방어

### review 저장 실패

- target 12개 state+amount 선검증
- review-only storage write 성공 후 visible DOM 변경
- 실패 시 source/handoff/preview 유지
- autosave는 `saveReview(next)` 성공 뒤 in-memory review 교체

### navigation 이탈

- site search submit capture 차단
- workflow 밖 path형 production link 차단
- absolute `https://.../pm-lab/interior-cost-preview/...` URL도 resolved pathname으로 차단
- failure probe에는 target-level safety-net을 두어 guard 실패 시에도 probe 자체가 실제 navigation하지 않음
- guard 성공 여부는 `safetyReached`로 별도 판별

### storage read/write 오염

- `production-storage-read-mask-v41.js`가 app-v21 초기화 동안 production-named 3키 read를 null 처리하고 protected `setItem/removeItem`은 document lifetime 동안 차단
- DOMContentLoaded에서 원래 reader 복원
- review-only read는 통과
- write/reset controls capture 차단
- storage isolation VM: 12/12 PASS
- robustness probe의 srcdoc realm에서 hosted active/restore 2개 검사 준비

### writer / cleanup / recovery

- Web Locks writer serialization
- complete+partial pending blocker
- ownership-aware write failure cleanup
- pending recovery / expected snapshot cancel
- production compare cleanup shared lock
- stale exact + fresh unusable exact cleanup

### numeric / autosave

- negative / Infinity / unsafe integer / aggregate overflow 차단
- app-v21 계산 전에 unsafe 입력 정리
- iframe realm autosave failure + prototype restore

## 비호스팅 회귀

- writer 8/8 PASS
- partial/cleanup-window 11/11 PASS
- writer↔production compare 9/9 PASS
- basic compare parity 6/6 PASS
- stale ownership 8/8 PASS
- malformed exact state machine 6/6 PASS
- numeric boundary 8/8 PASS
- autosave state order 3/3 PASS
- production storage isolation 12/12 PASS

## hosted self-check

`production-shell/self-check.html`: **58개**

- manifest / pinned blobs
- mask→app→guard→handoff/adapter load order
- storage API write shield + document-capture save/reset + read-mask guard markers
- DOMParser functional resource audit
- path+absolute URL navigation guard
- writer/recovery/stale/invalid cleanup markers
- amount guard / autosave order
- actual row count vs manifest count

## hosted failure probe

`production-shell/failure-probe.html`: **8개**

1. 사이트 검색 이탈 차단
2. path형 + absolute production URL 이탈 차단
3. handoff preview
4. review storage failure 시 DOM 미변경
5. source 유지
6. handoff 유지
7. failure status
8. production-named storage 3개 불변

## hosted 전체 자동검사

- self-check 58
- failure 8
- writer concurrency 7
- pending recovery 9
- stale/invalid transfer 9
- robustness 18

총 **109개**입니다. 2026-09-18 외부 비운영 HTTPS 브라우저 QA에서 **109/109 PASS**를 확인했습니다.

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
