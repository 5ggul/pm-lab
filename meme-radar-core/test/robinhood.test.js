import test from 'node:test'
import assert from 'node:assert/strict'
import { privateKeyToAccount } from 'viem/accounts'
import { RobinhoodAdapter } from '../src/robinhood.js'
import { SmartRobinhoodAdapter } from '../src/robinhood-smart.js'

const BUYER = '0x1111111111111111111111111111111111111111'
const ROUTER = '0x2222222222222222222222222222222222222222'
const DIRECT_ROUTER = '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f'
const TOKEN = '0x3333333333333333333333333333333333333333'
const OTHER = '0x6666666666666666666666666666666666666666'
const HASH = `0x${'4'.repeat(64)}`
const wait = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms))

function smartAdapter({
  tracked = true,
  smartEligible = true,
  to = ROUTER,
  receipt = 'error',
  receiptRecipient = BUYER,
  receiptFailures = 0
} = {}) {
  const updates = []
  const telemetry = []
  let receiptCalls = 0
  const adapter = Object.create(SmartRobinhoodAdapter.prototype)
  adapter.sequencerOrigins = new Map([[HASH, {
    sender: BUYER, to, selector: '0x3593564c', seenAt: Date.now(),
    sequencerTimestampMs: Date.now() - 500
  }]])
  adapter.trackedProfiles = tracked
    ? new Map([[BUYER, { quality: smartEligible ? 88 : 62, smartEligible, fundingCluster: BUYER, medianBuyUsd: 100 }]])
    : new Map()
  adapter.onTelemetry = (event) => telemetry.push(event)
  adapter.onAttributionUpdate = (update) => { updates.push(update); return true }
  adapter.smartReceiptJobs = new Map()
  adapter.smartReceiptRetryDelays = () => [0, 0, 0]
  adapter.provenance = new Map()
  adapter.risks = new Map()
  adapter.hood = {
    public: {
      getTransactionReceipt: async () => {
        receiptCalls += 1
        if (receiptCalls <= receiptFailures || receipt === 'error') throw new Error('receipt RPC unavailable')
        return { to }
      }
    }
  }
  adapter.decodeTokenTransfers = () => receipt === 'error'
    ? []
    : [{ from: to, to: receiptRecipient, value: 100n }]
  return { adapter, updates, telemetry, receiptCalls: () => receiptCalls }
}

test('normalizes tx sender as ordinary buyer participant even when it is not a tracked smart wallet', async () => {
  const adapter = Object.create(RobinhoodAdapter.prototype)
  adapter.hood = { public: { getTransaction: async () => ({ from: BUYER, to: ROUTER }) } }
  adapter.trackedProfiles = new Map()
  adapter.onTelemetry = () => {}
  const result = await adapter.attributeTrade({ token: TOKEN }, true, HASH, 125)
  assert.equal(result.participant, BUYER)
  assert.match(result.trader, /^tx:/)
  assert.equal(result.attribution.kind, 'unattributed')
})

test('recovers and caches signer for a generic sequencer router transaction', async () => {
  const account = privateKeyToAccount(`0x${'1'.repeat(64)}`)
  const raw = await account.signTransaction({
    chainId: 4663, nonce: 0, gas: 150_000n,
    maxFeePerGas: 1_000_000_000n, maxPriorityFeePerGas: 100_000_000n,
    to: ROUTER, value: 1n, data: '0x3593564c'
  })
  const adapter = Object.create(RobinhoodAdapter.prototype)
  adapter.sequencerOrigins = new Map()
  adapter.lastOriginPruneAt = 0
  const origin = await adapter.rememberSequencerOrigin({
    raw, hash: HASH, transaction: { to: ROUTER, data: '0x3593564c', value: 1n }
  }, { timestamp: 1_800_000_000 })
  assert.equal(origin.sender, account.address.toLowerCase())
  assert.equal(origin.to, ROUTER)
  assert.equal(origin.selector, '0x3593564c')
  assert.equal(adapter.getSequencerOrigin(HASH)?.sender, account.address.toLowerCase())
})

