# DealOps permanent Cloudflare deployment 0.7.0

Live service: `https://dealops-preview.obvious-chive.workers.dev`. Existing administrator and D1 data are preserved. Daangn publishing remains manual-only.

The reproducible runtime source is stored as a SHA-256-verified xz JSON capsule in `.transfer/` (22 UTF-8 files). Capsule SHA-256: `671a6dcd7ae96bd8db471ae79e3733003cd75c6feb86d7ed51f4cd0f2e099d7f`.

## Official price collector

Version 0.7.0 adds an allowlisted collector for the Korean Consumer Agency `???` household-goods price file published through the Public Data Portal. It reads only the official `data.go.kr` download discovered from the dataset page, selects the latest survey date, and rejects datasets older than 45 days.

The collector imports at most 12 varied candidates per run and creates **drafts only**. It never approves a draft and never publishes to Daangn. Survey-date prices are explicitly labelled as observations that can differ from current price, stock or promotion conditions. No retailer scraping is used.

AI remains disabled. The collector credential is stored only in Cloudflare Worker secrets and GitHub Actions secrets.

Deployment on 2026-09-24 used the existing `dealops-preview` Worker and existing `dealops-preview` D1 database. A pre-deploy SQL backup was created before v0.7.0. Post-deploy health reports 0.7.0, collector configured, and the existing administrator setup remains present.
