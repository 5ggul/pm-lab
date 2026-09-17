import { MAINNET_ADDRESSES, createHoodClient, quoteSwap, subscribeFeed } from 'hoodchain'
import { decodeEventLog, formatUnits, parseAbi, parseAbiItem, recoverTransactionAddress, webSocket } from 'viem'
import { auditToken } from './audit.js'
import { chooseTrackedWallet } from './provenance.js'
import { marketCapUsdFromQuotePrice, quotePerTokenFromSqrtPrice } from './v4math.js'

const ZERO = '0x0000000000000000000000000000000000000000'
const WETH = MAINNET_ADDRESSES.weth.toLowerCase()
const USDG = MAINNET_ADDRESSES.usdg.toLowerCase()
const POOL_MANAGER = '0x8366a39cc670b4001a1121b8f6a443a643e40951'
const V2_FACTORY = '0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f'
const V3_FACTORY = MAINNET_ADDRESSES.uniswapV3Factory.toLowerCase()
const CURRENT_LAUNCHPAD = '0xf193ede778a92dc37cb450a1ef1565ed1e8b7964'
const LAUNCHPAD_SELECTORS = new Set(['0x68e79a41', '0xc1120e3d', '0xf3f77a0e', '0xa0f7978d'])

const v4InitializeEvent = parseAbiItem('event Initialize(bytes32 indexed id,address indexed currency0,address indexed currency1,uint24 fee,int24 tickSpacing,address hooks,uint160 sqrtPriceX96,int24 tick)')
const v4SwapEvent = parseAbiItem('event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)')
const v2PairCreatedEvent = parseAbiItem('event PairCreated(address indexed token0,address indexed token1,address pair,uint256)')
const v2SwapEvent = parseAbiItem('event Swap(address indexed sender,uint256 amount0In,uint256 amount1In,uint256 amount0Out,uint256 amount1Out,address indexed to)')
const v3PoolCreatedEvent = parseAbiItem('event PoolCreated(address indexed token0,address indexed token1,uint24 indexed fee,int24 tickSpacing,address pool)')
const v3SwapEvent = parseAbiItem('event Swap(address indexed sender,address indexed recipient,int256 amount0,int256 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick)')

const erc20MetaAbi = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
])
const transferAbi = parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)'])

const lower = (v) => String(v ?? '').toLowerCase()
const abs = (v) => v < 0n ? -v : v
const isAddress = (v) => /^0x[a-f0-9]{40}$/.test(lower(v))

function quoteAsset(address) {
  const a = lower(address)
  if (a === ZERO) return { address: ZERO, symbol: 'ETH', decimals: 18, usdKind: 'eth' }
  if (a === WETH) return { address: WETH, symbol: 'WETH', decimals: 18, usdKind: 'eth' }
  if (a === USDG) return { address: USDG, symbol: 'USDG', decimals: 6, usdKind: 'usd' }
  return null
}

function tokenQuotePair(currency0, currency1) {
  const c0 = lower(currency0)
  const c1 = lower(currency1)
  const q0 = quoteAsset(c0)
  const q1 = quoteAsset(c1)
  if (Boolean(q0) === Boolean(q1)) return null
  const token = q0 ? c1 : c0
  if (!isAddress(token) || quoteAsset(token)) return null
  return { token, tokenIs0: !q0, quote: q0 ?? q1 }
}

export class RobinhoodAdapter {
  constructor({ onTrade, onLaunch = () => {}, onAudit = () => {}, onTelemetry = () => {}, onNativeFunding = () => {}, trackedProfiles = new Map() }) {
    const wsUrl = process.env.RH_WS_URL
    this.hood = createHoodClient(wsUrl ? { transport: webSocket(wsUrl) } : { rpcUrl: process.env.RH_RPC_URL })
    this.onTrade = onTrade
    this.onLaunch = onLaunch
    this.onAudit = onAudit
    this.onTelemetry = onTelemetry
    this.onNativeFunding = onNativeFunding
    this.trackedProfiles = trackedProfiles
    this.tokenMeta = new Map()
    this.ethUsd = { value: 0, at: 0 }
    this.v4Pools = new Map()
    this.addressPools = new Map()
    this.risks = new Map()
    this.provenance = new Map()
    this.auditStarted = new Set()
    this.unwatch = []
    this.feed = null
  }

