import test from 'node:test'
import assert from 'node:assert/strict'
import { marketCapBand } from '../src/config.js'
import { scoreSignal } from '../src/scoring.js'
import { classifyWalletAttribution } from '../src/provenance.js'

const strongPrime = {
  marketCapUsd: 45_000,
  liquidityUsd: 15_000,
  uniqueBuyers10s: 8,
  buyUsd10s: 9_000,
  buySellRatio: 8,
  independentSmartBuyers: 2,
  avgSmartWalletQuality: 86
}

test('market cap routing prioritizes sub-100k but keeps sub-1m universe', () => {
  assert.equal(marketCapBand(99_999).key, 'PRIME_EARLY')
  assert.equal(marketCapBand(100_000).key, 'EARLY')
  assert.equal(marketCapBand(599_999).key, 'MOMENTUM')
  assert.equal(marketCapBand(999_999).key, 'LATE_EARLY')
  assert.equal(marketCapBand(1_000_000), null)
})

test('prime unverified setup becomes WATCH, never a verified signal', () => {
  const r = scoreSignal({ ...strongPrime, risk: { securityVerified: false } })
  assert.equal(r.watch, true)
  assert.equal(r.eligible, false)
  assert.equal(r.reason, 'SECURITY_PENDING')
})

test('verified strong sub-100k setup can promote to signal', () => {
  const r = scoreSignal({
    ...strongPrime,
    risk: { securityVerified: true, auditScore: 85, linkedWalletRisk: 0.1, holderClusterRisk: 0.1, creatorRisk: 0.1 }
  })
  assert.equal(r.eligible, true)
  assert.equal(r.band, 'PRIME_EARLY')
})

test('seeded/direct-wallet manipulation never promotes', () => {
  const r = scoreSignal({ ...strongPrime, risk: { securityVerified: true, auditScore: 90, seeded: true } })
  assert.equal(r.eligible, false)
  assert.equal(r.reason, 'HARD_RISK_REJECT')
})

test('direct and dust wallet injections do not count as smart buys', () => {
  const direct = classifyWalletAttribution({
    receiptTo: '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f', usdValue: 1000, profile: { medianBuyUsd: 1000 }
  })
  assert.equal(direct.countsAsSmart, false)

  const dust = classifyWalletAttribution({
    receiptTo: '0x1111111111111111111111111111111111111111', usdValue: 4, profile: { medianBuyUsd: 1000 }
  })
  assert.equal(dust.kind, 'dust')

  const real = classifyWalletAttribution({
    receiptTo: '0x1111111111111111111111111111111111111111', usdValue: 100, profile: { medianBuyUsd: 1000 }
  })
  assert.equal(real.kind, 'verified_trade')
})
