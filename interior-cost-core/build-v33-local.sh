#!/usr/bin/env bash
set -euo pipefail
node interior-cost-core/run-generate-v5.mjs
node interior-cost-core/postprocess-review-date.mjs
node interior-cost-core/enhance-v22-editorial-matrix.mjs
node interior-cost-core/enhance-v23-insulation-reference.mjs
node interior-cost-core/enhance-v23-insulation-postfix.mjs
node interior-cost-core/enhance-v22-quote-lines.mjs
node interior-cost-core/enhance-v23-quote-import.mjs
node interior-cost-core/validate-v24-integration.mjs
node interior-cost-core/enhance-v25-release-ready.mjs
node interior-cost-core/enhance-v25-meta-final.mjs
node interior-cost-core/validate-v25-release-ready.mjs
node interior-cost-core/enhance-v26-public-launch-quality.mjs
node interior-cost-core/enhance-v26-p0-postfix.mjs
node interior-cost-core/validate-v26-public-launch-quality.mjs
node interior-cost-core/enhance-v27-senior-task-first.mjs
node interior-cost-core/enhance-v27-postfix.mjs
node interior-cost-core/validate-v27-senior-task-first.mjs
node interior-cost-core/enhance-v28-ohou-service-ui.mjs
node interior-cost-core/validate-v28-ohou-service-ui.mjs
node interior-cost-core/enhance-v28-refine.mjs
node interior-cost-core/validate-v28-refine.mjs
cp interior-cost-core/data/g2b-priceinfo-v29-summary.json docs/interior-cost-preview/data/
cp interior-cost-core/data/g2b-priceinfo-v29-interior.json docs/interior-cost-preview/data/
node interior-cost-core/enhance-v29-price-data-ui.mjs
node interior-cost-core/validate-v29-price-data-ui.mjs
node interior-cost-core/enhance-v31-light-service.mjs
node interior-cost-core/validate-v31-light-service.mjs
node interior-cost-core/run-v33-stratton-visual-local.mjs
node interior-cost-core/validate-v33-stratton-visual.mjs