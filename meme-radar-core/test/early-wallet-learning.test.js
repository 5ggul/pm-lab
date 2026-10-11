import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { EarlyWalletLearner } from '../src/early-wallet-learning.js'

const WALLET = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const token = (n) => `0x${n.toString(16).padStart(40, '0')}`
const tx = (n) => `0x${n.toString(16).padStart(64, '0')}`
const pool = (n) => `0x${n.toString(16).padStart(64, '0')}`

function pricedTrade({ tokenAddress, txHash, observedAt, marketCapUsd = 12_000, usdValue = 50 }) {
  return {
    token: tokenAddress,
    participant: WALLET,
    participantSource: 'sequencer_signed_buy',
    txHash,
    isBuy: true,
    usdValue,
    marketCapUsd,
    observedAt,
    pricingContext: {
      venue: 'uniswap-v4',
      poolId: pool(1),
      tokenIs0: true,
      quoteAddress: '0x0000000000000000000000000000000000000000',
      quoteSymbol: 'ETH',
      quoteDecimals: 18,
      quoteUsdKind: 'eth'
    }
  }
}

test('learner ignores dust and records first meaningful sub-100k entry per wallet token', () => {
  const db = new DatabaseSync(':memory:')
  const learner = new EarlyWalletLearner(db, { minBuyUsd: 20 })

  learner.recordTrade({
    token: token(1), participant: WALLET, participantSource: 'sequencer_signed_buy',
    txHash: tx(1), isBuy: true, usdValue: 5, marketCapUsd: 10_000, observedAt: 1000
  })
  assert.equal(learner.summary().entries, 0)

  learner.recordTrade({
    token: token(1), participant: WALLET, participantSource: 'sequencer_signed_buy',
    txHash: tx(2), isBuy: true, usdValue: 50, marketCapUsd: 12_000, observedAt: 2000
  })
  learner.recordTrade({
    token: token(1), participant: WALLET, participantSource: 'sequencer_signed_buy',
    txHash: tx(3), isBuy: true, usdValue: 100, marketCapUsd: 15_000, observedAt: 3000
  })

  const row = db.prepare('SELECT * FROM early_wallet_entries').get()
  assert.equal(learner.summary().entries, 1)
  assert.equal(row.first_tx_hash, tx(2))
  assert.equal(row.entry_mcap_usd, 12_000)
  assert.equal(row.entry_usd, 50)
  db.close()
})

test('learner settles six-hour outcomes across distinct early tokens and computes wallet quality inputs', () => {
  const db = new DatabaseSync(':memory:')
  const learner = new EarlyWalletLearner(db, { minBuyUsd: 20 })
  const start = 1_000_000

  for (let i = 1; i <= 8; i += 1) {
    learner.recordTrade({
      token: token(i), participant: WALLET, participantSource: 'sequencer_signed_buy',
      txHash: tx(i), isBuy: true, usdValue: 100 + i, marketCapUsd: 10_000,
      observedAt: start + i
    })
  }

  for (let i = 1; i <= 8; i += 1) {
    const multiple = i <= 6 ? 2.5 : 0.2
    learner.settleToken(token(i), 10_000 * multiple, start + 21_600_100, { source: 'v4_state_view' })
  }

  const stats = learner.walletStats(WALLET)
  assert.equal(stats.observedEarlyTokens, 8)
  assert.equal(stats.settledEarlyTrades, 8)
  assert.equal(stats.winRate, 0.75)
  assert.equal(stats.hit2xRate, 0.75)
  assert.equal(stats.hit5xRate, 0)
  assert.equal(stats.rugRate, 0.25)
  assert.equal(stats.medianEntryMcapUsd, 10_000)

  const candidates = learner.listWalletStats({ minObservedTokens: 8, minSettled: 8 })
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].wallet, WALLET)
  db.close()
})

test('pricing context exposes only horizons currently inside their sampling tolerance', () => {
  const db = new DatabaseSync(':memory:')
  const learner = new EarlyWalletLearner(db, { minBuyUsd: 20 })
  const start = 2_000_000
  learner.recordTrade(pricedTrade({ tokenAddress: token(20), txHash: tx(20), observedAt: start }))

  const due = learner.tokensDueForSampling(start + 60_010)
  assert.equal(due.length, 1)
  assert.equal(due[0].token, token(20))
  assert.deepEqual(due[0].horizons, [60])
  assert.equal(due[0].poolId, pool(1))

  const settled = learner.settleToken(token(20), 24_000, start + 60_010, { source: 'v4_state_view' })
  assert.equal(settled, 1)
  const outcome = db.prepare('SELECT horizon_s, source, sample_lag_ms, multiple FROM early_wallet_outcomes').get()
  assert.equal(outcome.horizon_s, 60)
  assert.equal(outcome.source, 'v4_state_view')
  assert.equal(outcome.sample_lag_ms, 10)
  assert.equal(outcome.multiple, 2)
  db.close()
})

test('explicit zero-liquidity outcome records a rug multiple instead of dropping the sample', () => {
  const db = new DatabaseSync(':memory:')
  const learner = new EarlyWalletLearner(db, { minBuyUsd: 20 })
  const start = 2_500_000
  learner.recordTrade(pricedTrade({ tokenAddress: token(22), txHash: tx(22), observedAt: start }))

  assert.equal(learner.settleToken(token(22), 0, start + 60_010, { source: 'v4_state_view_zero_liquidity' }), 0)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM early_wallet_outcomes').get().n, 0)

  const settled = learner.settleToken(token(22), 0, start + 60_010, {
    source: 'v4_state_view_zero_liquidity',
    allowZero: true
  })
  assert.equal(settled, 1)
  const outcome = db.prepare('SELECT horizon_s, source, market_cap_usd, multiple FROM early_wallet_outcomes').get()
  assert.equal(outcome.horizon_s, 60)
  assert.equal(outcome.source, 'v4_state_view_zero_liquidity')
  assert.equal(outcome.market_cap_usd, 0)
  assert.equal(outcome.multiple, 0)
  db.close()
})

test('late current price cannot backfill an expired one-minute outcome', () => {
  const db = new DatabaseSync(':memory:')
  const learner = new EarlyWalletLearner(db, { minBuyUsd: 20 })
  const start = 3_000_000
  learner.recordTrade(pricedTrade({ tokenAddress: token(21), txHash: tx(21), observedAt: start }))

  const settled = learner.settleToken(token(21), 50_000, start + 120_000, { source: 'v4_state_view' })
  assert.equal(settled, 0)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM early_wallet_outcomes').get().n, 0)
  assert.equal(learner.tokensDueForSampling(start + 120_000).length, 0)
  db.close()
})
