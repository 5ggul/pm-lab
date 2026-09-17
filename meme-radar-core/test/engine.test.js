import assert from 'node:assert/strict'
import test from 'node:test'
import { RadarEngine } from '../src/engine.js'

const TOKEN = '0x3333333333333333333333333333333333333333'
const WALLET = '0x1111111111111111111111111111111111111111'
const BUYER2 = '0x2222222222222222222222222222222222222222'
const BUYER3 = '0x4444444444444444444444444444444444444444'

function engineWith(profile) {
  const now = 1_800_000_000_000
  const engine = new RadarEngine({ walletProfiles: new Map([[WALLET, profile]]), now: () => now })
  engine.tokens.set(TOKEN, {
    firstSeen: now - 1_000,
    trades: [{
      token: TOKEN,
      chain: 'robinhood',
      symbol: 'SIM',
      txHash: `0x${'1'.repeat(64)}`,
      isBuy: true,
      trader: WALLET,
      participant: WALLET,
      usdValue: 500,
      marketCapUsd: 50_000,
      liquidityUsd: 20_000,
      observedAt: now
    }]
  })
  return { engine, now }
}

test('high numeric quality cannot bypass explicit smart eligibility', () => {
  const { engine, now } = engineWith({ quality: 95, smartEligible: false, fundingCluster: WALLET })
  const metrics = engine.metrics(TOKEN, { observedAt: now, marketCapUsd: 50_000 })
  assert.equal(metrics.uniqueBuyers10s, 1)
  assert.equal(metrics.independentSmartBuyers, 0)
  assert.deepEqual(metrics.smartWallets, [])
})

test('explicitly eligible quality-70+ wallet receives smart credit', () => {
  const { engine, now } = engineWith({ quality: 82, smartEligible: true, fundingCluster: WALLET })
  const metrics = engine.metrics(TOKEN, { observedAt: now, marketCapUsd: 50_000 })
  assert.equal(metrics.independentSmartBuyers, 1)
  assert.deepEqual(metrics.smartWallets, [WALLET])
  assert.equal(metrics.avgSmartWalletQuality, 82)
})

test('fast audit clearance can upgrade active PRIME conditions without a synthetic trade', () => {
  const now = 1_800_000_000_000
  const watches = []
  const signals = []
  const engine = new RadarEngine({
    walletProfiles: new Map([[WALLET, { quality: 95, smartEligible: true, fundingCluster: WALLET }]]),
    onWatch: (event) => watches.push(event),
    onSignal: (event) => signals.push(event),
    now: () => now
  })
  engine.tokens.set(TOKEN, {
    firstSeen: now - 1_000,
    trades: [WALLET, BUYER2, BUYER3].map((participant, index) => ({
      token: TOKEN,
      chain: 'robinhood',
      symbol: 'SIM',
      txHash: `0x${String(index + 1).repeat(64)}`,
      isBuy: true,
      trader: index === 0 ? WALLET : participant,
      participant,
      usdValue: 3_000,
      marketCapUsd: 50_000,
      liquidityUsd: 20_000,
      observedAt: now
    }))
  })

  const pending = engine.refreshRisk(TOKEN, {
    securityVerified: false,
    auditVerdict: 'UNKNOWN',
    auditScore: 0
  }, now + 1_000)
  assert.equal(pending.reason, 'SECURITY_PENDING')
  assert.equal(pending.uniqueBuyers10s, 3)
  assert.equal(watches.length, 1)
  assert.equal(signals.length, 0)

  const verified = engine.refreshRisk(TOKEN, {
    securityVerified: true,
    auditVerdict: 'LOW_RISK',
    auditScore: 90,
    linkedWalletRisk: 0.1,
    holderClusterRisk: 0.1,
    creatorRisk: 0.1
  }, now + 2_000)
  assert.equal(verified.reason, 'SIGNAL')
  assert.equal(verified.eligible, true)
  assert.equal(signals.length, 1)
  assert.equal(engine.tokens.get(TOKEN).trades.length, 3)
})

test('late audit clearance does not resurrect an expired 10-second buyer burst', () => {
  const now = 1_800_000_000_000
  const signals = []
  const engine = new RadarEngine({
    walletProfiles: new Map([[WALLET, { quality: 95, smartEligible: true, fundingCluster: WALLET }]]),
    onSignal: (event) => signals.push(event),
    now: () => now
  })
  engine.tokens.set(TOKEN, {
    firstSeen: now - 1_000,
    trades: [WALLET, BUYER2, BUYER3].map((participant, index) => ({
      token: TOKEN,
      chain: 'robinhood',
      symbol: 'SIM',
      txHash: `0x${String(index + 5).repeat(64)}`,
      isBuy: true,
      trader: index === 0 ? WALLET : participant,
      participant,
      usdValue: 3_000,
      marketCapUsd: 50_000,
      liquidityUsd: 20_000,
      observedAt: now
    }))
  })

  const result = engine.refreshRisk(TOKEN, {
    securityVerified: true,
    auditVerdict: 'LOW_RISK',
    auditScore: 90,
    linkedWalletRisk: 0.1,
    holderClusterRisk: 0.1,
    creatorRisk: 0.1
  }, now + 11_000)

  assert.equal(result.reason, 'BUYER_VELOCITY_LOW')
  assert.equal(result.uniqueBuyers10s, 0)
  assert.equal(signals.length, 0)
})