  async observeFeedFunding(tx, msg) {
    const wallet = lower(tx?.transaction?.to)
    if (!this.trackedProfiles.has(wallet)) return
    let value
    try { value = BigInt(tx?.transaction?.value ?? 0n) } catch { return }
    if (!(value > 0n)) return

    const funder = lower(await recoverTransactionAddress({ serializedTransaction: tx.raw }))
    if (!isAddress(funder) || funder === wallet) return
    const feedTs = Number(msg?.timestamp)
    const timestampMs = Number.isFinite(feedTs) && feedTs > 0
      ? (feedTs > 1_000_000_000_000 ? feedTs : feedTs * 1000)
      : Date.now()
    this.onNativeFunding({
      wallet,
      funder,
      valueWei: value.toString(),
      txHash: tx.hash,
      timestampMs,
      source: 'sequencer_native_inbound'
    })
  }

  async start() {
    const poll = Number(process.env.RH_POLL_MS ?? 300)
    const onError = (e) => this.onTelemetry({ type: 'rpc-error', message: e.message })

    this.unwatch.push(this.hood.public.watchContractEvent({
      address: POOL_MANAGER,
      abi: [v4InitializeEvent],
      eventName: 'Initialize',
      pollingInterval: poll,
      onError,
      onLogs: (logs) => {
        for (const log of logs) this.handleV4Initialize(log, false).catch((e) => this.onTelemetry({ type: 'v4-init-error', message: e.message }))
      }
    }))

    this.unwatch.push(this.hood.public.watchContractEvent({
      address: POOL_MANAGER,
      abi: [v4SwapEvent],
      eventName: 'Swap',
      pollingInterval: poll,
      onError,
      onLogs: (logs) => {
        for (const log of logs) this.handleV4Swap(log).catch((e) => this.onTelemetry({ type: 'v4-swap-error', message: e.message }))
      }
    }))

    this.unwatch.push(this.hood.public.watchContractEvent({
      address: V2_FACTORY,
      abi: [v2PairCreatedEvent],
      eventName: 'PairCreated',
      pollingInterval: poll,
      onError,
      onLogs: (logs) => {
        for (const log of logs) this.handleV2PairCreated(log, false).catch((e) => this.onTelemetry({ type: 'v2-pair-error', message: e.message }))
      }
    }))

    this.unwatch.push(this.hood.public.watchContractEvent({
      address: V3_FACTORY,
      abi: [v3PoolCreatedEvent],
      eventName: 'PoolCreated',
      pollingInterval: poll,
      onError,
      onLogs: (logs) => {
        for (const log of logs) this.handleV3PoolCreated(log, false).catch((e) => this.onTelemetry({ type: 'v3-pool-error', message: e.message }))
      }
    }))

    // One topic-filtered stream per legacy swap shape. Filtering by our discovered pool map keeps
    // RPC traffic bounded without spawning one poller per pair.
    this.unwatch.push(this.hood.public.watchEvent({
      event: v2SwapEvent,
      pollingInterval: poll,
      onError,
      onLogs: (logs) => {
        for (const log of logs) {
          if (!this.addressPools.has(lower(log.address))) continue
          this.handleV2Swap(log).catch((e) => this.onTelemetry({ type: 'v2-swap-error', message: e.message }))
        }
      }
    }))

    this.unwatch.push(this.hood.public.watchEvent({
      event: v3SwapEvent,
      pollingInterval: poll,
      onError,
      onLogs: (logs) => {
        for (const log of logs) {
          if (!this.addressPools.has(lower(log.address))) continue
          this.handleV3Swap(log).catch((e) => this.onTelemetry({ type: 'v3-swap-error', message: e.message }))
        }
      }
    }))

    await this.backfillRecentPools().catch((e) => this.onTelemetry({ type: 'pool-backfill-error', message: e.message }))

    if (process.env.RH_DISABLE_FEED !== '1') {
      this.feed = await subscribeFeed((msg) => {
        for (const tx of msg.transactions) {
          const to = lower(tx.transaction.to)
          if (this.trackedProfiles.has(to) && BigInt(tx.transaction.value ?? 0n) > 0n) {
            this.observeFeedFunding(tx, msg).catch((e) => this.onTelemetry({
              type: 'funding-observe-error', txHash: tx.hash, message: String(e?.message ?? e), observedAt: Date.now()
            }))
          }
          if (to !== CURRENT_LAUNCHPAD) continue
          const data = lower(tx.transaction.data)
          const selector = data.slice(0, 10)
          if (!LAUNCHPAD_SELECTORS.has(selector)) continue
          this.onTelemetry({
            type: selector === '0x68e79a41' ? 'preconfirm-launch' : selector === '0xa0f7978d' ? 'preconfirm-lp-withdraw' : 'preconfirm-buy',
            selector,
            txHash: tx.hash,
            sequencerTimestamp: msg.timestamp,
            observedAt: Date.now()
          })
        }
      }, {
        onConnect: () => this.onTelemetry({ type: 'feed-connected', observedAt: Date.now() }),
        onError: (e) => this.onTelemetry({ type: 'feed-error', message: e.message, observedAt: Date.now() })
      })
    }
  }

