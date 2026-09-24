# DealOps permanent Cloudflare deployment 0.7.0

Live service: `https://dealops-preview.obvious-chive.workers.dev`. Existing D1/admin data is preserved. Daangn publishing is manual-only.

The reproducible Worker runtime is stored as a SHA-256-verified xz JSON capsule in `.transfer/` (22 UTF-8 files). Capsule SHA-256: `5b6f8f391e21df5bd8db86fe73c6e823698de6089e123dd238807c70eeea58ca`.

## Live automation

- ?????? `??? ?? ??` (`data.go.kr` dataset 15083256) is the first automatic source. The catalog declares `?????? ?? ??`.
- A GitHub scheduler refreshes a compact snapshot from the official CSV. The Worker cron reads that snapshot daily and adds at most 32 price-reference candidates to the real workspace.
- Imported candidates are always `sourceChecked=false`. They cannot become a publishable draft until the operator opens the official source / store condition and manually reconfirms the current price.
- Old untouched imported candidates are internally expired when a newer observation arrives. Reviewed or published records are never overwritten by the collector.
- AI remains OFF. No fake reviews, no automated Daangn login/posting, no unsupported retailer scraping.

The copy engine continues the v0.6.6 factual Korean rules: price, option, exclusion and condition statements use declarative forms such as `??? ????` and `???? ????`; attributed real reviews only.
