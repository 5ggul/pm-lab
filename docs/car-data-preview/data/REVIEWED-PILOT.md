# Reviewed pilot — 2026-09-06

- The shared 50-record image manifest now supplies home, all seven existing static model pages, the legacy Grandeur hybrid page, and three new comparison pages. Vehicle JSON image fields are legacy inputs; build-car-data overrides them from reviewed-static-media before generating public output.
- Six already-reviewed public model pages gained explicit sources, review dates, calculation scope and related comparisons. Avante remains excluded from the public reviewed set.
- Three comparison entry pages pin actual existing variant IDs, describe mismatched wheels/seats and hand those exact IDs to the existing calculator. No EV charging price is silently selected.
- Five damaged display names are corrected only after checking every underlying KEA model string. The explicit K7 (YG) source token corrects its generation label. IDs, 4,203 records, 592 groups and calculation eligibility are preserved. This does not merge duplicated model groups or increase the 39 fully reviewed families.
- Mobile navigation remains visible without JavaScript. Existing model-lite code no longer hides its entire navigation. Photo failures have a readable fallback and source links remain available.

Validation: family rebuild and coherence checks; preview data validators; all five existing browser suites; reviewed-pilot-ui-qa across 375/390/430/1280 widths. Separate unmocked network audit loaded 50/50 photos. The deterministic UI suites use photo fixtures and do not assert external server availability.

Remaining: 542 groups have no reviewed photo; 576 have no manufacturer dimensions; duplicated models and unverified generations remain in the broader catalogue. No production deployment or indexing change is included.
