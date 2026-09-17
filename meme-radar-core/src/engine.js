import { RADAR_CONFIG } from './config.js'
import { scoreSignal, walletQuality } from './scoring.js'

const lower = (s) => String(s ?? '').toLowerCase()

export class RadarEngine {
  constructor({ walletProfiles = new Map(), onSignal = () => {}, now = () => Date.now() } = {}) {
    this.walletProfiles = walletProfiles
    this.onSignal = onSignal
    this.now = now
    this.tokens = new Map()
    this.lastAlert = new Map()
  }

  setWalletProfile(address, profile) {
    this.walletProfiles.set(lower(address), { ...profile, quality: walletQuality(profile) })
  }

  ingestTrade(trade) {
    if (!Number.isFinite(trade.marketCapUsd) || trade.marketCapUsd >= RADAR_CONFIG.maxMarketCapUsd) return null
    if (!Number.isFinite(trade.usdValue) || trade.usdValue < RADAR_CONFIG.minTradeUsd) return null
    const token = lower(trade.token)
    const ts = trade.observedAt ?? this.now()
    const state = this.tokens.get(token) ?? { trades: [], firstSeen: ts }
    state.trades.push({ ...trade, trader: lower(trade.trader), observedAt: ts })
    state.trades = state.trades.filter((t) => ts - t.observedAt <= 60_000)
    this.tokens.set(token, state)
    const metrics = this.metrics(token, trade)
    const result = scoreSignal(metrics)
    const last = this.lastAlert.get(token) ?? 0
    if (result.eligible && ts - last >= RADAR_CONFIG.alertCooldownMs) {
      this.lastAlert.set(token, ts)
      const signal = { ...result, ...metrics, token: trade.token, symbol: trade.symbol, chain: trade.chain, observedAt: ts }
      this.onSignal(signal)
      return signal
    }
    return { ...result, ...metrics, token: trade.token, symbol: trade.symbol, chain: trade.chain, observedAt: ts }
  }

  metrics(tokenAddress, latest) {
    const state = this.tokens.get(lower(tokenAddress))
    const now = latest.observedAt ?? this.now()
    const w10 = state.trades.filter((t) => now - t.observedAt <= 10_000)
    const buys = w10.filter((t) => t.isBuy)
    const sells = w10.filter((t) => !t.isBuy)
    const buyUsd10s = buys.reduce((a, t) => a + t.usdValue, 0)
    const sellUsd10s = sells.reduce((a, t) => a + t.usdValue, 0)
    const uniqueBuyers = new Set(buys.map((t) => t.trader))
    const smart = []
    for (const wallet of uniqueBuyers) {
      const profile = this.walletProfiles.get(wallet)
      const q = profile?.quality ?? walletQuality(profile)
      if (q >= 70) smart.push({ wallet, q, fundingCluster: profile?.fundingCluster ?? wallet })
    }
    const independentClusters = new Set(smart.map((w) => w.fundingCluster))
    return {
      marketCapUsd: latest.marketCapUsd,
      liquidityUsd: latest.liquidityUsd ?? 0,
      uniqueBuyers10s: uniqueBuyers.size,
      buyUsd10s,
      sellUsd10s,
      buySellRatio: buyUsd10s / Math.max(25, sellUsd10s),
      independentSmartBuyers: independentClusters.size,
      avgSmartWalletQuality: smart.length ? smart.reduce((a, w) => a + w.q, 0) / smart.length : 0,
      risk: latest.risk ?? {},
      ageMs: now - state.firstSeen
    }
  }
}
