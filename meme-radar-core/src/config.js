export const RADAR_CONFIG = Object.freeze({
  maxMarketCapUsd: 1_000_000,
  primeMarketCapUsd: 100_000,
  windowsMs: [10_000, 30_000, 60_000],
  alertCooldownMs: 15_000,
  minTradeUsd: 40,
  bands: [
    { key: 'PRIME_EARLY', min: 0, max: 100_000, threshold: 60, minUniqueBuyers10s: 3, minIndependentSmart: 1 },
    { key: 'EARLY', min: 100_000, max: 300_000, threshold: 70, minUniqueBuyers10s: 5, minIndependentSmart: 2 },
    { key: 'MOMENTUM', min: 300_000, max: 600_000, threshold: 79, minUniqueBuyers10s: 8, minIndependentSmart: 2 },
    { key: 'LATE_EARLY', min: 600_000, max: 1_000_000, threshold: 87, minUniqueBuyers10s: 12, minIndependentSmart: 3 }
  ],
  weights: {
    smartWalletQuality: 0.30,
    independentSmartBuyers: 0.20,
    buyerVelocity: 0.15,
    capitalVelocity: 0.10,
    buySellImbalance: 0.10,
    safety: 0.10,
    liquidity: 0.05
  },
  hardReject: {
    sellSimulationFailed: true,
    honeypot: true,
    devDump: true,
    linkedWalletRisk: 0.82,
    holderClusterRisk: 0.85
  }
})

export function marketCapBand(marketCapUsd) {
  if (!Number.isFinite(marketCapUsd) || marketCapUsd < 0) return null
  return RADAR_CONFIG.bands.find((b) => marketCapUsd >= b.min && marketCapUsd < b.max) ?? null
}
