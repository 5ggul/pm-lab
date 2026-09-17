import {
  MAINNET_ADDRESSES,
  ODYSSEY_ADDRESSES,
  createHoodClient,
  quoteSwap,
  subscribeFeed,
  watchCurveTrades,
  watchLaunches
} from 'hoodchain'
import { formatEther, formatUnits, parseAbi, recoverTransactionAddress, webSocket } from 'viem'

const erc20MetaAbi = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
])

const ODYSSEY_FACTORY_SET = new Set([
  ODYSSEY_ADDRESSES.bondingCurveFactory.toLowerCase(),
  ODYSSEY_ADDRESSES.reflectionFactory.toLowerCase(),
  ODYSSEY_ADDRESSES.instantFactory.toLowerCase()
])

export class RobinhoodAdapter {
  constructor({ onTrade, onLaunch = () => {}, onTelemetry = () => {} }) {
    const wsUrl = process.env.RH_WS_URL
    this.hood = createHoodClient(wsUrl ? { transport: webSocket(wsUrl) } : { rpcUrl: process.env.RH_RPC_URL })
    this.onTrade = onTrade
    this.onLaunch = onLaunch
    this.onTelemetry = onTelemetry
    this.tokenMeta = new Map()
    this.ethUsd = { value: 0, at: 0 }
    this.unwatch = []
    this.feed = null
  }

  async start() {
    this.unwatch.push(watchLaunches(this.hood, (launch) => {
      this.onLaunch({ ...launch, observedAt: Date.now() })
      this.ensureTokenMeta(launch.token).catch(() => {})
    }, {
      pollingInterval: Number(process.env.RH_POLL_MS ?? 500),
      onError: (e) => this.onTelemetry({ type: 'rpc-error', message: e.message })
    }))

    this.unwatch.push(watchCurveTrades(this.hood, (trade) => {
      this.handleOdysseyTrade(trade).catch((e) => this.onTelemetry({ type: 'trade-enrich-error', message: e.message }))
    }, {
      pollingInterval: Number(process.env.RH_POLL_MS ?? 500),
      onError: (e) => this.onTelemetry({ type: 'rpc-error', message: e.message })
    }))

    if (process.env.RH_DISABLE_FEED !== '1') {
      this.feed = await subscribeFeed((msg) => {
        for (const tx of msg.transactions) {
          const to = tx.transaction.to?.toLowerCase()
          if (!to || !ODYSSEY_FACTORY_SET.has(to)) continue
          recoverTransactionAddress({ serializedTransaction: tx.raw })
            .then((from) => this.onTelemetry({
              type: 'preconfirm-factory-touch',
              txHash: tx.hash,
              trader: from,
              target: to,
              sequencerTimestamp: msg.timestamp,
              observedAt: Date.now()
            }))
            .catch(() => {})
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

  async ensureTokenMeta(token) {
    const key = token.toLowerCase()
    if (this.tokenMeta.has(key)) return this.tokenMeta.get(key)
    const [totalSupply, decimals, symbol] = await Promise.all([
      this.hood.public.readContract({ address: token, abi: erc20MetaAbi, functionName: 'totalSupply' }),
      this.hood.public.readContract({ address: token, abi: erc20MetaAbi, functionName: 'decimals' }),
      this.hood.public.readContract({ address: token, abi: erc20MetaAbi, functionName: 'symbol' }).catch(() => 'UNKNOWN')
    ])
    const meta = { totalSupply, decimals: Number(decimals), symbol }
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
    this.ethUsd = { value, at: now }
    return value
  }

  async handleOdysseyTrade(trade) {
    const [meta, ethUsd] = await Promise.all([this.ensureTokenMeta(trade.token), this.getEthUsd()])
    const tokens = Number(formatUnits(trade.tokenAmount, meta.decimals))
    const eth = Number(formatEther(trade.quoteAmount))
    if (!(tokens > 0) || !(eth > 0) || !(ethUsd > 0)) return
    const tokenPriceUsd = (eth / tokens) * ethUsd
    const supply = Number(formatUnits(meta.totalSupply, meta.decimals))
    const marketCapUsd = tokenPriceUsd * supply
    const usdValue = eth * ethUsd
    this.onTrade({
      chain: 'robinhood',
      venue: 'odyssey',
      token: trade.token,
      symbol: meta.symbol,
      trader: trade.trader,
      isBuy: trade.isBuy,
      usdValue,
      marketCapUsd,
      liquidityUsd: 0,
      observedAt: Date.now(),
      txHash: trade.transactionHash,
      risk: {}
    })
  }
}
