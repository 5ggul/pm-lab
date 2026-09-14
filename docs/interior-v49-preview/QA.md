# Interior v49 QA

## Required checks

- actual `quote-review-report/index.html` auto-loads v48 and v49 APIs
- baseline starts absent
- `현재 상태를 검수 기준으로 저장` creates only `interior-review-baseline-v49`
- baseline stores presence/length/hash, not tracked plaintext
- no source changes immediately after baseline save
- reload restores clean baseline state
- quote content change is detected
- contract reflection deletion is detected
- review progress content change is detected
- change summary does not expose tracked source values
- print media keeps v49 status but hides actions
- 390x844 mobile has no document-level horizontal overflow
- deleting baseline clears only `interior-review-baseline-v49`
- browser console/runtime errors: none

## Tracked source keys

- `interior-quote-v5`
- `interior-compare-v5`
- `interior-compare-v6`
- `interior-review-progress-v46`
- `interior-contract-reflection-v48`

## Non-goals

v49 does not judge price fairness, contractor quality, contract validity, or legal effect.
