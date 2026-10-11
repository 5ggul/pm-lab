import { RADAR_CONFIG, marketCapBand } from './config.js'

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0))
const scale = (n, fullAt) => clamp((n / fullAt) * 100)

export function walletQuality(profile) {
  if (!profile) return 0
  if (Number.isFinite(profile.quality)) return clamp(profile.quality)
  const sample = Math.max(0, profile.earlyTrades ?? 0)
  if (sample < 5) return Math.min(45, sample * 7)
  const earlyWin = clamp((profile.earlyWinRate ?? 0) * 100)
  const realized = scale(Math.log10(Math.max(1, (profile.realizedPnlUsd ?? 0) + 1)), 5.2)
  const recent = clamp((profile.recentWinRate ?? profile.earlyWinRate ?? 0) * 100)
  const rugAvoid = clamp((1 - (profile.rugRate ?? 1)) * 100)
  const lowMcapSkill = clamp((profile.sub100kShare ?? 0) * 100)
  const sampleScore = scale(sample, 40)
  const medianEntryBonus = profile.medianEntryMcapUsd > 0
    ? clamp(100 - ((profile.medianEntryMcapUsd - 20_000) / 1_800))
    : 0
  return clamp(
    earlyWin * 0.26 + realized * 0.16 + recent * 0.14 + rugAvoid * 0.14 +
    lowMcapSkill * 0.13 + sampleScore * 0.09 + medianEntryBonus * 0.08
  )
}

export function safetyScore(risk = {}) {
  if (risk.securityVerified !== true) return 0
  if (risk.auditHardFail || risk.sellSimulationFailed || risk.honeypot || risk.devDump) return 0
  const linked = clamp((1 - (risk.linkedWalletRisk ?? 0.25)) * 100)
  const holders = clamp((1 - (risk.holderClusterRisk ?? 0.25)) * 100)
  const creator = clamp((1 - (risk.creatorRisk ?? 0.25)) * 100)
  const audit = Number.isFinite(risk.auditScore) ? clamp(risk.auditScore) : 65
  return linked * 0.28 + holders * 0.24 + creator * 0.18 + audit * 0.30
}

export function hasHardReject(input) {
  const r = input.risk ?? {}
  return Boolean(
    r.auditHardFail || r.sellSimulationFailed || r.honeypot || r.devDump || r.seeded ||
    (r.linkedWalletRisk ?? 0) >= RADAR_CONFIG.hardReject.linkedWalletRisk ||
    (r.holderClusterRisk ?? 0) >= RADAR_CONFIG.hardReject.holderClusterRisk
  )
}

export function scoreSignal(input) {
  const band = marketCapBand(input.marketCapUsd)
  if (!band || input.marketCapUsd >= RADAR_CONFIG.maxMarketCapUsd) {
    return { eligible: false, watch: false, reason: 'MCAP_OUT_OF_RANGE', score: 0, band: null }
  }
  if (hasHardReject(input)) {
    return { eligible: false, watch: false, reason: 'HARD_RISK_REJECT', score: 0, band: band.key }
  }

  const quality = clamp(input.avgSmartWalletQuality ?? 0)
  const independent = clamp((input.independentSmartBuyers ?? 0) * 28)
  const buyers = scale(input.uniqueBuyers10s ?? 0, Math.max(12, band.minUniqueBuyers10s * 2))
  const capital = scale(input.buyUsd10s ?? 0, Math.max(8_000, input.marketCapUsd * 0.08))
  const imbalance = clamp(Math.log2(Math.max(1, input.buySellRatio ?? 1)) * 24)
  const safe = safetyScore(input.risk)
  const liquidity = scale(input.liquidityUsd ?? 0, Math.max(10_000, input.marketCapUsd * 0.18))
  const w = RADAR_CONFIG.weights
  let score = quality * w.smartWalletQuality + independent * w.independentSmartBuyers +
    buyers * w.buyerVelocity + capital * w.capitalVelocity + imbalance * w.buySellImbalance +
    safe * w.safety + liquidity * w.liquidity
  if (band.key === 'PRIME_EARLY') score += 5
  score = clamp(score)

  const smartGate = (input.independentSmartBuyers ?? 0) >= band.minIndependentSmart
  const buyerGate = (input.uniqueBuyers10s ?? 0) >= band.minUniqueBuyers10s
  const securityGate = input.risk?.securityVerified === true
  const thresholdGate = score >= band.threshold
  const watch = band.key === 'PRIME_EARLY' && smartGate && buyerGate && !securityGate

  return {
    eligible: smartGate && buyerGate && securityGate && thresholdGate,
    watch,
    reason: !smartGate ? 'SMART_BUYERS_LOW' : !buyerGate ? 'BUYER_VELOCITY_LOW' : !securityGate ? 'SECURITY_PENDING' : !thresholdGate ? 'SCORE_LOW' : 'SIGNAL',
    score: Math.round(score * 10) / 10,
    band: band.key,
    threshold: band.threshold,
    components: {
      smartWalletQuality: Math.round(quality), independentSmartBuyers: Math.round(independent),
      buyerVelocity: Math.round(buyers), capitalVelocity: Math.round(capital),
      buySellImbalance: Math.round(imbalance), safety: Math.round(safe), liquidity: Math.round(liquidity)
    }
  }
}
