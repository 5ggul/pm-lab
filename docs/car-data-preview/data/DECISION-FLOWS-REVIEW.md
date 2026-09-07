# Decision flows — 2026-09-07

## Scope
- Ten manufacturer model pages put calculation before long specification tables. A first-screen link opens the calculator; selected efficiency and tax update together.
- Five additional fixed-specification comparisons: Sportage/Tucson gasoline and Santa Fe, Tucson, Sportage, Palisade gasoline/hybrid. Together with five existing comparisons, ten static comparison URLs are available. Variant IDs, model-year differences, common seating conditions and manufacturer source links are explicit. No historical KEA generation joins are inferred.
- The hybrid payback calculator covers seven pairs. Vehicle price difference must be entered. The formula holds first-year new-car tax, fuel price and annual distance constant; age reduction, depreciation, insurance and financing are not modeled. Missing, zero/negative savings and zero/negative purchase premiums are handled separately. Inputs are shareable through the URL.

## Recall corrections and evidence
Five existing notices were re-read on the official Automobile Recall Center detail endpoint using its documented page form, `POST /ri/stat/detail.do` with `recallId` and `ctype=O`. Source content SHA-256 and those form parameters are retained in `recalls.json`.

| Official ID | Scope |
| --- | --- |
| 6372 | EV6 PE GT; published 2026-08-27, remedy starts 2026-08-31; 2024-11-18 through 2026-03-17 production |
| 6371 | Ioniq5 N and five other specified Hyundai/Genesis EVs; separate production ranges per model |
| 6348 | Grandeur and four Genesis models; crossover-pipe nut tightening and replacement on leakage |
| 6353 | Avante CN7 PE HEV / Grandeur GN7 HEV; HPCU software, with already-remedied vehicle exception |
| 6351 | K8 / Carnival; crossover-pipe nut tightening and replacement on leakage |

Previous snapshot dates were remedy start dates, not publication dates. The detail pages now distinguish them. Vague engine-nut descriptions were replaced with official component names and model-specific production ranges. Existing IDs resolve to stable new pages. The recall index includes all five notices without JavaScript, then filters in the browser. This remains a selected five-notice snapshot, not a complete recall feed or VIN eligibility service.

## Verification
New `decision-flows-qa.mjs` checks all routes at 375/390/430/1280px, calculator access on ten models, selected-summary synchronization, seven payback pairs, persisted inputs, zero/negative cases, five static recall pages, official lookup form identifiers and old query URLs. Independent math examples check a three-year recovery and non-recovery cases. Existing data and UI regression suites remain required.

Production domain, indexing and AdSense application were not changed. No page-count or approval score is claimed.
