# Preview readiness — 2026-09-07

## Implemented

- Fuel collection failure, including missing OPINET_API_KEY, now marks the retained snapshot stale. No snapshot exits with failure. Error logs do not print request URLs or provider error bodies.
- The catalog build checks snapshot age and collection status independently of the stored stale flag. Cost pages display the date of the price used and delayed-refresh status; browser date checks prevent an old build remaining visually current indefinitely.
- Fuel refresh explicitly dispatches preview validation/build, since commits made with GITHUB_TOKEN do not trigger push workflows. The Grandeur calculator reads the shared catalog prices and date instead of embedded constants.
- `/cars/` contains six reviewed model links and licensed photos in its initial HTML. The fallback disappears only after the consumer catalog successfully renders. Existing 592 families and 4,203 source records are preserved.
- Added `/tools/`, `/tools/car-tax/`, `/tools/fuel-cost/`, `/tools/ev-charge-cost/`. Existing annual-cost stays available. All four tools have visible FAQs. Fuel tool can accept manual prices with no snapshot or failed fetch; EV unit price has no invented default.
- Added `/guide/` and six guides with worked examples, limits, official source links and related tools. Article counts are not treated as an AdSense approval threshold.
- Added home WebSite/Organization, comparison WebPage/BreadcrumbList, ranking ItemList/BreadcrumbList and utility page metadata. Existing vehicle schema remains. No FAQ rich-result claim is made.
- Existing `/terms/` is retained; no duplicate disclaimer or VIN banner was introduced.

## Validation

- `fuel-cost-regression-qa.mjs`: real collector subprocess fixtures for no key, no snapshot, failed request, successful recovery; standard tax brackets, half-year age reduction, EV and invalid numeric input.
- `launch-readiness-ui-qa.mjs`: no-JS catalogue, failed catalogue fetch, calculator outputs/manual fallback, 375/390/430/1280 widths, structured data and guide links.
- Existing data, copy, media, mobile, catalog, manufacturer, universal-family and comparison suites remain required by Actions.

## Still required

- Repository secret `OPINET_API_KEY` was not registered when checked. Stale prices remain usable with explicit labels; successful live collection cannot be claimed until a valid key is configured and collection succeeds.
- Manufacturer and generation evidence must be completed before promoting more popular models. The 39 reviewed family identities are not equivalent to 39 complete manufacturer-spec pages. SUV ranking is still deferred because explicit body-style coverage is only three families.
- A final domain, canonical migration and opening indexing require separate authorization. Preview remains noindex.
