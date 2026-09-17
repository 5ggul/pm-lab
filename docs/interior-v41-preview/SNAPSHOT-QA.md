# Interior v41 pinned production-shell snapshot QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

현재 main HEAD: `50821ea293e17f709d28164f6873b3c19e279bef` (2026-09-17)

초기 interior snapshot 캡처 기준: `26b8f66b14316743e3bfaff73912a5b15901c48c`

`26b8f66..50821ea` 사이 2커밋에서 변경된 파일은 `docs/franchise-ssg-preview/production-candidate-contract-test.json` 1개뿐이며, 아래 인테리어 HTML/CSS/JS blob은 현재 main에서도 동일합니다.

## 목적

외부 비운영 프리뷰 승인이 나기 전에도 실제 main quote-check / quote-compare UI와 동일한 HTML/CSS/JS를 v41 검수 폴더에 고정해 둡니다. 이후 main이 다른 프로젝트 자동 갱신으로 움직여도 pinned interior blob 자체가 바뀌었는지를 별도로 확인할 수 있습니다.

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
- `production-shell/self-check.html` — snapshot / wrapper / storage guard 무결성 검사
- `production-shell/storage-inspector.html` — 운영 이름 저장키 기준점/해시 비교 + review-only 키 삭제
- `production-shell/quote-check/` — main quote-check snapshot + v41 handoff
- `production-shell/quote-compare/` — main quote-compare snapshot + app-v21 + v41 production adapter
- `production-shell/SNAPSHOT-MANIFEST.json` — 현재 main commit / blob SHA / 저장키 manifest

## wrapper 동작

wrapper는 pinned HTML을 `fetch()`한 뒤 다음 두 asset 경로만 snapshot-local 경로로 바꿉니다.

- `site-v21-bundle.css` → `../snapshot-assets/site-v21-bundle.css`
- `app-v21-bundle.js` → `../snapshot-assets/app-v21-bundle.js`

quote-check wrapper는 app-v21 뒤에 `../../assets/quote-check-handoff-v41.js`를 추가합니다.

quote-compare wrapper는 app-v21 뒤에 `../../assets/quote-compare-production-adapter-v41.js`를 추가합니다. 따라서 기존 v5/v6 복원 후 review-only 상태가 마지막으로 적용됩니다.

quote-check / quote-compare 사이의 주요 링크는 production-shell 내부 상대 경로로 바꿉니다.

## 저장키 격리 보강

production-shell quote-check는 원본 app-v21을 실행하므로 원본 `브라우저에 저장` / `초기화` 버튼이 preview origin의 `interior-quote-v5`를 변경할 수 있었습니다.

조치:

- production-shell 경로에서 `[data-save-quote]`, `[data-reset-quote]` capture 차단
- CSV / 복사 / 인쇄는 유지
- compare 쪽은 기존 adapter의 `guardProductionButtons()`로 `interior-compare-v5/v6` 저장/초기화 차단 유지
- 운영 이름 저장키는 `storage-inspector.html`에서 읽기 전용 해시 비교만 수행
- inspector의 삭제 버튼은 review-only 키만 삭제

## self-check

`production-shell/self-check.html`은 HTTPS 프리뷰에서 Web Crypto SHA-1을 사용해 Git blob hash를 직접 계산합니다.

현재 자동 검사 항목은 **22개**입니다.

1. manifest current main commit 일치
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
16. quote-check wrapper pinned snapshot fetch path
17. quote-compare wrapper pinned snapshot fetch path
18. quote-check production storage guard 존재
19. quote-check save button guard 존재
20. quote-check reset button guard 존재
21. quote-check `../quote-compare/` 상대 이동
22. quote-compare production storage button guard 존재

외부 프리뷰가 생기면 먼저 self-check 전체 PASS를 확인한 뒤 storage 기준점을 기록하고 실제 handoff 클릭 검수를 시작합니다.

## 운영 격리

review-only 저장키:

- `interior-quote-source-v41`
- `interior-quote-compare-handoff-v41`
- `interior-quote-compare-state-v41`
- `interior-quote-compare-shell-v41`

검수 스크립트가 변경하지 않도록 보호한 운영 이름 저장키:

- `interior-quote-v5`
- `interior-compare-v5`
- `interior-compare-v6`

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
