import assert from 'node:assert/strict'
import test from 'node:test'
import { RadarEngine } from '../src/engine.js'

const TOKEN = '0x3333333333333333333333333333333333333333'
const WALLET = '0x1111111111111111111111111111111111111111'

function engineWith(profile) {
  const now = 1_800_000_000_000
  const engine = new RadarEngine({ walletProfiles: new Map([[WALLET, profile]]), now: () => now })
  engine.tokens.set(TOKEN, {
    firstSeen: now - 1_000,
    trades: [{
      isBuy: true,
      trader: WALLET,
      participant: WALLET,
      usdValue: 500,
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
