# Meme Radar V1

Second-level Robinhood Chain meme-token radar focused on **market cap below $1M**, with the highest alert sensitivity below **$100K**.

This branch is research/preview only. It does not place trades.

## Signal policy

| Market cap | Band | Base score gate | 10s buyers | Independent smart buyers |
|---|---:|---:|---:|---:|
| `< $100K` | `PRIME_EARLY` | 60 | 3 | 1 |
| `$100K–300K` | `EARLY` | 70 | 5 | 2 |
| `$300K–600K` | `MOMENTUM` | 79 | 8 | 2 |
| `$600K–1M` | `LATE_EARLY` | 87 | 12 | 3 |
| `>= $1M` | excluded | — | — | — |

Market cap is a routing gate, not a safety score. A low market cap never overrides risk checks.

## What counts as a smart-wallet buy

The bootstrap roster is refreshed from the public FOMO Robinhood Radar leaderboard, which exposes resolved EVM wallets and its current trader score. That external score is only the starting prior. Once this radar has settled local `<$100K` outcomes, `earlyModelQuality` can override or reduce the weight of that external prior.

For the current era-2 path, a confirmed V4 Swap can reuse the matching sequencer transaction's recovered signer as the **ordinary buyer identity** without waiting for a receipt RPC. That keeps buyer-velocity measurement fast even on a rate-limited public RPC.

Smart-money credit is deliberately stricter. A smart-eligible sequencer signer receives smart credit only when the confirmed token receipt proves that the bought token was actually transferred to that signer. A generic router may send tokens to a different recipient, so signature alone is not enough. If the receipt is unavailable, the signer can still count as an ordinary buyer, but the trade remains `smart_receipt_pending` and contributes zero smart-wallet credit. Pre-confirmation alone never becomes a trade signal.

For known relayer/direct-router paths, buyer identity is recovered from the receipt token-transfer leg when possible. Direct router injections and buys below the dust threshold do not receive smart-money credit. Three or more pushed/dust smart-eligible wallets that outnumber real attributed buyers mark the token as `seeded`, which is a hard reject.

Wallet independence is not address-counting. The sequencer feed watches direct native-ETH funding transfers into tracked smart wallets, recovers the signed transaction sender, and groups wallets sharing the same meaningful funder. If one funder touches more than the configured wallet limit, it is treated as shared infrastructure and those wallets are split again rather than being collapsed into one trader. Blockscout is optional historical bootstrap only; live clustering does not depend on explorer indexing.

## Current Robinhood Chain path

V1 prioritizes the current Uniswap V4 path and keeps V2/V3 support for compatible native-ETH/WETH/USDG pairs:

1. Watch PoolManager `Initialize` for new native-ETH/token pools. Legacy V2/V3 watchers can also be enabled.
2. Recognize the current era-2 V4 launch shape (`fee=10000`, `tickSpacing=200`, zero hook).
3. Start a HoodWatch `audit --json --fast` immediately for live candidates and retry incomplete results through the two-minute propagation window.
4. Cache confirmed-transaction candidates from the sequencer before chain confirmation.
5. Watch confirmed swaps and derive buy/sell direction using the correct V4/V3/V2 sign semantics.
6. Derive ETH/USD directly from the deepest live WETH/USDG V3 pool's `slot0`; derive token market cap from pool price and token supply.
7. Ignore swaps once the token is already `>= $1M`.
8. For `<$1M`, use a recovered sequencer signer for fast ordinary buyer identity when safe; require receipt token-transfer proof before smart credit.
9. Feed 10-second rolling buyer velocity, capital velocity, imbalance, independent smart buyers, safety, and liquidity into the radar score.
10. Persist V4 pricing context so fixed-horizon outcomes can be sampled independently of later swap activity.

The Robinhood sequencer feed is subscribed in parallel. It provides pre-confirmation telemetry, fast signed buyer identity, and live direct-funder observations for tracked wallets. Final token identity, market cap, and trade accounting still come from confirmed on-chain events.

## Two-stage alert

- `PRIME WATCH`: `<$100K` + smart-wallet/buyer gates met while safety audit is still pending.
- `PRIME VERIFIED`: the same candidate after HoodWatch has returned a non-hard-fail result and the score gate is met.

Audit updates can re-evaluate active PRIME conditions without waiting for a synthetic trade. The engine still uses the live 10-second buyer window, so an audit that clears too late cannot resurrect an expired buyer burst.

## Shadow learning store

`ShadowStore` persists research data in SQLite. It records:

- every normalized `<$1M` trade used by the radar, including resolved participant source;
- every radar gate decision (`SMART_BUYERS_LOW`, `BUYER_VELOCITY_LOW`, `SECURITY_PENDING`, `SCORE_LOW`, or `SIGNAL`);
- WATCH and VERIFIED signals plus the smart wallets credited to each signal;
- live or historical funding-cluster evidence;
- every HoodWatch retry state;
- first meaningful `<$100K` wallet entries and fixed 1m / 5m / 15m / 1h / 6h outcomes.

