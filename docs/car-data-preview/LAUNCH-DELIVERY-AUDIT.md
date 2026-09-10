# Launch delivery audit — 2026-09-07

This is a preview release audit, not authorization to enable indexing. The production origin remains unset and all 78 HTML pages retain noindex.

## Implemented

- The current catalogue maps 337 model families to 299 licensed source photos with responsive local WebP files. Source pages, authors, licenses, generation labels and original fallback URLs are retained. Transformations only rotate according to metadata, resize and compress; no crop or content change.
- Source thumbnails total 9,414,388 bytes. All 480px files total 1,507,068 bytes (84.0% less); the largest variant of each photo totals 5,634,616 bytes (40.1% less). One source is only 528px wide, so it is never enlarged to 960px.
- The 588-family list uses a dedicated compact index instead of loading the full detail payload. Manufacturer-detail records and all 4,203 original calculation rows remain unchanged.
- Image manifest and catalogue requests start together; Korean name collation and search text are reused.
- Local image failure retries the credited original. If both fail, the existing readable placeholder remains. Static cards and responsive photos work without JavaScript.

## Verification

`launch-delivery-audit.mjs` verifies internal href/src/srcset targets and anchors, image byte counts and SHA-256 hashes, exact compact-index fields and preview noindex. It writes `data/release-candidates.json`: 58 editorial release candidates and 20 held pages. Candidates are not a claim that every page is ready for search approval. Search, error, generic query, thin manufacturer and overlapping specification pages are held.

`delivery-optimization-ui-qa.mjs` verifies 390px/1280px layouts, local image selection when Wikimedia is unavailable, original fallback after local failure, readable failure after both sources fail, no-JS static cards and absence of the full-detail payload on the catalogue. Media QA checks every current source/vehicle mapping, all 588 unique catalogue families, credits, filters and four viewport widths.

The existing fuel regression suite verifies missing key, collection failure with last snapshot, successful refresh and no snapshot. Stored Opinet status and price snapshot agree on successful 2026-09-07 collection. The recall data remains a selected, dated set of notices, not a complete live feed.

## Mobile laboratory measurement

Local gzip HTTP server; cold Chromium cache; 390×844; 1.6Mbps down; 150ms latency; 4× CPU slowdown. Each run waits for visible images to settle. Single run on September 7, not Lighthouse scoring, INP, or real-visitor Core Web Vitals.

| Page | LCP | CLS | Transferred bytes |
| --- | ---: | ---: | ---: |
| Home | 1.46s | 0 | 106,219 |
| Vehicle list | 2.97s | 0 | 235,565 |
| Sportage | 0.98s | 0 | 82,298 |
| Hybrid break-even | 0.80s | 0 | 25,303 |

Earlier home/list measurements ended before external photos finished, so those runs cannot support a sitewide before/after speed percentage. File-size reductions above are exact byte comparisons. Catalogue LCP still merits observation after deployment; no all-green field performance claim is made.

## Maintenance and release boundary

- Build through `build-reviewed-pilot.mjs`; the final stage applies delivery optimization. Family builds also regenerate the compact index.
- Run `launch-delivery-audit.mjs` after all HTML generation. CI runs the audit and new browser failure tests before publishing generated HTML.
- Optional `optimize-reviewed-photos.mjs <family_id...>` requires Sharp and downloads only explicitly named, already reviewed sources. It stops when existing source hashes change. Normal builds and CI never depend on downloading or recompressing Wikimedia files.
- Final domain selection, production canonical/sitemap/robots, indexing and Search Console setup remain separate launch steps. No domain, contact identity or eligibility claim is invented by this change.
