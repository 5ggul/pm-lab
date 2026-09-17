import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

const dbPath = process.env.RADAR_DB_PATH ?? 'meme-radar-shadow.sqlite'
const outPath = process.env.SHADOW_REPORT_OUT ?? 'shadow-report.json'

if (!fs.existsSync(dbPath)) {
  const empty = { generatedAt: new Date().toISOString(), dbPath, error: 'database_not_found' }
  fs.writeFileSync(outPath, JSON.stringify(empty, null, 2))
  console.log(JSON.stringify(empty, null, 2))
  process.exit(0)
}

const db = new DatabaseSync(dbPath, { readOnly: true })
const rows = (sql, ...params) => db.prepare(sql).all(...params)
const row = (sql, ...params) => db.prepare(sql).get(...params)
const num = (v) => Number(v ?? 0)
const pct = (a, b) => b > 0 ? Math.round((a / b) * 10_000) / 100 : 0

const totals = {
  trades: num(row('SELECT COUNT(*) n FROM trades')?.n),
  buyTrades: num(row("SELECT COUNT(*) n FROM trades WHERE side='buy'")?.n),
  sellTrades: num(row("SELECT COUNT(*) n FROM trades WHERE side='sell'")?.n),
  radarEvents: num(row('SELECT COUNT(*) n FROM radar_events')?.n),
  watchSignals: num(row("SELECT COUNT(*) n FROM signals WHERE kind='WATCH'")?.n),
  verifiedSignals: num(row("SELECT COUNT(*) n FROM signals WHERE kind='VERIFIED'")?.n),
  uniqueSignalTokens: num(row('SELECT COUNT(DISTINCT token) n FROM signals')?.n),
  fundingProfiles: num(row('SELECT COUNT(*) n FROM funding_clusters')?.n),
  sharedFundingClusters: num(row(`
    SELECT COUNT(*) n FROM (
      SELECT cluster_key FROM funding_clusters
      WHERE funder IS NOT NULL
      GROUP BY cluster_key HAVING COUNT(*) >= 2
    )
  `)?.n)
}

const buyerCoverageRow = row(`
  SELECT
    SUM(side='buy') buy_trades,
    SUM(side='buy' AND participant IS NOT NULL) identified_buys,
    COUNT(DISTINCT CASE WHEN side='buy' AND participant IS NOT NULL THEN participant END) unique_buyers,
    SUM(side='buy' AND market_cap_usd < 100000) prime_buys,
    SUM(side='buy' AND market_cap_usd < 100000 AND participant IS NOT NULL) prime_identified_buys,
    COUNT(DISTINCT CASE WHEN side='buy' AND market_cap_usd < 100000 AND participant IS NOT NULL THEN participant END) prime_unique_buyers
  FROM trades
`)
const buyerCoverage = {
  buyTrades: num(buyerCoverageRow?.buy_trades),
  identifiedBuyTrades: num(buyerCoverageRow?.identified_buys),
  identifiedBuyRatePct: pct(num(buyerCoverageRow?.identified_buys), num(buyerCoverageRow?.buy_trades)),
  uniqueBuyers: num(buyerCoverageRow?.unique_buyers),
  primeBuyTrades: num(buyerCoverageRow?.prime_buys),
  primeIdentifiedBuyTrades: num(buyerCoverageRow?.prime_identified_buys),
  primeIdentifiedBuyRatePct: pct(num(buyerCoverageRow?.prime_identified_buys), num(buyerCoverageRow?.prime_buys)),
  primeUniqueBuyers: num(buyerCoverageRow?.prime_unique_buyers)
}

const byBand = rows(`
  SELECT band,
         SUM(kind='WATCH') watch,
         SUM(kind='VERIFIED') verified,
         COUNT(DISTINCT token) tokens,
         ROUND(AVG(market_cap_usd), 2) avg_mcap,
         ROUND(AVG(score), 2) avg_score
  FROM signals GROUP BY band ORDER BY MIN(market_cap_usd)
`).map((r) => ({
  band: r.band,
  watch: num(r.watch),
  verified: num(r.verified),
  tokens: num(r.tokens),
  avgMcapUsd: num(r.avg_mcap),
  avgScore: num(r.avg_score)
}))

const attribution = rows(`
  SELECT COALESCE(attribution,'unknown') attribution, COUNT(*) n,
         ROUND(SUM(usd_value), 2) usd
  FROM trades GROUP BY attribution ORDER BY n DESC
`).map((r) => ({ attribution: r.attribution, trades: num(r.n), usd: num(r.usd) }))

const mcapBands = rows(`
  SELECT CASE
    WHEN market_cap_usd < 100000 THEN '<100K'
    WHEN market_cap_usd < 300000 THEN '100-300K'
    WHEN market_cap_usd < 600000 THEN '300-600K'
    WHEN market_cap_usd < 1000000 THEN '600K-1M'
    ELSE '>=1M' END band,
    COUNT(*) trades,
    COUNT(DISTINCT token) tokens,
    ROUND(SUM(usd_value),2) usd
  FROM trades GROUP BY band
  ORDER BY MIN(market_cap_usd)
`).map((r) => ({ band: r.band, trades: num(r.trades), tokens: num(r.tokens), usd: num(r.usd) }))