  stop() {
    this.unwatch.forEach((u) => u())
    this.feed?.close()
  }

  async backfillRecentPools() {
    const latest = await this.hood.public.getBlockNumber()
    const lookback = BigInt(Math.max(100, Number(process.env.RH_BACKFILL_BLOCKS ?? 6_000)))
    const fromBlock = latest > lookback ? latest - lookback : 0n
    const [v4, v2, v3] = await Promise.all([
      this.hood.public.getLogs({ address: POOL_MANAGER, event: v4InitializeEvent, fromBlock, toBlock: latest }),
      this.hood.public.getLogs({ address: V2_FACTORY, event: v2PairCreatedEvent, fromBlock, toBlock: latest }),
      this.hood.public.getLogs({ address: V3_FACTORY, event: v3PoolCreatedEvent, fromBlock, toBlock: latest })
    ])
    for (const log of v4) await this.handleV4Initialize(log, true)
    for (const log of v2) await this.handleV2PairCreated(log, true)
    for (const log of v3) await this.handleV3PoolCreated(log, true)
    this.onTelemetry({
      type: 'pool-backfill',
      fromBlock: fromBlock.toString(),
      toBlock: latest.toString(),
      v4: v4.length,
      v2: v2.length,
      v3: v3.length,
      trackedV4: this.v4Pools.size,
      trackedLegacy: this.addressPools.size
    })
  }

  registerPool(pool, log, backfill) {
    const key = pool.venue === 'uniswap-v4' ? pool.poolId : pool.address
    const map = pool.venue === 'uniswap-v4' ? this.v4Pools : this.addressPools
    if (map.has(key)) return false
    map.set(key, pool)
    if (!this.risks.has(pool.token)) {
      this.risks.set(pool.token, { securityVerified: false, auditVerdict: 'PENDING', auditScore: 0 })
    }
    this.onLaunch({
      chain: 'robinhood',
      venue: pool.venue,
      token: pool.token,
      poolId: pool.poolId ?? null,
      poolAddress: pool.address ?? null,
      quote: pool.quote.symbol,
      fee: pool.fee ?? null,
      tickSpacing: pool.tickSpacing ?? null,
      era2Shape: Boolean(pool.era2Shape),
      backfill,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      observedAt: pool.createdAt
    })
    this.ensureTokenMeta(pool.token).catch(() => {})
    if (!backfill && pool.era2Shape) this.ensureAudit(pool.token)
    return true
  }

