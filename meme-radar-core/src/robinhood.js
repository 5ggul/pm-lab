import { MAINNET_ADDRESSES, createHoodClient, quoteSwap, subscribeFeed } from 'hoodchain'
import { decodeEventLog, formatEther, formatUnits, parseAbi, webSocket } from 'viem'
import { auditToken } from './audit.js'
import { chooseTrackedWallet } from './provenance.js'
import { ethPerTokenFromSqrtPrice, marketCapUsdFromPoolPrice } from './v4math.js'

const ZERO = '0x0000000000000000000000000000000000000000'
const POOL_MANAGER = '0x8366a39cc670b4001a1121b8f6a443a643e40951'
const CURRENT_LAUNCHPAD = '0xf193ede778a92dc37cb450a1ef1565ed1e8b7964'
const LAUNCHPAD_SELECTORS = new Set(['0x68e79a41', '0xc1120e3d', '0xf3f77a0e', '0xa0f7978d'])

const poolManagerAbi = parseAbi([
  'event Initialize(bytes32 indexed id,address indexed currency0,address indexed currency1,uint24 fee,int24 tickSpacing,address hooks,uint160 sqrtPriceX96,int24 tick)',
  'event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)'
])
const erc20MetaAbi = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
])
const transferAbi = parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)'])

const lower = (v) => String(v ?? '').toLowerCase()
const abs = (v) => v < 0n ? -v : v

export class RobinhoodAdapter {
  constructor({ onTrade, onLaunch = () => {}, onAudit = () => {}, onTelemetry = () => {}, trackedProfiles = new Map() }) {
    const wsUrl = process.env.RH_WS_URL
    this.hood = createHoodClient(wsUrl ? { transport: webSocket(wsUrl) } : { rpcUrl: process.env.RH_RPC_URL })
    this.onTrade = onTrade
    this.onLaunch = onLaunch
    this.onAudit = onAudit
    this.onTelemetry = onTelemetry
    this.trackedProfiles = trackedProfiles
    this.tokenMeta = new Map()
    this.ethUsd = { value: 0, at: 0 }
    this.pools = new Map()
    this.risks = new Map()
    this.provenance = new Map()
    this.unwatch = []
    this.feed = null
  }

  async start() {
    const watchOptions = {
      address: POOL_MANAGER,
      abi: poolManagerAbi,
      pollingInterval: Number(process.env.RH_POLL_MS ?? 300),
      onError: (e) => this.onTelemetry({ type: 'rpc-error', message: e.message })
    }

    this.unwatch.push(this.hood.public.watchContractEvent({
      ...watchOptions,
      eventName: 'Initialize',
      onLogs: (logs) => {
        for (const log of logs) this.handleInitialize(log).catch((e) => this.onTelemetry({ type: 'init-error', message: e.message }))
      }
    }))

    this.unwatch.push(this.hood.public.watchContractEvent({
      ...watchOptions,
      eventName: 'Swap',
      onLogs: (logs) => {
        for (const log of logs) this.handleSwap(log).catch((e) => this.onTelemetry({ type: 'swap-error', message: e.message }))
      }
    }))

    if (process.env.RH_DISABLE_FEED !== '1') {
      this.feed = await subscribeFeed((msg) => {
        for (const tx of msg.transactions) {
          const to = lower(tx.transaction.to)
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

  async handleInitialize(log) {
    const a = log.args
    const c0 = lower(a.currency0)
    const c1 = lower(a.currency1)
    const native0 = c0 === ZERO
    const native1 = c1 === ZERO
    if (native0 === native1) return

    const token = native0 ? c1 : c0
    if (!/^0x[a-f0-9]{40}$/.test(token)) return
    const poolId = lower(a.id)
    const hook = lower(a.hooks)
    const fee = Number(a.fee)
    const tickSpacing = Number(a.tickSpacing)
    const era2Shape = fee === 10_000 && tickSpacing === 200 && hook === ZERO
    const pool = { poolId, token, tokenIs0: !native0, hook, fee, tickSpacing, createdAt: Date.now(), era2Shape }
    this.pools.set(poolId, pool)
    this.risks.set(token, { securityVerified: false, auditVerdict: 'PENDING', auditScore: 0 })
    this.onLaunch({
      chain: 'robinhood', venue: 'uniswap-v4', token, poolId, hook, fee, tickSpacing,
      era2Shape, txHash: log.transactionHash, blockNumber: log.blockNumber, observedAt: pool.createdAt
    })

    this.ensureTokenMeta(token).catch(() => {})
    if (era2Shape) this.auditWithRetry(token, 0).catch(() => {})
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

  async handleSwap(log) {
    const a = log.args
    const pool = this.pools.get(lower(a.id))
    if (!pool) return

    const [meta, ethUsd] = await Promise.all([this.ensureTokenMeta(pool.token), this.getEthUsd()])
    const ethPerToken = ethPerTokenFromSqrtPrice({
      tokenIs0: pool.tokenIs0,
      tokenDecimals: meta.decimals,
      sqrtPriceX96: a.sqrtPriceX96
    })
    const marketCapUsd = marketCapUsdFromPoolPrice({
      ethPerToken,
      ethUsd,
      totalSupply: meta.totalSupply,
      tokenDecimals: meta.decimals
    })
    if (!(marketCapUsd > 0) || marketCapUsd >= 1_000_000) return

    const tokenSide = pool.tokenIs0 ? a.amount0 : a.amount1
    const nativeSide = pool.tokenIs0 ? a.amount1 : a.amount0
    const isBuy = tokenSide > 0n
    const usdValue = Number(formatEther(abs(nativeSide))) * ethUsd
    if (!(usdValue > 0)) return

    let trader = `tx:${lower(log.transactionHash)}`
    let attribution = { kind: 'unattributed', countsAsSmart: false }
    let seeded = false

    if (this.trackedProfiles.size) {
      try {
        const receipt = await this.hood.public.getTransactionReceipt({ hash: log.transactionHash })
        const transfers = this.decodeTokenTransfers(receipt, pool.token)
        if (this.hasTrackedTransfer(transfers, isBuy)) {
          const tx = await this.hood.public.getTransaction({ hash: log.transactionHash })
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
        }
      } catch (e) {
        this.onTelemetry({ type: 'receipt-attribution-error', txHash: log.transactionHash, message: e.message })
      }
    }

    const baseRisk = this.risks.get(lower(pool.token)) ?? { securityVerified: false, auditVerdict: 'PENDING', auditScore: 0 }
    const risk = { ...baseRisk, seeded: baseRisk.seeded || seeded }
    if (seeded) this.risks.set(lower(pool.token), risk)

    this.onTrade({
      chain: 'robinhood', venue: 'uniswap-v4', token: pool.token, symbol: meta.symbol,
      trader, isBuy, usdValue, marketCapUsd,
      liquidityUsd: Number(risk.liquidityUsd ?? 0), observedAt: Date.now(),
      txHash: log.transactionHash, poolId: pool.poolId, attribution: attribution.kind, risk
    })
  }
}
