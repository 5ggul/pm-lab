# Interior v41 hosted QA result

Executed: 2026-09-18

This records the latest full external non-production HTTPS browser execution completed before the documentation consolidation commit.

- PR: #201 (Draft)
- branch: `interior-v40-preview`
- tested head: `50268b936e2ef62b9d505504722b3bdf96c42cac`
- verified main: `2fa0d48fc4a13f1401a319e3690b3122fa06da97`
- Actions run: `35311537581`
- automatic hosted probes: **109 / 109 PASS**
- browser runner assertions: **110 PASS / 0 FAIL**
- uncaught page errors: **0**
- HTTPS origin: ephemeral Cloudflare Quick Tunnel; terminated at job cleanup

## Automatic probes

- self-check: 58 / 58 PASS
- failure probe: 8 / 8 PASS
- writer concurrency: 7 / 7 PASS
- pending recovery: 9 / 9 PASS
- stale / invalid transfer: 9 / 9 PASS
- robustness: 18 / 18 PASS

## End-to-end browser flow

- A → B → C handoff/apply PASS
- quote payload absent from URL PASS
- explicit preview before Apply PASS
- A/B/C review state + rich metadata persistence PASS
- refresh / revisit / new-tab restore PASS
- native two-tab storage-event stale-preview invalidation PASS
- stale cleanup preserves newer transfer PASS
- mobile widths 360 / 375 / 390 / 430 PASS
- quote-check action target >= 44 px PASS
- mobile page overflow checks PASS
- production-named storage baseline unchanged PASS
- exact values for `interior-quote-v5`, `interior-compare-v5`, `interior-compare-v6` unchanged PASS

## Main snapshot boundary

At execution time current main was `2fa0d48fc4a13f1401a319e3690b3122fa06da97`. The four pinned production blobs remained exact matches to the recorded blob SHAs, so the snapshot was not recaptured.

The follow-up documentation consolidation changes only QA documentation/handoff notes. The branch push workflow reruns automatically; production-shell runtime assets remain unchanged unless a later commit explicitly modifies them.

Hosted PASS does not authorize Ready-for-review transition, merge, or production deployment.