  async handleV4Initialize(log, backfill = false) {
    const a = log.args
    const parts = tokenQuotePair(a.currency0, a.currency1)
    if (!parts) return
    const poolId = lower(a.id)
    const hook = lower(a.hooks)
    const fee = Number(a.fee)
    const tickSpacing = Number(a.tickSpacing)
    const era2Shape = parts.quote.address === ZERO && fee === 10_000 && tickSpacing === 200 && hook === ZERO
    this.registerPool({
      venue: 'uniswap-v4', poolId, ...parts, hook, fee, tickSpacing,
      createdAt: Date.now(), era2Shape
    }, log, backfill)
  }

  async handleV2PairCreated(log, backfill = false) {
    const parts = tokenQuotePair(log.args.token0, log.args.token1)
    if (!parts || !log.args.pair) return
    const address = lower(log.args.pair)
    this.registerPool({
      venue: 'uniswap-v2', address, ...parts, createdAt: Date.now(), era2Shape: false
    }, log, backfill)
  }

  async handleV3PoolCreated(log, backfill = false) {
    const parts = tokenQuotePair(log.args.token0, log.args.token1)
    if (!parts || !log.args.pool) return
    const address = lower(log.args.pool)
    this.registerPool({
      venue: 'uniswap-v3', address, ...parts,
      fee: Number(log.args.fee), tickSpacing: Number(log.args.tickSpacing),
      createdAt: Date.now(), era2Shape: false
    }, log, backfill)
  }

  ensureAudit(token) {
    const key = lower(token)
    if (this.auditStarted.has(key)) return
    this.auditStarted.add(key)
    this.auditWithRetry(key, 0).catch((e) => this.onTelemetry({ type: 'audit-error', token: key, message: e.message }))
  }

  async auditWithRetry(token, attempt) {
    const risk = await auditToken(token)
    this.risks.set(lower(token), risk)
    this.onAudit({ token, risk, observedAt: Date.now() })
    if (risk.securityVerified !== true && attempt < 2) {
      const delay = attempt === 0 ? 1_500 : 4_000
      setTimeout(() => this.auditWithRetry(token, attempt + 1).catch(() => {}), delay)
    }
  }

  async ensureTokenMeta(token) {
    const key = lower(token)
    if (this.tokenMeta.has(key)) return this.tokenMeta.get(key)
    const [totalSupply, decimals, symbol] = await Promise.all([
      this.hood.public.readContract({ address: token, abi: erc20MetaAbi, functionName: 'totalSupply' }),
      this.hood.public.readContract({ address: token, abi: erc20MetaAbi, functionName: 'decimals' }),
      this.hood.public.readContract({ address: token, abi: erc20MetaAbi, functionName: 'symbol' }).catch(() => 'UNKNOWN')
    ])
    const meta = { totalSupply, decimals: Number(decimals), symbol: String(symbol) }
    this.tokenMeta.set(key, meta)
    return meta
  }

  async getEthUsd() {
    const now = Date.now()
    if (this.ethUsd.value > 0 && now - this.ethUsd.at < 5_000) return this.ethUsd.value
    const q = await quoteSwap(this.hood, {
      tokenIn: MAINNET_ADDRESSES.weth,
      tokenOut: MAINNET_ADDRESSES.usdg,
      amountIn: 10n ** 18n
    })
    const value = Number(formatUnits(q.amountOut, 6))
    if (value > 0) this.ethUsd = { value, at: now }
    return value
  }

  async quoteUsd(quote) {
    return quote.usdKind === 'usd' ? 1 : this.getEthUsd()
  }

