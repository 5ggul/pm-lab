# Cafe copy remediation — 0.6.2 (not deployed)

The owner rejected the v0.6.1 scripts as robotic. Confirmed source problems: createDraft appends calculation/audit disclaimers to every public post; review text is introduced with internal self-report/purchase-verification terminology; the configured AI editor only picks preset variants and rearranges them; there is no direct draft editing UI.

The revised source is being validated separately from the claimed service. Do not provision another account, reset D1, create a QA administrator, or reuse expired preview credentials. No production change is authorized by a passing source test alone.

Remediation contract:
- Public copy contains useful price, eligibility, shipping, date and attributable experience; audit limitations stay in a non-copyable operator panel.
- No fabricated purchase, visit, child, household, popularity, price-history or usage claims.
- An optional new AI writer composes supported paragraphs instead of selecting phrases. Server-owned monetary/quantity slots and immutable restrictions, disclosure, dates, links and quotations are retained. This is not a semantic truth guarantee; human approval remains mandatory.
- Direct operator draft editing saves the prior text and invalidates approval.
- Existing drafts change only after explicit rewrite; existing published posts are never overwritten by this shortcut.
- Baseline drafts are labelled as basic drafts, not AI-written or ready-to-publish copy.

Local v0.6.2 evidence: 174/174 Node domain/server/Cloudflare-adapter tests; 9 isolated Chromium rendering/UI checks at 360/390/768/1440 widths. Browser checks use an in-memory local test store, not the owner's live session. External AI requests are mocked; actual model prose quality remains untested until a key is connected.

Next release gate: confirm permanent Cloudflare deployment credentials and non-destructive build/deploy. The current live URL remains https://dealops-preview.obvious-chive.workers.dev until such a deployment is verified.
