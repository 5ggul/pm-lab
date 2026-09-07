# Cloudflare collection clock

The native clock is deployed with a ten-minute schedule. Provider secrets have been installed in `airport-now-preview-core`; the encrypted transfer artifact and local ephemeral private key were deleted. Automatic-run verification is in progress, so the existing GitHub schedule has not yet been removed.

## Operation

- `airport-now-collector-clock` has no public endpoint and calls the existing core through an internal service binding.
- Four flight sources and fifteen individual METAR targets run independently, at most six at once. Each failed target gets one retry except terminal authorization/configuration errors. Core acquisition retains its bounded source retry and lease protection.
- Provider keys live in core Worker Secrets. Clock requests contain only the target, scheduled run ID, and internal authorization.
- Each completed source is recorded in D1 with a `cron.<scheduled timestamp>` run ID. Successful fetching does not mean every METAR observation is fresh: old observations remain excluded.

## Acceptance

Two real scheduled executions ten minutes apart must succeed before retiring the GitHub scheduled collector. Manual GitHub recovery remains available. Use the remote `collection_runs` records to confirm source outcomes; trigger configuration alone is insufficient evidence.

`GET /api/status` exposes `nativeCron.monitoringSince` and separate 72-hour and 168-hour windows. `windowComplete: false` and `meetsTarget: null` mean there is not yet enough elapsed observation time. These windows use only native scheduled flight completions, so manual recovery cannot disguise a broken native collector. Existing total coverage remains available separately.

The target is at least 99% time-weighted fresh coverage for all four flight sources. Do not unlock indexing based on a few successful runs. Public pages remain noindex.

## Rollback

Set the clock trigger list to empty and redeploy `wrangler.clock.jsonc`. Keep or restore the GitHub schedule while investigating. Do not remove stored history or relax the 30-minute stale-data checks.

## Approved credential migration

The user explicitly approved the encrypted temporary GitHub artifact transfer on 2026-09-07. Run 34082260869 completed successfully. RSA-OAEP-SHA256 wrapped an AES-256-GCM key; plaintext was decrypted in memory and sent to Wrangler through stdin. Two source secrets were installed. GitHub artifact 10004055479 and the ephemeral local private key were deleted. The temporary transfer workflow was restored to the original collector before final integration.
