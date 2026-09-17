import test from 'node:test'
import assert from 'node:assert/strict'
import { ShadowStore } from '../src/store.js'

const WALLET = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const TOKEN = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const TX = `0x${'1'.repeat(64)}`

test('shadow store records verified PRIME and settles six-hour outcomes', () => {
  const store = new ShadowStore(':memory:')
  const observedAt = 1_000_000
  const signal = {
    chain: 'robinhood', token: TOKEN, symbol: 'SIM', band: 'PRIME_EARLY',
    score: 82, threshold: 60, marketCapUsd: 50_000,
    independentSmartBuyers: 1, uniqueBuyers10s: 5, buyUsd10s: 4_000,
    buySellRatio: 6, observedAt, smartWallets: [WALLET],
    risk: { securityVerified: true, auditVerdict: 'PASS' }
  }
  const id = store.recordSignal(signal, 'VERIFIED')
  assert.ok(id > 0)

  store.settleOutcomes(TOKEN, 200_000, observedAt + 21_600_000)
  const stats = store.walletEarlyStats(WALLET)
  assert.equal(stats.settledEarlyTrades, 1)
  assert.equal(stats.winRate, 1)
  assert.equal(stats.hit2xRate, 1)
  assert.equal(stats.hit5xRate, 0)
  assert.equal(stats.rugRate, 0)

  const summary = store.summary()
  assert.equal(summary.signals, 1)
  assert.equal(summary.outcomes, 5)
  store.close()
})

test('trade rows deduplicate while preserving receipt-resolved participant', () => {
  const store = new ShadowStore(':memory:')
  const trade = {
    chain: 'robinhood', token: TOKEN,
    txHash: TX, trader: WALLET, participant: WALLET, participantSource: 'token_transfer_recipient', isBuy: true,
    usdValue: 100, marketCapUsd: 45_000, observedAt: 100,
    attribution: 'verified_trade', risk: {}
  }
  store.recordTrade(trade)
  store.recordTrade(trade)
  assert.equal(store.summary().trades, 1)
  const saved = store.db.prepare('SELECT participant, participant_source FROM trades').get()
  assert.equal(saved.participant, WALLET)
  assert.equal(saved.participant_source, 'token_transfer_recipient')
  store.close()
})

test('radar gate decision is persisted once per token transaction', () => {
  const store = new ShadowStore(':memory:')
  const trade = {
    chain: 'robinhood', token: TOKEN, txHash: TX,
    observedAt: 200, marketCapUsd: 55_000
  }
  const result = {
    chain: 'robinhood', token: TOKEN, band: 'PRIME_EARLY', reason: 'SMART_BUYERS_LOW',
    score: 31.5, threshold: 60, marketCapUsd: 55_000,
    independentSmartBuyers: 0, uniqueBuyers10s: 4, unidentifiedBuyEvents10s: 1,
    buyUsd10s: 1200, sellUsd10s: 100, buySellRatio: 12,
    risk: { securityVerified: false }, components: { buyerVelocity: 33 }, observedAt: 200
  }
  store.recordRadar(result, trade)
  store.recordRadar({ ...result, score: 32 }, trade)
  const saved = store.db.prepare('SELECT reason, score, buyers_10s FROM radar_events').get()
  assert.equal(store.summary().radarEvents, 1)
  assert.equal(saved.reason, 'SMART_BUYERS_LOW')
  assert.equal(saved.score, 32)
  assert.equal(saved.buyers_10s, 4)
  store.close()
})

test('audit retries are preserved and latest audit returns newest safety state', () => {
  const store = new ShadowStore(':memory:')
  store.recordAudit({
    token: TOKEN,
    observedAt: 1_000,
    risk: {
      auditVerdict: 'UNKNOWN', auditScore: 0, securityVerified: false,
      auditHardFail: false, auditPendingReason: 'AUDIT_DATA_PROPAGATION_PENDING',
      sellSimulationPassed: true, holdersKnown: false
    }
  })
  store.recordAudit({
    token: TOKEN,
    observedAt: 121_000,
    risk: {
      auditVerdict: 'LOW_RISK', auditScore: 91, securityVerified: true,
      auditHardFail: false, auditPendingReason: null,
      sellSimulationPassed: true, holdersKnown: true
    }
  })

  assert.equal(store.summary().audits, 2)
  const history = store.db.prepare('SELECT verdict FROM audits ORDER BY observed_at').all()
  assert.deepEqual(history.map((r) => r.verdict), ['UNKNOWN', 'LOW_RISK'])

  const latest = store.getLatestAudit(TOKEN)
  assert.equal(latest.verdict, 'LOW_RISK')
  assert.equal(latest.score, 91)
  assert.equal(latest.securityVerified, true)
  assert.equal(latest.sellSimulationPassed, true)
  assert.equal(latest.risk.holdersKnown, true)
  store.close()
})
