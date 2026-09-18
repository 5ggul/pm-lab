# Interior v41 static pre-host QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

기준 branch commit: `15daa248ea219f821c396308f4456ee59be538a8`

current main 동일성 확인 경계: `daa68c096916f421d57c8d2dff64064c1ebc23b6` (2026-09-18)

이 문서는 외부 HTTPS preview 없이 수행 가능한 정적/상태-machine 검산을 한 곳에 고정합니다. hosted PASS를 대신하지 않습니다.

## current main pinned blob 재대조

현재 main에서 다음 4개 blob을 직접 다시 읽었습니다.

- quote-check HTML: `17027e5b3c2370c8b34be14187d33ca973e9cc99`
- quote-compare HTML: `04a41335095677a0ac13aea33390dd60b411ede2`
- site-v21 CSS: `42839ad56e96b1f5c49245fd1ca518482a45bd66`
- app-v21 JS: `4a82f3be0d598d9593f6eff21259f98e32ff231d`

결과: **4 / 4 exact match**.

`16d00c5... → daa68c09...` 사이 main 15커밋은 car-data preview, franchise data/preview, updown/scan data 및 관련 contract artifact를 변경했지만 위 4개 interior quote path는 변경하지 않았습니다.

## syntax / noindex 전수 검산

branch commit `15daa248...` 기준:

- custom JS + HTML inline scripts 문법 검사: **18 / 18 PASS**
- v41 HTML entrypoint / probe / snapshot robots noindex: **14 / 14 PASS**
- absolute production-prefix functional `src/action/stylesheet` 직접 참조: 발견 없음

대상에는 shell guard, storage read-mask, handoff, production adapter, self-check, 모든 hosted probe, storage inspector, production-shell loaders, basic quote pages가 포함됩니다.

## hosted check inventory 정적 검산

실제 성공 경로 검사 등록 개수:

- self-check: **55**
- failure probe: **8**
- writer concurrency: **7**
- pending recovery: **9**
- stale / invalid transfer: **9**
- robustness: **18**

manifest total: **106**.

self-check는 실행 시 실제 결과 행 수가 manifest `self_check`와 다르면 summary 자체를 FAIL로 처리합니다.

## production storage read-mask

확인한 결함:

- production-named storage read가 app-v21 초기 DOM에 섞일 수 있었음
- mask asset 중복 로드 시 masked reader가 원본처럼 중첩될 위험
- DCL 이후 재로드 시 재마스킹 가능성

현재:

- shell 또는 명시적 test context에서만 활성화
- production 3키 `getItem`만 null
- review-only key는 underlying reader 통과
- write API는 패치하지 않음
- document당 one-shot guard
- DOMContentLoaded + load fallback restore

실제 asset 코드 실행 simulation: **10 / 10 PASS**.

robustness probe는 srcdoc browser realm에서 mask asset을 일부러 두 번 로드해 활성/복원을 확인합니다.

## exact transfer snapshot race

확인한 결함:

기존 production adapter Apply/storage-event 검사는 `transferId + createdAt` 중심이라 같은 ID/시간을 유지한 채 source quote 또는 target만 바뀌면 old preview가 남을 수 있었습니다.

현재:

- `sameTransferSnapshot()`
- source quote exact snapshot
- handoff target/version/id/time exact snapshot
- current persisted quote freshness/validity
- Apply 직전 exact recheck
- source/handoff storage event exact recheck

상태 simulation: **8 / 8 PASS**.

hosted stale probe는 same-id source mutation과 same-id target mutation을 실제 iframe storage event로 재현합니다.

## stale / invalid exact cleanup

- stale exact ownership/freshness 분리: **8 / 8 PASS**
- fresh malformed exact state machine: **6 / 6 PASS**
- cleanup ownership 상실 시 거짓 완료 문구 금지
- ownership을 잃으면 current transfer 재조회
- current valid transfer면 새 preview 재표시
- invalid/partial/newer state는 보존 안내

stale probe는 Web Lock을 의도적으로 잡아 cleanup을 지연시킨 뒤 newer pair로 바꾸는 ownership-loss race도 검사합니다.

## numeric / autosave

- numeric boundary: **8 / 8 PASS**
- autosave storage-before-memory: **3 / 3 PASS**
- negative / non-finite / unsafe integer / aggregate overflow 차단
- app-v21 계산 전 capture guard
- iframe realm storage failure 강제 및 prototype restore

## hosted 전 남은 것

정적 검수는 hosted 실행을 대신하지 않습니다.

외부 비운영 HTTPS preview가 명시적으로 승인되면 `HOSTED-QA-RUNBOOK.md` 순서로:

1. same-tab production storage baseline
2. automatic **106 / 106**
3. actual quote-check → quote-compare
4. A → B → C
5. refresh / revisit
6. native two-tab storage events
7. mobile touch / scroll
8. same-tab storage baseline 재비교

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- PR #201 Draft 유지
- 별도 승인 전 Ready / merge / production deploy 금지
