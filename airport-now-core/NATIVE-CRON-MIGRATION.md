# Native collection clock — prepared, not activated

Status: 2026-09-07. Local tests: 85/85. Both Worker bundles pass Wrangler dry-run. No native scheduled execution has been verified. Existing GitHub collection remains enabled.

## Prepared change

- `wrangler.clock.jsonc`: private `airport-now-collector-clock`, ten-minute Cron Trigger, internal CORE service binding.
- Four independent flight targets and fifteen METAR targets, at most six in flight, bounded retry of transient failures.
- Existing ingestion authorization, per-source leases, stale protection and history writes remain in force.
- Authenticated ingestion can resolve provider keys from native Worker Secrets. Provider keys are not included in clock requests.
- Run IDs include the real scheduled timestamp, so scheduled cadence can be distinguished from manual recovery in `collection_runs`.

## Credential transfer requiring explicit approval

Automatic approval review rejected the proposed encrypted GitHub artifact transfer. No transfer workflow was committed, pushed or dispatched. No provider credential was exported.

Proposed destination: the user's existing `airport-now-preview-core` Worker secrets `DATA_GO_KR_SERVICE_KEY` and `KMA_API_HUB_KEY`. Source: existing secrets in `5ggul/pm-lab`.

Use a temporary manual workflow on the feature branch. Encrypt the two values with AES-256-GCM and wrap the random AES key with an ephemeral RSA-3072 public key (OAEP-SHA256). Only ciphertext enters a GitHub Actions artifact, with one-day retention. The private key remains in the ignored local directory. Decrypt locally in memory and pass the values to Wrangler secret bulk through stdin, without plaintext files or logs. Delete the encrypted artifact and ephemeral key after verified installation; restore the manual collector workflow before merging.

The sensitive transfer is the encrypted artifact itself: anyone with both the artifact and private key can recover the provider keys. User approval must cover this intermediate destination, not just the final Cloudflare destination.

## Activation and acceptance

1. Install the two provider secrets and deploy core with environment-secret fallback.
2. Deploy the clock initially without triggers, install its existing ingestion token, then enable the ten-minute trigger.
3. Confirm at least two real scheduled timestamps ten minutes apart in Cloudflare and D1, with successful flight sources; report weather freshness separately from successful fetches.
4. Only then switch COLLECTOR_MODE to `cloudflare-cron-10m`, update the health indicator, and remove the GitHub scheduled trigger. Keep manual recovery available.
5. Observe time-weighted 30-minute freshness coverage for 72 hours, then seven days. Do not report these windows as passed before they elapse. Keep noindex.

Rollback: disable the clock trigger and retain/re-enable the existing GitHub collector while diagnosing the cause. Do not allow missing secrets to masquerade as completed migration.
