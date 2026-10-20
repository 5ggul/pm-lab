# Official issue source snapshots

This directory is outside `docs/car-data-preview/`, the static site's source root. Raw CSVs, row-level snapshots, alias review evidence and download manifests must not be copied into the public deployment. The browser only needs `docs/car-data-preview/data/generated/official-issues-index.json` and source-health metadata.

## Sources

- Reports: <https://www.data.go.kr/data/15016450/fileData.do>
- Historical recalls: <https://www.data.go.kr/data/3048950/fileData.do>

The collector reads each official Dataset JSON-LD distribution and downloads its public CSV without an API key. It does not bypass login, CAPTCHA or access controls. UTF-8 and EUC-KR/CP949 are supported. The initial reports CSV has 9,129 rows with observed receipt dates from 2025-01-02 to 2025-12-31. The historical recall CSV has 1,045 rows with observed recall-start dates from 2025-01-02 to 2025-12-22. A file's name or publication date is not evidence of complete coverage of that calendar year.

## Local commands

```text
node docs/car-data-preview/scripts/fetch-official-issues.mjs
node docs/car-data-preview/scripts/build-official-issues-index.mjs
node docs/car-data-preview/scripts/validate-official-issues.mjs --require-source-health
node --test docs/car-data-preview/scripts/official-issues-data.test.mjs
```

Only `fetch-official-issues.mjs` uses the network. The index build and validation are offline. An unchanged download updates the source-health check, while the public content snapshot remains stable. `official-issues-status.json` contains the latest attempted/successful checks; `index.sources.*.checked_at` refers to the verified content snapshot.

## Integrity and replacement

- `source-manifest.json` points to immutable `raw/{kind}-{sha256}.csv` files. The collector validates and writes a new raw file before atomically replacing the manifest pointer.
- Each file is a replacement snapshot, never an append-only event feed. Same-valued four-field report rows remain separate source records because the source has no stable report ID.
- Missing or malformed rows stay in held-row accounting. Unreviewed maker/model names stay unmatched. Do not guess generation, engine, vehicle ownership, confirmed defect, failure rate or missing-history conclusions.
- Exact reviewed maker/model aliases are maintained in `aliases-reviewed.json`. Initial review covers six named families; other families explicitly remain unmapped.
- Automatic replacement stops if valid-row coverage falls below 95%, the row count drops more than 25%, increases more than fourfold, or the observed end date regresses. The previous good raw pointer and public aggregate remain available.
- An intentionally changed source scope may be approved in `sources.json` under the relevant source as `reviewed_snapshot_exceptions: [{"sha256":"...","reviewed_at":"YYYY-MM-DD","evidence":"specific scope review evidence"}]`. The exception applies only to that exact content hash and cannot bypass the 95% valid-row requirement.
- Offline builds fail without replacing the previous available public index if its source manifest or raw snapshot is missing or corrupted.

The aggregate is a record count within the published file and reviewed model-name mapping. It is neither a defect finding nor a vehicle reliability ranking. Current recall-center notices remain a separate source from this annual historical file.
