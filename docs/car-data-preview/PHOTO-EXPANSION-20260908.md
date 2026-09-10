# Vehicle photo expansion — 2026-09-08

Photo coverage is 341 of 425 normalized model families. There are 335 unique credited source photographs; aliases and transmission/wheel entries can share a representative photograph. 84 families still have no approved photo. The latest pass adds Rexton Sports Khan, Musso Grand, Audi RS5 Sportback, MINI Countryman, Peugeot 2008 and 5008, Damas, Labo, Maserati MCPURA Cielo and GT2 Stradale, Ferrari 812 and 12Cilindri Spider, Aston Martin DBX707 and Valour. Exact BMW catalogue aliases now reuse the already reviewed M135i, M235i Gran Coupe and M440i Coupe photographs.

Sources are real Wikimedia Commons photographs with explicit CC BY, CC BY-SA (2.0/3.0/4.0) or CC0 permission. Source titles, creators, license links, modification notices, raw model examples and visual-review evidence are retained in `data/vehicle-image-sources.json`. The public media policy has a complete source directory. Local 320/480/960 WebP derivatives preserve each source license; shared photographs reuse the same files.

The expansion uses explicit matches, not runtime name guessing. First/second-generation Trax, early/facelift Stinger and Rexton, Veloster N, Ioniq HEV/PHEV, Nautilus FHEV and Range Rover LWB/SWB are assigned separately. A representative photograph does not claim to show every listed trim, model year or sales-market variation. No official specification or generation assignment was changed.

`data/photo-expansion-audit.json` records the current mappings and held candidates. Fiat 500, Mercedes-AMG GT-R, Volvo S60, Mercedes-Maybach GLS600, Peugeot 5008 and Lexus model families were separated or consolidated from their source model names. All 4,203 source rows and catalogue record IDs remain intact. Other held candidates include missing exact body/generation images and rejected close-up images.

Browsers now download a display-only photo index (about 453 KB versus 1.15 MB of full evidence). Script versions are refreshed, including the generic detail renderer, and its patcher recognizes versioned imports without adding duplicate scripts.

Validation covers all 341 list/detail photo mappings and credits; every one of 425 model families across pagination; distinct photo/manufacturer/model sorts at 390/1280 px; responsive layouts at 375/390/430/1280 px; missing/invalid/failed image metadata; local and remote image outages; delayed metadata without layout shift; no-JS catalogue; shared studio and family detail tests. File hashes and WebP headers are checked for all assets. Official source rows remain 4,203 and all preview pages retain noindex.

Release completion is recorded by the PR and GitHub Actions history. Final domain connection and indexing remain deferred.
