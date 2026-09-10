# Reviewed pilot — 2026-09-06

- The shared 50-record image manifest now supplies home, all seven existing static model pages, the legacy Grandeur hybrid page, and three new comparison pages. Vehicle JSON image fields are legacy inputs; build-car-data overrides them from reviewed-static-media before generating public output.
- Six already-reviewed public model pages gained explicit sources, review dates, calculation scope and related comparisons. Avante remains excluded from the public reviewed set.
- Three comparison entry pages pin actual existing variant IDs, describe mismatched wheels/seats and hand those exact IDs to the existing calculator. No EV charging price is silently selected.
- Five damaged display names were first corrected after checking every underlying KEA model string. The later catalogue normalization consolidates high-confidence aliases while preserving all 4,203 records and 3,517 raw specification groups. Fully reviewed status remains evidence-based.
- Mobile navigation remains visible without JavaScript. Existing model-lite code no longer hides its entire navigation. Photo failures have a readable fallback and source links remain available.

Validation: family rebuild and coherence checks; preview data validators; all five existing browser suites; reviewed-pilot-ui-qa across 375/390/430/1280 widths. Separate unmocked network audit loaded 50/50 photos. The deterministic UI suites use photo fixtures and do not assert external server availability.

Current follow-up: 296 of 425 normalized vehicle families have a reviewed photo; 129 do not. Manufacturer dimensions and unverified generations remain partial. No indexing change is included.
