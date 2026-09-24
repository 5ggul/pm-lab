# DealOps permanent Cloudflare deployment 0.7.1

Live service: `https://dealops-preview.obvious-chive.workers.dev`. Existing administrator and D1 data are preserved. Daangn publishing remains manual-only.

The reproducible runtime source is stored as a SHA-256-verified xz JSON capsule in `.transfer/` (22 UTF-8 files). Capsule SHA-256: `b8033b24cd54946e97d27cc7cbfdcd82c74898d263ce309d7f0c5575bc4b3911`.

## Official price candidate collector

Version 0.7.1 uses only the Korean Consumer Agency `참가격` household-goods price file published through the Public Data Portal. The source page and download host are allowlisted, the latest survey date is selected, and datasets older than 45 days are rejected. Up to 12 varied candidates are retained per run. Product names and trailing package specifications are stored separately so the review screen does not duplicate the size in the title.

Automatic collection creates **review candidates only**: `sourceChecked=false`, no draft, no approval, no publication. The operator must confirm the current store price, stock and promotion conditions before DealOps allows a draft. Official store-survey candidates never claim free shipping.

The authoritative scheduler is the owner PC's Windows Task Scheduler. It runs the local collector at 08:20 KST and again at logon only when that day's successful run is missing. This local route was chosen after verified cloud-origin connection failures to `data.go.kr`; the same source loaded normally from the local Korean connection. Cloudflare only receives the bounded JSON payload and stores it in D1. GitHub Actions is health-check only. No signed-in retailer pages are scraped. AI remains disabled.

The v0.6.6 factual Korean copy rules remain active: price, option, exclusion and condition statements are declarative; real member experience is used only with source/consent checks. The live UI reports Cloudflare D1 storage and collector status.
