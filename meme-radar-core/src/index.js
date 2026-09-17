import fs from 'node:fs'
import { EarlyWalletLearner } from './early-wallet-learning.js'
import { FundingClusterResolver } from './funding.js'
import { RadarEngine } from './engine.js'
import { SmartRobinhoodAdapter } from './robinhood-smart.js'
import { ShadowStore } from './store.js'
import { applyEarlyModel, syncPublicWalletRoster } from './wallet-directory.js'

function loadWalletProfiles() {
  const file = process.env.WALLET_PROFILES_FILE ?? new URL('../wallet-profiles.json', import.meta.url)
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    return new Map(Object.entries(raw).map(([address, profile]) => [address.toLowerCase(), profile]))
  } catch {
    return new Map()
  }
}

async function notifyTelegram(signal, kind) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  const title = kind === 'watch'
    ? '⚡ PRIME WATCH · 안전검사중'
    : signal.band === 'PRIME_EARLY' ? '🔥 PRIME VERIFIED' : `📡 ${signal.band} VERIFIED`
  const text = [
    title,
    signal.symbol ? `$${signal.symbol}` : signal.token,
    `MC $${Math.round(signal.marketCapUsd).toLocaleString('en-US')}`,
    `Radar ${signal.score}/${signal.threshold}`,
    `Smart ${signal.independentSmartBuyers} · Buyers10s ${signal.uniqueBuyers10s}`,
    `Buy10s $${Math.round(signal.buyUsd10s).toLocaleString('en-US')} · B/S ${signal.buySellRatio.toFixed(1)}x`,
    `Age ${(signal.ageMs / 1000).toFixed(1)}s`,
    kind === 'watch' ? 'HoodWatch audit: pending' : `HoodWatch: ${signal.risk?.auditVerdict ?? 'verified'}`,
    signal.token
  ].join('\n')
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  }).catch(() => {})
}

const profiles = loadWalletProfiles()
const store = new ShadowStore(process.env.RADAR_DB_PATH ?? 'meme-radar-shadow.sqlite')
const earlyLearner = new EarlyWalletLearner(store.db)
const fundingResolver = new FundingClusterResolver()

function applyLocalEarlyStats() {
  let locallyLearned = 0
  let localDiscovered = 0
  let localObservationOnly = 0

  // Existing public/bootstrap profiles get Robinhood-native performance layered over the external prior.
  for (const [address, profile] of profiles) {
    const stats = earlyLearner.walletStats(address)
    const next = applyEarlyModel(profile, stats)
    if (Number(next.earlySampleSize ?? 0) > 0) locallyLearned += 1
    profiles.set(address, next)
  }

  // Local-only discovery is deliberately conservative: a wallet must have at least eight distinct
  // sub-$100K entries with settled six-hour checkpoints before it can even become a smart candidate.
  for (const stats of earlyLearner.listWalletStats({ minObservedTokens: 8, minSettled: 8, limit: 1000 })) {
    const address = String(stats.wallet ?? '').toLowerCase()
    if (!address || profiles.has(address)) continue

    const base = {
      address,
      handle: null,
      externalQuality: 50,
      externalRawScore: null,
      externalStatus: 'local',
      fundingCluster: address,
      source: 'local-early-discovery'
    }
    const next = applyEarlyModel(base, stats)
    const robust = stats.winRate >= 0.50 && stats.hit2xRate >= 0.25 && stats.rugRate <= 0.25
    next.smartEligible = next.smartEligible === true && robust
    next.source = 'local-early-discovery'
    next.localDiscovery = true
    next.localObservedEarlyTokens = stats.observedEarlyTokens
    next.localSettledEarlyTrades = stats.settledEarlyTrades
    next.medianEntryMcapUsd = stats.medianEntryMcapUsd
    next.medianBuyUsd = stats.avgEntryBuyUsd
    profiles.set(address, next)
    localDiscovered += 1
    if (!next.smartEligible) localObservationOnly += 1
  }

  return {
    locallyLearned,
    localDiscovered,
    localObservationOnly,
    earlyLearning: earlyLearner.summary()
  }
}

function applyFundingClusterResult(result) {
  const address = String(result?.wallet ?? '').toLowerCase()
  store.saveFundingCluster(result)
  const profile = profiles.get(address)
  if (!profile) return false
  profile.fundingCluster = result.cluster
  profile.fundingClusterResolved = result.resolved
  profile.funder = result.funder
  profile.fundingClusterConfidence = result.confidence ?? null
  profiles.set(address, profile)
  return true
}

function preloadFundingCache() {
  let cached = 0
  for (const [address, profile] of profiles) {
    const hit = store.getFundingCluster(address)
    if (!hit) continue
    fundingResolver.seed(hit)
    profile.fundingCluster = hit.cluster
    profile.fundingClusterResolved = hit.resolved
    profile.funder = hit.funder
    profile.fundingClusterConfidence = hit.confidence
    profiles.set(address, profile)
    cached += 1
  }
  return cached
}

async function refreshFundingClusters() {
  const cached = preloadFundingCache()
  const stats = await fundingResolver.hydrateProfiles(profiles, {
    concurrency: Number(process.env.FUNDING_LOOKUP_CONCURRENCY ?? 4),
    onResolved: (_address, result) => applyFundingClusterResult(result)
  })
  console.log(JSON.stringify({ type: 'FUNDING_CLUSTERS', cached, ...stats }))
  return stats
}

