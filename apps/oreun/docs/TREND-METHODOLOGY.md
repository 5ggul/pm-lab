# Trend Engine v1

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
- Coverage below 70% or fewer than 8 valid points is not eligible.
- Component scores, confidence and `calculation_version=trend_v1` are stored with total score.

The UI exposes methodology and a plain-language reason. Bot refreshes are not part of Sprint 01. Future internal interest must use unique actor/session caps and bot filtering, not raw pageviews.
