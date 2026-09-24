# DealOps permanent Cloudflare deployment 0.7.1

Live service: `https://dealops-preview.obvious-chive.workers.dev`. Existing administrator and D1 data are preserved. Daangn publishing remains manual-only.

The reproducible runtime source is stored as a SHA-256-verified xz JSON capsule in `.transfer/` (22 UTF-8 files). Capsule SHA-256: `7b9f6b46a0e1aaa6e276d3ab93db705a308f512cad9b0d8157f603b4505211b2`.

## Official price candidate collector

Version 0.7.1 uses only the Korean Consumer Agency `참가격` household-goods price file published through the Public Data Portal. The source page and download host are allowlisted, the latest survey date is selected, and datasets older than 45 days are rejected. Up to 12 varied candidates are retained per run. Product names and trailing package specifications are stored separately so the review screen does not duplicate the size in the title.

Automatic collection creates **review candidates only**: `sourceChecked=false`, no draft, no approval, no publication. The operator must confirm the current store price, stock and promotion conditions before DealOps allows a draft. Product names and package-size variants are split so the UI does not repeat the same specification, and official store-survey candidates never claim free shipping.

The scheduled GitHub Actions collector runs at 08:20 KST and sends the bounded official-data payload to the Worker through a dedicated secret. No signed-in retailer pages are scraped. AI remains disabled.

The v0.6.6 factual Korean copy rules remain active: price, option, exclusion and condition statements are declarative; real member experience is used only with source/consent checks. The live UI now reports the real Cloudflare D1 storage and collector status instead of stale placeholder text.
