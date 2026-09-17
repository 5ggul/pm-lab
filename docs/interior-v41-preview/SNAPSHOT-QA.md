# Interior v41 pinned production-shell snapshot QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

기준 main HEAD: `26b8f66b14316743e3bfaff73912a5b15901c48c` (2026-09-17)

## 목적

외부 비운영 프리뷰 승인이 나기 전에도 실제 main quote-check / quote-compare UI와 동일한 HTML/CSS/JS를 v41 검수 폴더에 고정해 둡니다. 이후 호스팅 시 main이 더 움직여도 이번 검수 기준 화면이 바뀌지 않습니다.

## main blob 고정 결과

아래 4개 파일은 main 원본 blob SHA를 그대로 새 경로에 참조해 추가했습니다. 다시 생성하거나 문자열로 복사한 파일이 아닙니다.

| v41 snapshot | main blob SHA |
|---|---|
| `production-shell/snapshots/quote-check-main.html` | `17027e5b3c2370c8b34be14187d33ca973e9cc99` |
| `production-shell/snapshots/quote-compare-main.html` | `04a41335095677a0ac13aea33390dd60b411ede2` |
| `production-shell/snapshot-assets/site-v21-bundle.css` | `42839ad56e96b1f5c49245fd1ca518482a45bd66` |
| `production-shell/snapshot-assets/app-v21-bundle.js` | `4a82f3be0d598d9593f6eff21259f98e32ff231d` |

branch에서 다시 읽은 SHA도 위 값과 모두 일치했습니다.

## production-shell entrypoints

- `production-shell/index.html` — 검수 진입점
- `production-shell/self-check.html` — snapshot / wrapper 무결성 검사
- `production-shell/quote-check/` — main quote-check snapshot + v41 handoff
- `production-shell/quote-compare/` — main quote-compare snapshot + app-v21 + v41 production adapter
- `production-shell/SNAPSHOT-MANIFEST.json` — 기준 commit / blob SHA / 저장키 manifest

## wrapper 동작

wrapper는 pinned HTML을 `fetch()`한 뒤 다음 두 asset 경로만 snapshot-local 경로로 바꿉니다.

- `site-v21-bundle.css` → `../snapshot-assets/site-v21-bundle.css`
- `app-v21-bundle.js` → `../snapshot-assets/app-v21-bundle.js`

quote-check wrapper는 app-v21 뒤에 `../../assets/quote-check-handoff-v41.js`를 추가합니다.

quote-compare wrapper는 app-v21 뒤에 `../../assets/quote-compare-production-adapter-v41.js`를 추가합니다. 따라서 기존 v5/v6 복원 후 review-only 상태가 마지막으로 적용됩니다.

quote-check / quote-compare 사이의 기존 주요 링크는 production-shell 내부 상대 경로로 바꿉니다.

## self-check

`production-shell/self-check.html`은 HTTPS 프리뷰에서 Web Crypto SHA-1을 사용해 Git blob hash를 직접 계산합니다.

검사 항목:

1. manifest main commit 일치
2. pinned quote-check HTML Git blob SHA 일치
3. pinned quote-compare HTML Git blob SHA 일치
4. pinned site-v21 CSS Git blob SHA 일치
5. pinned app-v21 JS Git blob SHA 일치
6. quote-check `data-qrow` 12개
7. quote-check `data-context` 6개
8. quote-check `data-quote-report` 존재
9. quote-compare `data-compare-row` 12개
10. quote-compare `data-save-compare` 존재
11. quote-check snapshot CSS rewrite marker
12. quote-check handoff injection marker
13. quote-compare app-v21 local rewrite marker
14. quote-compare adapter injection marker
15. app-v21 → adapter 로드 순서

외부 프리뷰가 생기면 먼저 self-check 전체 PASS를 확인한 뒤 실제 handoff 클릭 검수를 시작합니다.

## 운영 격리

review-only 저장키:

- `interior-quote-source-v41`
- `interior-quote-compare-handoff-v41`
- `interior-quote-compare-shell-v41`

검수 adapter가 변경하지 않도록 보호한 기존 저장키:

- `interior-quote-v5`
- `interior-compare-v5`
- `interior-compare-v6`

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
