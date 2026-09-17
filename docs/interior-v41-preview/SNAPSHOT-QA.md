# Interior v41 pinned production-shell snapshot QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

캡처 기준 commit: `26b8f66b14316743e3bfaff73912a5b15901c48c` (2026-09-17)

현재 동일성 검증 완료 commit: `16d00c5ad807bfb7155a67baadb2084fde377029`

## main blob 고정 결과

| v41 snapshot | Git blob SHA |
|---|---|
| `production-shell/snapshots/quote-check-main.html` | `17027e5b3c2370c8b34be14187d33ca973e9cc99` |
| `production-shell/snapshots/quote-compare-main.html` | `04a41335095677a0ac13aea33390dd60b411ede2` |
| `production-shell/snapshot-assets/site-v21-bundle.css` | `42839ad56e96b1f5c49245fd1ca518482a45bd66` |
| `production-shell/snapshot-assets/app-v21-bundle.js` | `4a82f3be0d598d9593f6eff21259f98e32ff231d` |

`1fcedb1e... → 16d00c5...` 사이 main 3커밋은 franchise production contract JSON만 변경했고 위 4개 interior blob은 변경되지 않았습니다.

## production-shell entrypoints

- `production-shell/index.html`
- `production-shell/self-check.html`
- `production-shell/storage-inspector.html`
- `production-shell/failure-probe.html`
- `production-shell/writer-concurrency-probe.html`
- `production-shell/pending-recovery-probe.html`
- `production-shell/stale-transfer-probe.html`
- `production-shell/robustness-probe.html`
- `production-shell/quote-check/`
- `production-shell/quote-compare/`
- `production-shell/SNAPSHOT-MANIFEST.json`

## wrapper 동작 / storage isolation

wrapper는 pinned HTML을 불러온 뒤 기능 asset과 quote workflow 경로만 review-local로 바꿉니다.

script order:

- quote-check: `production-storage-read-mask-v41 → app-v21 → production-shell guard → handoff`
- quote-compare: `production-storage-read-mask-v41 → app-v21 → production-shell guard → production adapter`

`production-storage-read-mask-v41.js`는 app-v21 초기화 동안 다음 3개 production-named key의 read만 숨깁니다.

- `interior-quote-v5`
- `interior-compare-v5`
- `interior-compare-v6`

review-only key는 그대로 읽히고, DOMContentLoaded에서 원래 `Storage.prototype.getItem`이 복원됩니다. 비호스팅 VM: **10 / 10 PASS**.

write/reset controls는 별도 guard로 차단합니다.

## production-prefix resource/navigation audit

- stylesheet → pinned local CSS
- app script → pinned local app-v21
- quote workflow links → review-local relative path
- workflow 밖 path형 production link → resolved pathname guard
- absolute `https://.../pm-lab/interior-cost-preview/...` link → 동일 guard
- site search → submit capture guard
- canonical / OG / JSON-LD URL → inert metadata

self-check는 transformed quote-check/compare에서 unresolved production `src`, form `action`, stylesheet `href`가 없는지 검사합니다.

## hosted 자동검사 준비

`SNAPSHOT-MANIFEST.json`의 `hosted_checks`가 source-of-truth입니다.

- self-check 55
- failure 8
- writer concurrency 7
- pending recovery 9
- stale transfer 9
- robustness 16
- total **104**

self-check는 실제 결과 행 수가 manifest의 `self_check`와 다르면 summary 자체를 FAIL로 처리합니다.

## storage inventory

manifest review storage:

- source: `interior-quote-source-v41`
- handoff: `interior-quote-compare-handoff-v41`
- basic compare: `interior-quote-compare-state-v41`
- production-shell review compare: `interior-quote-compare-shell-v41`

protected production-named storage:

- `interior-quote-v5`
- `interior-compare-v5`
- `interior-compare-v6`

외부 preview가 생기면 `HOSTED-QA-RUNBOOK.md` 순서로 검수합니다. 현재 hosted 104개는 아직 실행하지 않았습니다.

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