test('smart-eligible signer is emitted immediately as ordinary buyer while receipt proof is deferred', async () => {
  const { adapter, receiptCalls } = smartAdapter({ receipt: 'ok' })
  const result = await adapter.attributeTrade({ token: TOKEN }, true, HASH, 125)
  assert.equal(result.participant, BUYER)
  assert.equal(result.participantSource, 'sequencer_signed_buy')
  assert.match(result.trader, /^tx:/)
  assert.equal(result.attribution.kind, 'smart_receipt_pending')
  assert.equal(result.attribution.countsAsSmart, false)
  assert.equal(result.deferredSmart.signer, BUYER)
  assert.equal(receiptCalls(), 0)
})

test('deferred receipt proof upgrades a smart signer after token recipient confirmation', async () => {
  const { adapter, updates } = smartAdapter({ receipt: 'ok' })
  const result = await adapter.attributeTrade({ token: TOKEN }, true, HASH, 125)
  adapter.scheduleSmartReceiptVerification({
    pool: { token: TOKEN }, isBuy: true, transactionHash: HASH, usdValue: 125,
    ...result.deferredSmart
  })
  await wait(15)
  assert.equal(updates.length, 1)
  assert.equal(updates[0].trader, BUYER)
  assert.equal(updates[0].participant, BUYER)
  assert.equal(updates[0].participantSource, 'verified_smart_signer_receipt')
  assert.equal(updates[0].attribution, 'verified_signer_receipt')
  assert.equal(adapter.smartReceiptJobs.size, 0)
})

test('deferred smart receipt retries a transient RPC failure before promotion', async () => {
  const { adapter, updates, receiptCalls } = smartAdapter({ receipt: 'ok', receiptFailures: 1 })
  const result = await adapter.attributeTrade({ token: TOKEN }, true, HASH, 125)
  adapter.scheduleSmartReceiptVerification({
    pool: { token: TOKEN }, isBuy: true, transactionHash: HASH, usdValue: 125,
    ...result.deferredSmart
  })
  await wait(20)
  assert.equal(receiptCalls(), 2)
  assert.equal(updates.length, 1)
  assert.equal(updates[0].attribution, 'verified_signer_receipt')
})

test('smart signer is not promoted when receipt proves the bought token went elsewhere', async () => {
  const { adapter, updates } = smartAdapter({ receipt: 'ok', receiptRecipient: OTHER })
  const result = await adapter.attributeTrade({ token: TOKEN }, true, HASH, 125)
  adapter.scheduleSmartReceiptVerification({
    pool: { token: TOKEN }, isBuy: true, transactionHash: HASH, usdValue: 125,
    ...result.deferredSmart
  })
  await wait(15)
  assert.equal(updates.length, 1)
  assert.equal(updates[0].trader, undefined)
  assert.equal(updates[0].attribution, 'signer_recipient_unverified')
})

test('observation-only WATCH signer is recorded but never receives smart credit', async () => {
  const { adapter } = smartAdapter({ smartEligible: false })
  const result = await adapter.attributeTrade({ token: TOKEN }, true, HASH, 125)
  assert.equal(result.participant, BUYER)
  assert.equal(result.trader, BUYER)
  assert.equal(result.attribution.kind, 'tracked_watch_observation')
  assert.equal(result.attribution.countsAsSmart, false)
  assert.equal(result.deferredSmart, null)
})

test('sequencer signer remains an ordinary buyer but dust buy gets no smart credit', async () => {
  const { adapter, receiptCalls } = smartAdapter()
  const result = await adapter.attributeTrade({ token: TOKEN }, true, HASH, 1)
  assert.equal(result.participant, BUYER)
  assert.equal(result.participantSource, 'sequencer_signed_buy')
  assert.match(result.trader, /^tx:/)
  assert.equal(result.attribution.kind, 'dust')
  assert.equal(result.attribution.countsAsSmart, false)
  assert.equal(result.deferredSmart, null)
  assert.equal(receiptCalls(), 0)
})