const gateReasons = rows(`
  SELECT COALESCE(band,'OUT_OF_RANGE') band, reason,
         COUNT(*) events,
         COUNT(DISTINCT token) tokens,
         ROUND(AVG(score),2) avg_score,
         ROUND(MAX(score),2) max_score,
         MAX(smart_buyers) max_smart_buyers,
         MAX(buyers_10s) max_buyers_10s,
         ROUND(MAX(buy_usd_10s),2) max_buy_usd_10s
  FROM radar_events
  GROUP BY band, reason
  ORDER BY MIN(market_cap_usd), events DESC
`).map((r) => ({
  band: r.band,
  reason: r.reason,
  events: num(r.events),
  tokens: num(r.tokens),
  avgScore: num(r.avg_score),
  maxScore: num(r.max_score),
  maxSmartBuyers: num(r.max_smart_buyers),
  maxBuyers10s: num(r.max_buyers_10s),
  maxBuyUsd10s: num(r.max_buy_usd_10s)
}))

const primeRow = row(`
  SELECT COUNT(*) events,
         COUNT(DISTINCT token) tokens,
         MAX(score) max_score,
         MAX(buyers_10s) max_buyers_10s,
         MAX(smart_buyers) max_smart_buyers,
         SUM(buyers_10s >= 3) buyer_gate_events,
         SUM(smart_buyers >= 1) smart_gate_events,
         SUM(buyers_10s >= 3 AND smart_buyers >= 1) buyer_smart_gate_events,
         SUM(security_verified = 1) security_verified_events
  FROM radar_events
  WHERE market_cap_usd < 100000
`)
const primeDiagnostics = {
  events: num(primeRow?.events),
  tokens: num(primeRow?.tokens),
  maxScore: num(primeRow?.max_score),
  maxBuyers10s: num(primeRow?.max_buyers_10s),
  maxSmartBuyers: num(primeRow?.max_smart_buyers),
  buyerGateEvents: num(primeRow?.buyer_gate_events),
  smartGateEvents: num(primeRow?.smart_gate_events),
  buyerAndSmartGateEvents: num(primeRow?.buyer_smart_gate_events),
  securityVerifiedEvents: num(primeRow?.security_verified_events)
}

const nearestPrime = rows(`
  SELECT token, reason, ROUND(market_cap_usd,2) mcap, ROUND(score,2) score,
         smart_buyers, buyers_10s, unidentified_buy_events_10s,
         ROUND(buy_usd_10s,2) buy_usd_10s, ROUND(buy_sell_ratio,2) buy_sell_ratio,
         security_verified
  FROM radar_events
  WHERE market_cap_usd < 100000
  ORDER BY smart_buyers DESC, buyers_10s DESC, score DESC, buy_usd_10s DESC
  LIMIT 12
`).map((r) => ({
  token: r.token,
  reason: r.reason,
  marketCapUsd: num(r.mcap),
  score: num(r.score),
  smartBuyers: num(r.smart_buyers),
  buyers10s: num(r.buyers_10s),
  unidentifiedBuyEvents10s: num(r.unidentified_buy_events_10s),
  buyUsd10s: num(r.buy_usd_10s),
  buySellRatio: num(r.buy_sell_ratio),
  securityVerified: Boolean(r.security_verified)
}))

const signalOutcomes = rows(`
  SELECT s.band, o.horizon_s,
         COUNT(*) n,
         ROUND(AVG(o.multiple), 4) avg_multiple,
         ROUND(AVG(CASE WHEN o.multiple >= 2 THEN 1.0 ELSE 0 END), 4) hit_2x,
         ROUND(AVG(CASE WHEN o.multiple <= 0.25 THEN 1.0 ELSE 0 END), 4) rug_rate
  FROM outcomes o JOIN signals s ON s.id=o.signal_id
  WHERE s.kind='VERIFIED'
  GROUP BY s.band, o.horizon_s
  ORDER BY MIN(s.market_cap_usd), o.horizon_s
`).map((r) => ({
  band: r.band,
  horizonS: num(r.horizon_s),
  samples: num(r.n),
  avgMultiple: num(r.avg_multiple),
  hit2xRate: num(r.hit_2x),
  rugRate: num(r.rug_rate)
}))

const sharedClusters = rows(`
  SELECT cluster_key, funder, COUNT(*) wallets
  FROM funding_clusters
  WHERE funder IS NOT NULL
  GROUP BY cluster_key, funder
  HAVING COUNT(*) >= 2
  ORDER BY wallets DESC LIMIT 20
`).map((r) => ({ cluster: r.cluster_key, funder: r.funder, wallets: num(r.wallets) }))

const smartWallets = rows(`
  SELECT sw.wallet,
         COUNT(DISTINCT sw.signal_id) signals,
         COUNT(DISTINCT CASE WHEN s.market_cap_usd < 100000 THEN sw.signal_id END) prime_signals,
         ROUND(MIN(s.market_cap_usd),2) min_entry_mcap
  FROM signal_wallets sw JOIN signals s ON s.id=sw.signal_id
  WHERE s.kind='VERIFIED'
  GROUP BY sw.wallet ORDER BY prime_signals DESC, signals DESC LIMIT 25
`).map((r) => ({
  wallet: r.wallet,
  verifiedSignals: num(r.signals),
  primeSignals: num(r.prime_signals),
  minEntryMcapUsd: num(r.min_entry_mcap)
}))

const report = {
  generatedAt: new Date().toISOString(),
  dbPath,
  totals,
  buyerCoverage,
  byBand,
  mcapBands,
  attribution,
  gateReasons,
  primeDiagnostics,
  nearestPrime,
  signalOutcomes,
  sharedClusters,
  smartWallets,
  note: 'Shadow-mode research only. WATCH may precede audit; VERIFIED requires the safety gate.'
}

fs.writeFileSync(outPath, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
db.close()
