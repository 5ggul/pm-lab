import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { EarlyWalletLearner } from '../src/early-wallet-learning.js'

const WALLET = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const token = (n) => `0x${n.toString(16).padStart(40, '0')}`
const tx = (n) => `0x${n.toString(16).padStart(64, '0')}`

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
    learner.settleToken(token(i), 10_000 * multiple, start + 21_600_100)
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