test('known relayer/direct-router uses receipt token leg to recover ordinary buyer', async () => {
  const { adapter } = smartAdapter({ to: DIRECT_ROUTER, receipt: 'ok', receiptRecipient: OTHER })
  const result = await adapter.attributeTrade({ token: TOKEN }, true, HASH, 125)
  assert.equal(result.participant, OTHER)
  assert.equal(result.participantSource, 'router_leg')
  assert.match(result.trader, /^tx:/)
  assert.equal(result.attribution.kind, 'direct')
  assert.equal(result.attribution.countsAsSmart, false)
})

test('known relayer remains unresolved if receipt RPC is unavailable', async () => {
  const { adapter } = smartAdapter({ to: DIRECT_ROUTER, receipt: 'error' })
  const result = await adapter.attributeTrade({ token: TOKEN }, true, HASH, 125)
  assert.equal(result.participant, null)
  assert.equal(result.participantSource, 'sequencer_relayer_unresolved')
  assert.match(result.trader, /^tx:/)
  assert.equal(result.attribution.kind, 'direct')
})

test('untracked sequencer signer counts only as ordinary buyer without receipt dependency', async () => {
  const { adapter, receiptCalls } = smartAdapter({ tracked: false })
  const result = await adapter.attributeTrade({ token: TOKEN }, true, HASH, 125)
  assert.equal(result.participant, BUYER)
  assert.equal(result.participantSource, 'sequencer_signed_buy')
  assert.match(result.trader, /^tx:/)
  assert.equal(result.attribution.kind, 'unattributed')
  assert.equal(result.deferredSmart, null)
  assert.equal(receiptCalls(), 0)
})

test('three smart-eligible tracked dust signers can mark seeded manipulation without becoming smart', async () => {
  const wallets = [
    '0x1111111111111111111111111111111111111111',
    '0x4444444444444444444444444444444444444444',
    '0x5555555555555555555555555555555555555555'
  ]
  const adapter = Object.create(SmartRobinhoodAdapter.prototype)
  adapter.trackedProfiles = new Map(wallets.map((wallet) => [wallet, { quality: 80, smartEligible: true, medianBuyUsd: 100 }]))
  adapter.onTelemetry = () => {}
  adapter.provenance = new Map()
  let final
  for (let i = 0; i < wallets.length; i += 1) {
    const hash = `0x${String(i + 6).repeat(64)}`
    adapter.sequencerOrigins = new Map([[hash, { sender: wallets[i], to: ROUTER, selector: '0x3593564c', seenAt: Date.now() }]])
    final = await adapter.attributeTrade({ token: TOKEN }, true, hash, 1)
    assert.equal(final.attribution.countsAsSmart, false)
  }
  assert.equal(final.seeded, true)
})

test('observation-only WATCH dust signers do not trigger seeded manipulation', async () => {
  const wallets = [
    '0x1111111111111111111111111111111111111111',
    '0x4444444444444444444444444444444444444444',
    '0x5555555555555555555555555555555555555555'
  ]
  const adapter = Object.create(SmartRobinhoodAdapter.prototype)
  adapter.trackedProfiles = new Map(wallets.map((wallet) => [wallet, { quality: 60, smartEligible: false, medianBuyUsd: 100 }]))
  adapter.onTelemetry = () => {}
  adapter.provenance = new Map()
  let final
  for (let i = 0; i < wallets.length; i += 1) {
    const hash = `0x${String(i + 6).repeat(64)}`
    adapter.sequencerOrigins = new Map([[hash, { sender: wallets[i], to: ROUTER, selector: '0x3593564c', seenAt: Date.now() }]])
    final = await adapter.attributeTrade({ token: TOKEN }, true, hash, 1)
  }
  assert.equal(final.attribution.kind, 'tracked_watch_observation')
  assert.equal(final.seeded, false)
})

test('stale sequencer buyer origin expires instead of contaminating later trades', () => {
  const adapter = Object.create(RobinhoodAdapter.prototype)
  adapter.sequencerOrigins = new Map([[HASH, { sender: BUYER, selector: '0x3593564c', seenAt: Date.now() - 180_000 }]])
  assert.equal(adapter.getSequencerOrigin(HASH), null)
  assert.equal(adapter.sequencerOrigins.size, 0)
})