  decodeTokenTransfers(receipt, token) {
    const out = []
    for (const log of receipt.logs ?? []) {
      if (lower(log.address) !== lower(token)) continue
      try {
        const d = decodeEventLog({ abi: transferAbi, data: log.data, topics: log.topics })
        if (d.eventName !== 'Transfer') continue
        out.push({ from: lower(d.args.from), to: lower(d.args.to), value: d.args.value })
      } catch {}
    }
    return out
  }

  hasTrackedTransfer(transfers, isBuy) {
    return transfers.some((t) => this.trackedProfiles.has(lower(isBuy ? t.to : t.from)))
  }

  updateSpoofState(token, attributionResult) {
    const key = lower(token)
    const state = this.provenance.get(key) ?? { pushed: new Set(), real: new Set() }
    for (const c of attributionResult.candidates ?? []) {
      if (c.attribution.countsAsSmart) state.real.add(c.wallet)
      else if (c.attribution.kind === 'direct' || c.attribution.kind === 'dust') state.pushed.add(c.wallet)
    }
    this.provenance.set(key, state)
    return state.pushed.size >= 3 && state.pushed.size > state.real.size
  }

  async attributeTrade(pool, isBuy, transactionHash, usdValue) {
    let trader = `tx:${lower(transactionHash)}`
    let attribution = { kind: 'unattributed', countsAsSmart: false }
    let seeded = false
    if (!this.trackedProfiles.size) return { trader, attribution, seeded }

    try {
      const receipt = await this.hood.public.getTransactionReceipt({ hash: transactionHash })
      const transfers = this.decodeTokenTransfers(receipt, pool.token)
      if (!this.hasTrackedTransfer(transfers, isBuy)) return { trader, attribution, seeded }
      const tx = await this.hood.public.getTransaction({ hash: transactionHash })
      const chosen = chooseTrackedWallet({
        transfers,
        isBuy,
        trackedProfiles: this.trackedProfiles,
        receiptTo: tx.to,
        usdValue
      })
      attribution = chosen.attribution
      if (chosen.wallet && chosen.attribution.countsAsSmart) trader = chosen.wallet
      seeded = this.updateSpoofState(pool.token, chosen)
    } catch (e) {
      this.onTelemetry({ type: 'receipt-attribution-error', txHash: transactionHash, message: e.message })
    }
    return { trader, attribution, seeded }
  }

  async emitTrade({ pool, isBuy, usdValue, marketCapUsd, transactionHash }) {
    if (!(usdValue > 0) || !(marketCapUsd > 0) || marketCapUsd >= 1_000_000) return
    this.ensureAudit(pool.token)
    const { trader, attribution, seeded } = await this.attributeTrade(pool, isBuy, transactionHash, usdValue)
    const baseRisk = this.risks.get(lower(pool.token)) ?? { securityVerified: false, auditVerdict: 'PENDING', auditScore: 0 }
    const risk = { ...baseRisk, seeded: baseRisk.seeded || seeded }
    if (seeded) this.risks.set(lower(pool.token), risk)

    const meta = await this.ensureTokenMeta(pool.token)
    this.onTrade({
      chain: 'robinhood', venue: pool.venue, token: pool.token, symbol: meta.symbol,
      trader, isBuy, usdValue, marketCapUsd,
      liquidityUsd: Number(risk.liquidityUsd ?? 0), observedAt: Date.now(), launchedAt: pool.createdAt,
      txHash: transactionHash, poolId: pool.poolId ?? pool.address, attribution: attribution.kind, risk
    })
  }

