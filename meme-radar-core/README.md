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

The bootstrap roster is refreshed from the public FOMO Robinhood Radar leaderboard, which exposes resolved EVM wallets and its current trader score. That external score is only the starting prior. The local profile format can later override it with `earlyModelQuality` learned from our own `<$100K` entry outcomes.

A tracked wallet receives smart-money credit only when the on-chain swap can be attributed to that wallet. Direct router injections and buys below the dust threshold are excluded. Three or more pushed/dust wallets that outnumber real attributed buyers mark the token as `seeded`, which is a hard reject.

## Current Robinhood Chain path

V1 follows the current Uniswap V4 path rather than the old NOXA/Odyssey-only flow:

1. Watch PoolManager `Initialize` for new native-ETH/token pools.
2. Recognize the current era-2 launch shape (`fee=10000`, `tickSpacing=200`, zero hook).
3. Start a HoodWatch `audit --json --fast` immediately.
4. Watch PoolManager `Swap`; V4 uses swapper-delta signs, so token-side amount `> 0` is a buy.
5. Derive live market cap from `sqrtPriceX96`, token supply, and ETH/USD.
6. Ignore swaps once the token is already `>= $1M`.
7. For `<$1M`, attribute tracked-wallet transfers from the transaction receipt.
8. Feed 10-second rolling metrics into the radar score.

The Robinhood sequencer feed is also subscribed for pre-confirmation telemetry on the current launchpad selectors. Final token identity and trade accounting come from confirmed V4 events.

## Two-stage alert

- `PRIME WATCH`: `<$100K` + smart-wallet/buyer gates met while safety audit is still pending.
- `PRIME VERIFIED`: the same candidate after HoodWatch has returned a non-hard-fail result and the score gate is met.

This avoids hiding the earliest useful event behind an external audit while still refusing to label an unverified token as a confirmed signal.

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

For real second-level operation, use a production WebSocket/RPC provider. The public Robinhood RPC is useful for development but should not be the latency-sensitive production transport.

### Optional environment variables

```text
RH_POLL_MS=300
RH_DISABLE_FEED=0
HOODWATCH_TIMEOUT_MS=15000
HOODWATCH_DISABLE=0
SMART_WALLET_DIRECTORY_URL=https://fomoradar.app/api/leaderboard?status=active&limit=400
WALLET_ROSTER_REFRESH_MS=600000
DUST_ABS_USD=5
DUST_RATIO=0.02
FOMO_DIRECT_ROUTERS=0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f
LOG_RADAR=0
LOG_TELEMETRY=0
```

## Scoring

`Radar score = 30% wallet quality + 20% independent smart buyers + 15% buyer velocity + 10% capital velocity + 10% buy/sell imbalance + 10% safety + 5% liquidity.`

Wallet independence is represented by `fundingCluster`: multiple addresses in the same funding cluster count as one smart buyer.

## Still to wire before a 24/7 live release

- persistent event/outcome storage so `<$100K` wallet skill can be learned from our own history;
- funding-source clustering instead of the current profile hook;
- backend WebSocket/SSE fan-out for the dashboard;
- Solana adapter using the same normalized event schema;
- production health checks and restart supervision.

The first release should remain alerts-only until measured false-positive/false-negative rates are available.