The local learner ignores tiny dust entries and does not promote a wallet from one lucky token. Local-only discovery requires at least eight distinct sub-$100K entries with eight settled six-hour checkpoints, then still requires local quality >=70, win rate >=50%, 2x hit rate >=25%, and rug rate <=25%.

### Clock-driven V4 outcome sampler

The old outcome mechanism depended on a later trade being observed. V1 now also runs a clock-driven Uniswap V4 StateView sampler:

- stores each eligible token's V4 `poolId`, token direction, and quote metadata;
- reads current `getSlot0(poolId)` and `getLiquidity(poolId)` without requiring a new swap event;
- samples due tokens every 30 seconds by default;
- reads each token pool once per pass even when many wallets entered the same token;
- rejects zero-liquidity states;
- records `source='v4_state_view'` and `sample_lag_ms` for auditability;
- never uses a price observed far in the future as an earlier horizon result.

Default maximum lag after each target horizon is 45s at 1m, 90s at 5m, 180s at 15m, 10m at 1h, and 30m at 6h. A long-lived collector is therefore still required to capture the full horizon set reliably.

The live probe verifies the official Robinhood Chain Uniswap V4 StateView by calling `getSlot0` and `getLiquidity` against a recent real V4 pool. `npm run report:shadow` reports outcome source and sample lag in addition to buyer coverage, gate reasons, audits, funding clusters, and local-wallet learning.

## Run

```bash
cd meme-radar-core
npm install

export RH_WS_URL='wss://<production Robinhood websocket provider>'
export RH_RPC_URL='https://<production Robinhood RPC provider>'
export TELEGRAM_BOT_TOKEN='...'
export TELEGRAM_CHAT_ID='...'

npm test
npm run check
npm start
```

For real second-level operation, use a production WebSocket/RPC provider. The public Robinhood RPC is useful for development but should not be the latency-sensitive production transport. The GitHub Shadow Soak intentionally uses slower HTTP polling and disables legacy V2/V3 watchers to avoid turning public-RPC rate limits into false model conclusions.

### Optional environment variables

```text
RADAR_DB_PATH=meme-radar-shadow.sqlite
RH_POLL_MS=300
RH_BACKFILL_BLOCKS=6000
RH_DISABLE_FEED=0
RH_ENABLE_LEGACY_POOLS=1
SEQUENCER_ORIGIN_TTL_MS=120000
SEQUENCER_ORIGIN_MAX=5000
ETH_USD_CACHE_MS=15000
ETH_USD_STALE_MS=300000
HORIZON_SAMPLER_ENABLED=1
HORIZON_SAMPLE_INTERVAL_MS=30000
HORIZON_SAMPLE_MAX_TOKENS=25
EARLY_WALLET_MIN_BUY_USD=20
HOODWATCH_TIMEOUT_MS=15000
HOODWATCH_DISABLE=0
SMART_WALLET_DIRECTORY_URL=https://fomoradar.app/api/leaderboard?status=active&limit=400
WALLET_ROSTER_REFRESH_MS=600000
DUST_ABS_USD=5
DUST_RATIO=0.02
FOMO_DIRECT_ROUTERS=0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f
FUNDING_MIN_ETH=0.001
FUNDING_MAX_WALLETS_PER_FUNDER=5
FUNDING_BOOTSTRAP_BLOCKSCOUT=0
BLOCKSCOUT_API_KEY=
LOG_RADAR=0
LOG_TELEMETRY=0
```

Set `RH_ENABLE_LEGACY_POOLS=0` for a current-launchpad V4-only collector. Set `FUNDING_BOOTSTRAP_BLOCKSCOUT=1` or provide `BLOCKSCOUT_API_KEY` only when historical explorer bootstrap is wanted. Live sequencer funding observations remain active without it.

## Scoring

`Radar score = 30% wallet quality + 20% independent smart buyers + 15% buyer velocity + 10% capital velocity + 10% buy/sell imbalance + 10% safety + 5% liquidity.`

Multiple addresses in the same resolved `fundingCluster` count as one independent smart buyer.

## Still required before a 24/7 live release

- long-lived collector hosting plus durable database backup/rotation so all horizon windows can be sampled;
- enough real `<$100K` settled samples to calibrate local smart-wallet promotion, false positives, missed runners, and band thresholds;
- production Robinhood WebSocket/RPC transport, health checks, restart supervision, and alert-delivery monitoring;
- continued validation of fresh-token HoodWatch propagation and safety coverage;
- backend WebSocket/SSE fan-out if the dashboard is made live;
- Solana adapter using the same normalized event schema.

The first release should remain alerts-only until measured false-positive/false-negative rates are available.
