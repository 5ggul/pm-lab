# Trend Engine v1.1

Popularity = current absolute CCU. Trending = recent momentum adjusted for scale and data quality. They are separate rankings.

Active components (internal interest is disabled until real unique-actor data exists):
- absolute momentum 30%
- relative growth 25%
- baseline strength 15%
- data coverage 10%
- update freshness 10%
- internal interest 10% later

When interest is disabled, the active 90% is re-normalized to 100%.

## Robustness
- Baseline/recent use median rather than one point.
- Relative denominator uses `max(baseline, 500)`.
- Relative growth is clipped before mapping to a component score.
- Baseline strength uses `log1p` so scale matters without letting the largest game always win.
- Production rollup cadence is declared explicitly as 60 minutes. The QA historical fixture declares its 360-minute cadence separately.
- Coverage uses expected time slots across the observed span, not merely `non-null rows / returned rows`. If an hourly collector misses rows entirely, those missing hours reduce coverage.
- Coverage below 70% or fewer than 8 valid points is not eligible.
- Historical chart segments break when the gap between adjacent observations exceeds 1.5× the declared cadence.
- Component scores, confidence and `calculation_version=trend_v1_1` are stored with total score.

## Why v1.1
The original `trend_v1` counted rows that happened to be returned. That worked for explicit NULL samples but could overstate confidence when an ingestion failure omitted a row entirely. `trend_v1_1` fixes that semantics and therefore uses a new calculation version instead of rewriting the meaning of old scores.

The UI exposes methodology and a plain-language reason. Bot refreshes are not part of Sprint 01. Future internal interest must use unique actor/session caps and bot filtering, not raw pageviews.