  async handleV4Swap(log) {
    const a = log.args
    const pool = this.v4Pools.get(lower(a.id))
    if (!pool) return
    const [meta, quoteUsd] = await Promise.all([this.ensureTokenMeta(pool.token), this.quoteUsd(pool.quote)])
    const quotePerToken = quotePerTokenFromSqrtPrice({
      tokenIs0: pool.tokenIs0,
      tokenDecimals: meta.decimals,
      quoteDecimals: pool.quote.decimals,
      sqrtPriceX96: a.sqrtPriceX96
    })
    const marketCapUsd = marketCapUsdFromQuotePrice({
      quotePerToken,
      quoteUsd,
      totalSupply: meta.totalSupply,
      tokenDecimals: meta.decimals
    })
    if (!(marketCapUsd > 0) || marketCapUsd >= 1_000_000) return
    const tokenSide = pool.tokenIs0 ? a.amount0 : a.amount1
    const quoteSide = pool.tokenIs0 ? a.amount1 : a.amount0
    const isBuy = tokenSide > 0n // V4 uses swapper-delta signs.
    const usdValue = Number(formatUnits(abs(quoteSide), pool.quote.decimals)) * quoteUsd
    await this.emitTrade({ pool, isBuy, usdValue, marketCapUsd, transactionHash: log.transactionHash })
  }

  async handleV3Swap(log) {
    const pool = this.addressPools.get(lower(log.address))
    if (!pool || pool.venue !== 'uniswap-v3') return
    const a = log.args
    const [meta, quoteUsd] = await Promise.all([this.ensureTokenMeta(pool.token), this.quoteUsd(pool.quote)])
    const quotePerToken = quotePerTokenFromSqrtPrice({
      tokenIs0: pool.tokenIs0,
      tokenDecimals: meta.decimals,
      quoteDecimals: pool.quote.decimals,
      sqrtPriceX96: a.sqrtPriceX96
    })
    const marketCapUsd = marketCapUsdFromQuotePrice({
      quotePerToken,
      quoteUsd,
      totalSupply: meta.totalSupply,
      tokenDecimals: meta.decimals
    })
    if (!(marketCapUsd > 0) || marketCapUsd >= 1_000_000) return
    const tokenSide = pool.tokenIs0 ? a.amount0 : a.amount1
    const quoteSide = pool.tokenIs0 ? a.amount1 : a.amount0
    const isBuy = tokenSide < 0n // V3 uses pool-perspective signs.
    const usdValue = Number(formatUnits(abs(quoteSide), pool.quote.decimals)) * quoteUsd
    await this.emitTrade({ pool, isBuy, usdValue, marketCapUsd, transactionHash: log.transactionHash })
  }

  async handleV2Swap(log) {
    const pool = this.addressPools.get(lower(log.address))
    if (!pool || pool.venue !== 'uniswap-v2') return
    const a = log.args
    let isBuy
    let tokenRaw
    let quoteRaw
    if (pool.tokenIs0) {
      isBuy = a.amount0Out > 0n && a.amount1In > 0n
      tokenRaw = isBuy ? a.amount0Out : a.amount0In
      quoteRaw = isBuy ? a.amount1In : a.amount1Out
    } else {
      isBuy = a.amount1Out > 0n && a.amount0In > 0n
      tokenRaw = isBuy ? a.amount1Out : a.amount1In
      quoteRaw = isBuy ? a.amount0In : a.amount0Out
    }
    if (!(tokenRaw > 0n) || !(quoteRaw > 0n)) return

    const [meta, quoteUsd] = await Promise.all([this.ensureTokenMeta(pool.token), this.quoteUsd(pool.quote)])
    const tokenAmount = Number(formatUnits(tokenRaw, meta.decimals))
    const quoteAmount = Number(formatUnits(quoteRaw, pool.quote.decimals))
    if (!(tokenAmount > 0) || !(quoteAmount > 0)) return
    const quotePerToken = quoteAmount / tokenAmount
    const marketCapUsd = marketCapUsdFromQuotePrice({
      quotePerToken,
      quoteUsd,
      totalSupply: meta.totalSupply,
      tokenDecimals: meta.decimals
    })
    const usdValue = quoteAmount * quoteUsd
    await this.emitTrade({ pool, isBuy, usdValue, marketCapUsd, transactionHash: log.transactionHash })
  }
}
