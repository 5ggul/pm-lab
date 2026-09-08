# Vehicle photo expansion — 2026-09-08

Photo coverage increases from 50 to 343 of 592 catalogue entries (+293). There are 301 unique credited source photographs; aliases and transmission/wheel entries can share a representative photograph. 249 entries still have no approved photo. EV3 receives a clearer exterior photograph.

Sources are real Wikimedia Commons photographs with explicit CC BY, CC BY-SA (2.0/3.0/4.0) or CC0 permission. Source titles, creators, license links, modification notices, raw model examples and visual-review evidence are retained in `data/vehicle-image-sources.json`. The public media policy has a complete source directory. Local 320/480/960 WebP derivatives preserve each source license; shared photographs reuse the same files.

The expansion uses explicit matches, not runtime name guessing. First/second-generation Trax, early/facelift Stinger and Rexton, Veloster N, Ioniq HEV/PHEV, Nautilus FHEV and Range Rover LWB/SWB are assigned separately. A representative photograph does not claim to show every listed trim, model year or sales-market variation. No official specification or generation assignment was changed.

`data/photo-expansion-audit.json` records mappings and held candidates. Three existing family-normalization problems were found and deliberately receive no photograph: Fiat 500 contains Mercedes entries; Nissan GT-R contains Mercedes-AMG GT-R; Volvo S60 contains Maybach GLS600 entries. These need a separate correction of the underlying grouping, preserving original rows and stable navigation. Other held candidates include missing exact body/generation images and rejected close-up images.

Browsers now download a display-only photo index (about 453 KB versus 1.15 MB of full evidence). Script versions are refreshed, including the generic detail renderer, and its patcher recognizes versioned imports without adding duplicate scripts.

Validation: all 343 list/detail photo mappings and credits; every one of 592 entries across pagination; distinct photo/manufacturer/model sorts at 390/1280 px; responsive layouts at 375/390/430/1280 px; missing/invalid/failed image metadata; local and remote image outages; delayed metadata without layout shift; no-JS catalogue; shared studio and family detail tests. File hashes and WebP headers are checked for all assets. All 903 unique referenced derivatives decode successfully. The 81-page internal-reference audit reports no broken links. Official source rows remain 4,203 and all preview pages retain noindex.

Release completion is recorded by the PR and GitHub Actions history. Final domain connection and indexing remain deferred.
