# Interior v41 pinned production-shell snapshot QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

캡처 기준 commit: `26b8f66b14316743e3bfaff73912a5b15901c48c` (2026-09-17)

현재 동일성 검증 완료 commit: `2fa0d48fc4a13f1401a319e3690b3122fa06da97`

## main blob 고정 결과

| v41 snapshot | Git blob SHA |
|---|---|
| `production-shell/snapshots/quote-check-main.html` | `17027e5b3c2370c8b34be14187d33ca973e9cc99` |
| `production-shell/snapshots/quote-compare-main.html` | `04a41335095677a0ac13aea33390dd60b411ede2` |
| `production-shell/snapshot-assets/site-v21-bundle.css` | `42839ad56e96b1f5c49245fd1ca518482a45bd66` |
| `production-shell/snapshot-assets/app-v21-bundle.js` | `4a82f3be0d598d9593f6eff21259f98e32ff231d` |

`16d00c5...` 이후 main은 car-data preview, franchise data/preview, updown/scan data 및 관련 contract artifact를 변경했지만 `docs/interior-cost-preview/`는 변경하지 않았습니다. 마지막 `5dd0e9ed... → 2fa0d48f...` 8커밋은 franchise production contract JSON과 `data/scan_stats.jsonl`만 변경했고 pinned interior blob 4개는 그대로입니다.

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

## wrapper / storage isolation

script order:

- quote-check: `production-storage-read-mask-v41 → app-v21 → production-shell guard → handoff`
- quote-compare: `production-storage-read-mask-v41 → app-v21 → production-shell guard → production adapter`

storage isolation:

- `interior-quote-v5`
- `interior-compare-v5`
- `interior-compare-v6`

위 3키만 app-v21 초기화 동안 null read 처리하고 review-only key는 통과합니다. DOMContentLoaded에서 원래 `Storage.prototype.getItem`을 복원합니다.

- VM storage isolation read/write lifecycle: 12 / 12 PASS
- hosted robustness probe는 별도 `srcdoc` realm에서 active/restore를 실제 브라우저로 검사

write/reset은 별도 capture guard로 차단합니다.

## production-prefix resource/navigation audit

- stylesheet / app script → pinned local asset
- quote workflow → review-local relative path
- path형/absolute production link → resolved pathname guard
- site search → capture guard
- canonical / OG / JSON-LD → inert metadata
- self-check는 DOMParser로 `src`, `srcset`, form `action`, stylesheet `href` 검사

## transfer cleanup parity

production adapter는 다음 순서로 transfer를 판정합니다.

1. fresh valid matched pair → preview
2. stale exact pair → cleanup
3. fresh exact but unusable pair → cleanup
4. source/handoff mismatch → newer/interleaving 가능성이 있어 보존

비호스팅 malformed exact state machine: **6 / 6 PASS**.

## hosted 자동검사 준비

manifest `hosted_checks`가 source-of-truth:

- self-check 58
- failure 8
- writer concurrency 7
- pending recovery 9
- stale/invalid transfer 9
- robustness 18
- total **109**

self-check는 실제 결과 행 수와 manifest `self_check`가 다르면 summary FAIL입니다.

## storage inventory

review storage:

- source: `interior-quote-source-v41`
- handoff: `interior-quote-compare-handoff-v41`
- basic compare: `interior-quote-compare-state-v41`
- shell compare: `interior-quote-compare-shell-v41`

protected production storage:

- `interior-quote-v5`
- `interior-compare-v5`
- `interior-compare-v6`

외부 preview가 생기면 `HOSTED-QA-RUNBOOK.md` 순서로 검수합니다. 현재 hosted **109개는 아직 실행하지 않았습니다.**

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
