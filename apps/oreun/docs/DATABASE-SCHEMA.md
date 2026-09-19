# Database Schema Notes

Canonical migration: `supabase/migrations/20260918_r1_data_foundation.sql`.

## Identity
`games.universe_id` is the primary identity. `root_place_id` is a distinct launch place. `canonical_slug` is SEO presentation only. Renames are preserved in `game_slug_history`; old slugs should 301 to the current canonical slug.

## Provenance
`data_sources` identifies provider/endpoint/stability/purge group. `ingestion_runs` records run counts, latency, rate limits and errors. Current state, snapshots and flags reference those IDs.

## Time series
`game_snapshots` has `(universe_id,captured_at)` PK. Hourly/daily rollups include sample and coverage counts. Missing samples remain missing.

## Search
`pg_trgm` index on `normalized_alias` supports fuzzy lookup; a B-tree pattern index supports prefix. Ranking logic still explicitly prioritizes exact canonical → exact alias → prefix → trigram.

## RLS
Every exposed public table has RLS. Public policies exist only for user-facing read datasets. `ingestion_runs`, raw snapshots, source registry and quality flags intentionally have no anon/authenticated policy. There are no public write policies in Sprint 01.


## Collector runtime migration
Second migration: `supabase/migrations/20260919_r1_collector_runtime.sql`.

It adds:
- `collector_targets`: tier, cadence, next due time, failure state and lease
- `game_snapshots.expected_interval_minutes`
- rollup provenance/calculation version
- `r1_claim_due_games`
- `r1_persist_game_observations`
- `r1_mark_targets_failed`
- `r1_refresh_rollups`
- `r1_apply_retention`

Internal collector tables/RPCs have no anon/authenticated write access. RPC execution is revoked from PUBLIC/anon/authenticated and granted to the server role. The migration has **not** been applied to the unrelated existing Supabase project.
