import { RADAR_CONFIG } from './config.js'
import { scoreSignal, walletQuality } from './scoring.js'

const lower = (s) => String(s ?? '').toLowerCase()
const isAddress = (v) => /^0x[a-f0-9]{40}$/.test(lower(v))

export class RadarEngine {
  constructor({ walletProfiles = new Map(), onSignal = () => {}, onWatch = () => {}, now = () => Date.now() } = {}) {
    this.walletProfiles = walletProfiles
    this.onSignal = onSignal
    this.onWatch = onWatch
    this.now = now
    this.tokens = new Map()
    this.lastAlert = new Map()
    this.lastWatch = new Map()
  }

  setWalletProfile(address, profile) {
    this.walletProfiles.set(lower(address), { ...profile, quality: walletQuality(profile) })
  }

  ingestTrade(trade) {
    if (!Number.isFinite(trade.marketCapUsd) || trade.marketCapUsd >= RADAR_CONFIG.maxMarketCapUsd) return null
    if (!Number.isFinite(trade.usdValue) || trade.usdValue < RADAR_CONFIG.minTradeUsd) return null
    const token = lower(trade.token)
    const ts = trade.observedAt ?? this.now()
    const launchedAt = Number.isFinite(Number(trade.launchedAt)) ? Number(trade.launchedAt) : ts
    const state = this.tokens.get(token) ?? { trades: [], firstSeen: launchedAt, risk: trade.risk ?? {} }
    state.firstSeen = Math.min(state.firstSeen, launchedAt)
    if (trade.risk) state.risk = trade.risk
    state.trades.push({
      ...trade,
      trader: lower(trade.trader),
      participant: isAddress(trade.participant) ? lower(trade.participant) : null,
      observedAt: ts
    })
    state.trades = state.trades.filter((t) => ts - t.observedAt <= 60_000)
    this.tokens.set(token, state)
    return this.evaluate(token, state.trades[state.trades.length - 1], ts)
  }

  /**
   * Upgrade attribution for an already-ingested confirmed trade without adding a second buy.
   * Receipt retries use this path when a previously ordinary signer is later proven to be the
   * actual token recipient. The original trade timestamp stays unchanged, so a late verification
   * cannot resurrect an expired 10-second smart/buyer burst.
   */
  refreshTradeAttribution(tokenAddress, txHash, update = {}, observedAt = this.now()) {
    const token = lower(tokenAddress)
    const hash = lower(txHash)
    const state = this.tokens.get(token)
    if (!state?.trades?.length || !hash) return null

    const ts = Number(observedAt ?? this.now())
    state.trades = state.trades.filter((t) => ts - t.observedAt <= 60_000)
    const target = state.trades.find((t) => lower(t.txHash) === hash)
    if (!target) {
      if (!state.trades.length) this.tokens.delete(token)
      else this.tokens.set(token, state)
      return null
    }

    if (update.trader !== undefined) target.trader = lower(update.trader)
    if (update.participant !== undefined) target.participant = isAddress(update.participant) ? lower(update.participant) : null
    if (update.participantSource !== undefined) target.participantSource = update.participantSource
    if (update.attribution !== undefined) target.attribution = update.attribution
    if (update.risk !== undefined) {
      target.risk = update.risk
      state.risk = update.risk
    }
    this.tokens.set(token, state)

    const latest = {
      ...target,
      observedAt: ts,
      risk: state.risk ?? target.risk ?? {}
    }
    return this.evaluate(token, latest, ts)
  }

  /**
   * Re-score an already observed token when an asynchronous safety audit changes.
   * No synthetic trade is inserted: buyer velocity and smart-money counts are recomputed from the
   * real rolling window at `observedAt`. This lets a fast audit clear a PRIME WATCH immediately,
   * while stale activity naturally expires instead of being resurrected by a late audit.
   */
  refreshRisk(tokenAddress, risk, observedAt = this.now()) {
    const token = lower(tokenAddress)
    const state = this.tokens.get(token)
    if (!state?.trades?.length) return null

    const ts = Number(observedAt ?? this.now())
    state.trades = state.trades.filter((t) => ts - t.observedAt <= 60_000)
    if (!state.trades.length) {
      this.tokens.delete(token)
      return null
    }
    state.risk = risk ?? {}
    this.tokens.set(token, state)

    const lastTrade = state.trades[state.trades.length - 1]
    const latest = { ...lastTrade, observedAt: ts, risk: state.risk }
    return this.evaluate(token, latest, ts)
  }

  evaluate(token, latest, ts) {
    const metrics = this.metrics(token, latest)
    const result = scoreSignal(metrics)
    const event = {
      ...result,
      ...metrics,
      token: latest.token ?? token,
      symbol: latest.symbol,
      chain: latest.chain,
      txHash: latest.txHash ?? null,
      observedAt: ts
    }

    const last = this.lastAlert.get(token) ?? 0
    if (result.eligible && ts - last >= RADAR_CONFIG.alertCooldownMs) {
      this.lastAlert.set(token, ts)
      this.onSignal(event)
      return event
    }

    const lastWatch = this.lastWatch.get(token) ?? 0
    if (result.watch && ts - lastWatch >= 30_000) {
      this.lastWatch.set(token, ts)
      this.onWatch(event)
    }
    return event
  }

  metrics(tokenAddress, latest) {
    const state = this.tokens.get(lower(tokenAddress))
    const now = latest.observedAt ?? this.now()
    const w10 = state.trades.filter((t) => now - t.observedAt <= 10_000)
    const buys = w10.filter((t) => t.isBuy)
    const sells = w10.filter((t) => !t.isBuy)
    const buyUsd10s = buys.reduce((a, t) => a + t.usdValue, 0)
    const sellUsd10s = sells.reduce((a, t) => a + t.usdValue, 0)

    // A tx hash is not a buyer. Only an economically resolved token-side wallet enters headcount.
    const uniqueBuyers = new Set(buys.map((t) => t.participant).filter(isAddress))
    const unidentifiedBuyEvents10s = buys.filter((t) => !isAddress(t.participant)).length

    // Smart-money identity is stricter than general buyer identity. Observation-only WATCH wallets
    // may be present in the directory, but they never enter this set until locally promoted.
    const smartWalletSet = new Set(buys.map((t) => t.trader).filter((w) => this.walletProfiles.has(w)))
    const smart = []
    for (const wallet of smartWalletSet) {
      const profile = this.walletProfiles.get(wallet)
      const q = profile?.quality ?? walletQuality(profile)
      if (profile?.smartEligible === true && q >= 70) {
        smart.push({ wallet, q, fundingCluster: profile?.fundingCluster ?? wallet })
      }
    }
    const independentClusters = new Set(smart.map((w) => w.fundingCluster))

    return {
      marketCapUsd: latest.marketCapUsd,
      liquidityUsd: latest.liquidityUsd ?? 0,
      uniqueBuyers10s: uniqueBuyers.size,
      buyEvents10s: buys.length,
      unidentifiedBuyEvents10s,
      buyUsd10s,
      sellUsd10s,
      buySellRatio: buyUsd10s / Math.max(25, sellUsd10s),
      independentSmartBuyers: independentClusters.size,
      smartWallets: smart.map((w) => w.wallet),
      avgSmartWalletQuality: smart.length ? smart.reduce((a, w) => a + w.q, 0) / smart.length : 0,
      risk: latest.risk ?? state.risk ?? {},
      ageMs: Math.max(0, now - state.firstSeen)
    }
  }
}