try {
  const sync = await syncPublicWalletRoster(profiles)
  const local = applyLocalEarlyStats()
  console.log(JSON.stringify({ type: 'WALLET_ROSTER_SYNC', ...sync, ...local }))
} catch (e) {
  const local = applyLocalEarlyStats()
  console.warn(JSON.stringify({
    type: 'WALLET_ROSTER_SYNC_FAILED', message: String(e?.message ?? e),
    fallbackProfiles: profiles.size, ...local
  }))
}

const engine = new RadarEngine({
  walletProfiles: profiles,
  onWatch: (signal) => {
    store.recordSignal(signal, 'WATCH')
    console.log(JSON.stringify({ type: 'WATCH', ...signal }))
    notifyTelegram(signal, 'watch')
  },
  onSignal: (signal) => {
    store.recordSignal(signal, 'VERIFIED')
    console.log(JSON.stringify({ type: 'SIGNAL', ...signal }))
    notifyTelegram(signal, 'signal')
  }
})
for (const [address, profile] of profiles) engine.setWalletProfile(address, profile)

const adapter = new SmartRobinhoodAdapter({
  trackedProfiles: profiles,
  onTrade: (trade) => {
    store.recordTrade(trade)
    earlyLearner.recordTrade(trade)
    const result = engine.ingestTrade(trade)
    if (result) store.recordRadar(result, trade)
    if (result && process.env.LOG_RADAR === '1') console.log(JSON.stringify({ type: 'RADAR', symbol: trade.symbol, ...result }))
  },
  onNativeFunding: (funding) => {
    const affected = fundingResolver.observeNativeFunding(funding)
    let applied = 0
    for (const result of affected) if (applyFundingClusterResult(result)) applied += 1
    if (affected.length && process.env.LOG_TELEMETRY === '1') {
      console.log(JSON.stringify({
        type: 'FUNDING_CLUSTER_LIVE', funder: funding.funder, wallet: funding.wallet,
        affected: affected.length, applied, clusters: affected.map((x) => x.cluster)
      }))
    }
  },
  onLaunch: (launch) => console.log(JSON.stringify({ type: 'LAUNCH', ...launch, blockNumber: launch.blockNumber?.toString?.() })),
  onAudit: ({ token, risk, observedAt }) => {
    store.recordAudit({ token, risk, observedAt })
    const refreshed = engine.refreshRisk(token, risk, observedAt)
    if (refreshed?.txHash) {
      store.recordRadar(refreshed, {
        chain: refreshed.chain,
        token: refreshed.token,
        txHash: refreshed.txHash,
        marketCapUsd: refreshed.marketCapUsd,
        observedAt: refreshed.observedAt
      })
    }
    console.log(JSON.stringify({
      type: 'AUDIT', token, verified: risk.securityVerified, score: risk.auditScore,
      verdict: risk.auditVerdict, hardFail: Boolean(risk.auditHardFail),
      pendingReason: risk.auditPendingReason ?? null,
      sellSimulationPassed: Boolean(risk.sellSimulationPassed),
      refreshedReason: refreshed?.reason ?? null,
      refreshedScore: refreshed?.score ?? null
    }))
  },
  onTelemetry: (event) => process.env.LOG_TELEMETRY === '1' && console.log(JSON.stringify(event))
})

await adapter.start()
console.log(JSON.stringify({
  type: 'READY', chain: 'robinhood', maxMcap: 1_000_000, primeMcap: 100_000,
  walletProfiles: profiles.size, feed: process.env.RH_DISABLE_FEED === '1' ? 'disabled' : 'sequencer',
  eventTransport: process.env.RH_WS_URL ? 'websocket' : 'http-polling',
  shadow: store.summary(), earlyLearning: earlyLearner.summary()
}))

// Funding lookups are intentionally after the live adapter starts: they improve independence scoring
// without delaying the first PRIME WATCH after a process restart.
refreshFundingClusters().catch((e) => console.warn(JSON.stringify({
  type: 'FUNDING_CLUSTER_REFRESH_FAILED', message: String(e?.message ?? e)
})))

const rosterTimer = setInterval(async () => {
  try {
    const sync = await syncPublicWalletRoster(profiles)
    const local = applyLocalEarlyStats()
    for (const [address, profile] of profiles) engine.setWalletProfile(address, profile)
    console.log(JSON.stringify({ type: 'WALLET_ROSTER_REFRESH', ...sync, ...local }))
    refreshFundingClusters().catch(() => {})
  } catch (e) {
    console.warn(JSON.stringify({ type: 'WALLET_ROSTER_REFRESH_FAILED', message: String(e?.message ?? e) }))
  }
}, Number(process.env.WALLET_ROSTER_REFRESH_MS ?? 600_000))
rosterTimer.unref?.()

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    adapter.stop()
    clearInterval(rosterTimer)
    console.log(JSON.stringify({
      type: 'SHUTDOWN', shadow: store.summary(), earlyLearning: earlyLearner.summary()
    }))
    store.close()
    process.exit(0)
  })
}
