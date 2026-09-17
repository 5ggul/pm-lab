# Interior v41 pinned production-shell snapshot QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

캡처 기준 commit: `26b8f66b14316743e3bfaff73912a5b15901c48c` (2026-09-17)

현재 동일성 검증 완료 commit: `200a129ad0eda851441749a01b25b82f33e43070`

## 목적

외부 비운영 프리뷰 승인 전에도 실제 main quote-check / quote-compare UI와 동일한 HTML/CSS/JS를 v41 검수 폴더에 고정합니다. 이후 main이 자동 데이터 커밋으로 이동해도 고정된 4개 인테리어 blob 자체가 바뀌지 않는 한 이번 검수 화면은 유지됩니다.

## main blob 고정 결과

| v41 snapshot | Git blob SHA |
|---|---|
| `production-shell/snapshots/quote-check-main.html` | `17027e5b3c2370c8b34be14187d33ca973e9cc99` |
| `production-shell/snapshots/quote-compare-main.html` | `04a41335095677a0ac13aea33390dd60b411ede2` |
| `production-shell/snapshot-assets/site-v21-bundle.css` | `42839ad56e96b1f5c49245fd1ca518482a45bd66` |
| `production-shell/snapshot-assets/app-v21-bundle.js` | `4a82f3be0d598d9593f6eff21259f98e32ff231d` |

branch에서 다시 읽은 SHA도 위 값과 모두 일치했습니다.

`26b8f66` 이후 `200a129`까지 추가된 main 커밋들은 프랜차이즈/데이터 자동 갱신이었고 위 4개 interior blob은 변경되지 않았음을 비교했습니다.

## production-shell entrypoints

- `production-shell/index.html` — 검수 진입점
- `production-shell/self-check.html` — snapshot / wrapper 무결성 검사
- `production-shell/storage-inspector.html` — 운영 이름 storage key read-only 기준점/변경 검사
- `production-shell/failure-probe.html` — 저장 실패와 검수 이탈 강제 재현
- `production-shell/quote-check/` — pinned main quote-check + v41 handoff
- `production-shell/quote-compare/` — pinned main quote-compare + app-v21 + guard + production adapter
- `production-shell/SNAPSHOT-MANIFEST.json` — captured commit / verified-through commit / blob SHA / storage manifest

## wrapper 동작

wrapper는 pinned HTML을 `fetch()`한 뒤 asset과 workflow 경로만 review-local 상대경로로 바꿉니다.

script order:

- quote-check: `app-v21 → production-shell guard → handoff`
- quote-compare: `app-v21 → production-shell guard → production adapter`

## self-check

`production-shell/self-check.html`은 외부 HTTPS preview에서 32개 항목을 검사합니다.

핵심 범위:

- captured commit metadata
- verified-through commit metadata
- pinned 4개 Git blob hash
- 12공종 / 6 context / report/compare marker
- local CSS/app rewrite
- guard/handoff/adapter injection
- script load order
- wrapper snapshot fetch path
- quote-check/compare production storage guard
- relative compare navigation
- atomic compare commit helper와 storage-before-DOM 순서
- site search / workflow 밖 internal link guard

외부 프리뷰가 생기면 먼저 self-check 전체 PASS를 확인한 뒤 실제 handoff 클릭 검수를 시작합니다.

## 운영 격리

review-only 저장키:

- `interior-quote-source-v41`
- `interior-quote-compare-handoff-v41`
- `interior-quote-compare-state-v41`
- `interior-quote-compare-shell-v41`

보호 대상 운영 이름 저장키:

- `interior-quote-v5`
- `interior-compare-v5`
- `interior-compare-v6`

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
