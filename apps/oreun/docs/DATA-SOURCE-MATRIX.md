# Data Source Matrix

| Field / Feature | Class | Provider | Endpoint / Source | Freshness target | Cache | Retention | Fallback |
|---|---|---|---|---:|---:|---|---|
| universe_id | ROBLOX_PUBLIC_API | Roblox Public Games | `games.roblox.com/v1/games` | identity | 24h | entity lifetime | verified seed identity only |
| root_place_id | ROBLOX_PUBLIC_API | Roblox Public Games | `/v1/games` | identity | 24h | entity lifetime | verified seed identity only |
| name/description/creator | ROBLOX_PUBLIC_API | Roblox Public Games | `/v1/games` | 30m | 5–30m | current + provenance | last normal response + stale label |
| playing | ROBLOX_PUBLIC_API | Roblox Public Games | `/v1/games` | tier 5–120m | ≤ cadence | raw 7d / rollups | last snapshot + delayed/stale label |
| visits/favorites | ROBLOX_PUBLIC_API | Roblox Public Games | `/v1/games` | 30–120m | ≤ cadence | rollups long term | last snapshot |
| Korean name | R1_EDITORIAL | Oreun | editorial table | manual | long | entity lifetime | English name |
| aliases | R1_EDITORIAL | Oreun | game_aliases | manual | long | entity lifetime | canonical names |
| 1H/24H/7D change | R1_DERIVED | Oreun | snapshot/rollup | after each rollup | 1–5m | derived can recompute | `데이터 수집 중` |
| Historical chart | R1_DERIVED | Oreun | snapshots + rollups | collector cadence | 1–5m | raw/hourly/daily | gap, never zero-fill |
| Popularity | R1_DERIVED | Oreun | current playing sort | 5m | 1–5m | not required | unavailable games last |
| Trending | R1_DERIVED | Oreun | Trend Engine v1 | 5–15m | 5m | versioned score | exclude insufficient coverage |
| update freshness component | ROBLOX_PUBLIC_API + R1_DERIVED | Roblox Public Games/Oreun | upstream `updated` + calculation | 30m | 30m | trend payload | component 0 if unknown |
| internal interest | R1_DERIVED | Oreun | future unique actor/session events | Sprint 02+ | n/a | bounded | disabled and weights renormalized |
| Community data | OFFICIAL_OPEN_CLOUD | future CommunityProvider | Group/Forum Open Cloud | Sprint 05 | TBD | TBD | feature off |
| codes/guides/Q&A | R1_EDITORIAL / COMMUNITY_UGC | future | Sprint 02–03 | content specific | n/a | content policy | not rendered Sprint 01 |

## Stability classes
`games.roblox.com/v1/games` is documented in Roblox Creator Hub as a Cookie None public universe details endpoint, but it is not treated as equivalent to Open Cloud stability guarantees. It stays behind an Adapter. Open Cloud API Key/OAuth endpoints are preferred whenever a suitable stable endpoint is available.

## Provenance minimum
Every Roblox-derived stored row must be traceable to `data_source_id`, `ingestion_run_id`, `fetched_at/captured_at`, and raw/derived class. `purge_group` allows selective deletion if a source becomes unavailable or policy requires deletion.
