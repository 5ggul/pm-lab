import test from 'node:test'
import assert from 'node:assert/strict'
import { ShadowStore } from '../src/store.js'

const WALLET = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const TOKEN = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

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

test('trade rows deduplicate by transaction/token/trader/side', () => {
  const store = new ShadowStore(':memory:')
  const trade = {
    chain: 'robinhood', token: TOKEN,
    txHash: '0x1234', trader: WALLET, isBuy: true,
    usdValue: 100, marketCapUsd: 45_000, observedAt: 100,
    attribution: 'verified_trade', risk: {}
  }
  store.recordTrade(trade)
  store.recordTrade(trade)
  assert.equal(store.summary().trades, 1)
  store.close()
})
