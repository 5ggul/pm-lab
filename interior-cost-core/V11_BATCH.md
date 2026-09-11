# Interior v11 data-engine batch

## Goal

Turn the preview from a static cost-information product into a data product that becomes more useful only when real anonymous quote coverage grows.

## Public invariants

- Raw quote rows are never written to `docs/interior-cost-preview`.
- Name, phone, email, detailed address, vendor/company identifiers, bank data and signatures are not accepted by the public quote schema.
- Overall private-quote price distribution requires N >= 30.
- Segment price distribution requires N >= 20 per exact cell.
- Region × pyeong pages are publication candidates only when the exact cell itself passes N >= 20.
- Mean is not published. Published distributions use P25 / median / P75.
- Public construction unit costs are REFERENCE data and are never converted into a private apartment market average or fair-price judgment.
- The official-source watcher detects new publication periods but does not automatically overwrite numeric values.
- Preview remains `noindex`; production robots/domain changes require owner approval.

## v11 outputs

- `data/quote-coverage-v11.json`
- `data/data-gap-priorities-v11.json`
- `data/source-freshness-v11.json`
- `data/quote-ops-contract-v11.json`
- `data/answer-index-v11.json`
- `data/site-quality-v11.json`
- `data/launch-gate-v11.json`
- `/quote-intake/`
- `/data/coverage/`
- `/data/data-gaps/`
- `/data/source-freshness/`
- `/data/quote-operations/`
- `/data/answers-v11/`
- `/data/launch-gate-v11/`

## Private operator flow

1. Collect anonymous rows locally in the browser and export CSV.
2. Keep the CSV outside the public repository.
3. Audit it with `audit-quote-dataset-v11.mjs`.
4. Pass the private path through `INTERIOR_QUOTE_DATASET` when generating aggregates.
5. Publish aggregate JSON and coverage only.
6. Let the exact N gates decide whether price statistics or region × pyeong pages can open.

## Official-source watch

`.github/workflows/interior-v11-source-watch.yml` checks KICT cost-index, CAK wage and CODIL standard-market-cost publication periods. A newly detected period updates the watcher state and triggers preview regeneration. Numeric values still require source verification before being changed.
