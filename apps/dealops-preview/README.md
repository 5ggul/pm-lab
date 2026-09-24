# DealOps permanent Cloudflare deployment 0.7.0

Live service: `https://dealops-preview.obvious-chive.workers.dev`. Existing administrator and D1 data are preserved. Daangn publishing remains manual-only.

The reproducible runtime source is stored as a SHA-256-verified xz JSON capsule in `.transfer/` (22 UTF-8 files). Capsule SHA-256: `b1c2cf2105228513687ac7b169cc11856b9ea5527fc7d8e2c16c43d3d7a6dcd8`.

## Official price candidate collector

Version 0.7.0 uses only the Korean Consumer Agency `???` household-goods price file published through the Public Data Portal. The source page and download host are allowlisted, the latest survey date is selected, and datasets older than 45 days are rejected. Up to 12 varied candidates are retained per run.

Automatic collection creates **review candidates only**: `sourceChecked=false`, no draft, no approval, no publication. The operator must confirm the current store price, stock and promotion conditions before DealOps allows a draft. Earlier auto-created KCA drafts with no human edit/approval/publication were migrated back to the unverified `NEW` state.

The scheduled GitHub Actions collector runs at 08:20 KST and sends the bounded official-data payload to the Worker through a dedicated secret. No signed-in retailer pages are scraped. AI remains disabled.

The v0.6.6 factual Korean copy rules remain active: price, option, exclusion and condition statements are declarative; real member experience is used only with source/consent checks.
