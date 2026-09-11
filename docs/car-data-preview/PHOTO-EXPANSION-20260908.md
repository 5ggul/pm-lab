# Vehicle photo expansion — 2026-09-08

Photo coverage is 368 of 423 normalized model families. There are 359 unique credited source photographs; aliases and transmission/wheel entries can share a representative photograph. 55 families still have no approved photo. The latest pass consolidates CEVO-C, CEVO-C SE and its one-seat van under one product family, preserves legacy links, and adds a people-free Foton Tunland P201 photograph.

Sources are real Wikimedia Commons photographs with explicit CC BY, CC BY-SA (2.0/3.0/4.0) or CC0 permission. Source titles, creators, license links, modification notices, raw model examples and visual-review evidence are retained in `data/vehicle-image-sources.json`. The public media policy has a complete source directory. Local 320/480/960 WebP derivatives preserve each source license; shared photographs reuse the same files.

The expansion uses explicit matches, not runtime name guessing. First/second-generation Trax, early/facelift Stinger and Rexton, Veloster N, Ioniq HEV/PHEV, Nautilus FHEV and Range Rover LWB/SWB are assigned separately. A representative photograph does not claim to show every listed trim, model year or sales-market variation. No official specification or generation assignment was changed.

`data/photo-expansion-audit.json` records the current mappings and held candidates. All 4,203 source rows and catalogue record IDs remain intact. The CEVO maker history is normalized to 쎄보모빌리티 while its C, C SE and one-seat van source rows remain separately visible inside the family detail.

Browsers now download a display-only photo index (about 453 KB versus 1.15 MB of full evidence). Script versions are refreshed, including the generic detail renderer, and its patcher recognizes versioned imports without adding duplicate scripts.

Validation covers all 368 list/detail photo mappings and credits; every one of 423 model families across pagination; distinct photo/manufacturer/model sorts at 390/1280 px; responsive layouts at 375/390/430/1280 px; missing/invalid/failed image metadata; local and remote image outages; delayed metadata without layout shift; no-JS catalogue; shared studio and family detail tests. File hashes and WebP headers are checked for all assets. Official source rows remain 4,203 and all preview pages retain noindex.

Release completion is recorded by the PR and GitHub Actions history. Final domain connection and indexing remain deferred.

