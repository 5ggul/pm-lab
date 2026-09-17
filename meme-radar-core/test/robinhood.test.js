import test from 'node:test'
import assert from 'node:assert/strict'
import { privateKeyToAccount } from 'viem/accounts'
import { RobinhoodAdapter } from '../src/robinhood.js'
import { SmartRobinhoodAdapter } from '../src/robinhood-smart.js'

const BUYER = '0x1111111111111111111111111111111111111111'
const ROUTER = '0x2222222222222222222222222222222222222222'
const DIRECT_ROUTER = '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f'
const TOKEN = '0x3333333333333333333333333333333333333333'
const HASH = `0x${'4'.repeat(64)}`

function smartAdapter({ tracked = true, to = ROUTER } = {}) {
  const adapter = Object.create(SmartRobinhoodAdapter.prototype)
  adapter.sequencerOrigins = new Map([[HASH, {
    sender: BUYER,
    to,
    selector: '0x3593564c',
    seenAt: Date.now(),
    sequencerTimestampMs: Date.now() - 500
  }]])
  adapter.trackedProfiles = tracked
    ? new Map([[BUYER, { quality: 88, fundingCluster: BUYER, medianBuyUsd: 100 }]])
    : new Map()
  adapter.onTelemetry = () => {}
  adapter.provenance = new Map()
  adapter.hood = {
    public: {
      getTransactionReceipt: async () => { throw new Error('receipt RPC must not be called') }
    }
  }
  return adapter
}

test('normalizes tx sender as ordinary buyer participant even when it is not a tracked smart wallet', async () => {
  const adapter = Object.create(RobinhoodAdapter.prototype)
  adapter.hood = {
    public: {
      getTransaction: async () => ({ from: BUYER, to: ROUTER })
    }
  }
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
    chainId: 4663,
    nonce: 0,
    gas: 150_000n,
    maxFeePerGas: 1_000_000_000n,
    maxPriorityFeePerGas: 100_000_000n,
    to: ROUTER,
    value: 1n,
    data: '0x3593564c'
  })
  const adapter = Object.create(RobinhoodAdapter.prototype)
  adapter.sequencerOrigins = new Map()
  adapter.lastOriginPruneAt = 0

  const origin = await adapter.rememberSequencerOrigin({
    raw,
    hash: HASH,
    transaction: { to: ROUTER, data: '0x3593564c', value: 1n }
  }, { timestamp: 1_800_000_000 })

  assert.equal(origin.sender, account.address.toLowerCase())
  assert.equal(origin.to, ROUTER)
  assert.equal(origin.selector, '0x3593564c')
  assert.equal(adapter.getSequencerOrigin(HASH)?.sender, account.address.toLowerCase())
})

test('confirmed non-dust sequencer buy can receive smart credit without receipt RPC', async () => {
  const adapter = smartAdapter()
  const result = await adapter.attributeTrade({ token: TOKEN }, true, HASH, 125)

  assert.equal(result.participant, BUYER)
  assert.equal(result.participantSource, 'sequencer_signed_buy')
  assert.equal(result.trader, BUYER)
  assert.equal(result.attribution.kind, 'sequencer_signed_buy')
  assert.equal(result.attribution.countsAsSmart, true)
  assert.equal(result.seeded, false)
})

test('sequencer signer remains an ordinary buyer but dust buy gets no smart credit', async () => {
  const adapter = smartAdapter()
  const result = await adapter.attributeTrade({ token: TOKEN }, true, HASH, 1)

  assert.equal(result.participant, BUYER)
  assert.equal(result.participantSource, 'sequencer_signed_buy')
  assert.match(result.trader, /^tx:/)
  assert.equal(result.attribution.kind, 'dust')
  assert.equal(result.attribution.countsAsSmart, false)
})

test('known relayer/direct-router signer is not counted as an economic buyer', async () => {
  const adapter = smartAdapter({ to: DIRECT_ROUTER })
  const result = await adapter.attributeTrade({ token: TOKEN }, true, HASH, 125)

  assert.equal(result.participant, null)
  assert.equal(result.participantSource, 'sequencer_relayer_unresolved')
  assert.match(result.trader, /^tx:/)
  assert.equal(result.attribution.kind, 'direct')
  assert.equal(result.attribution.countsAsSmart, false)
  assert.equal(result.seeded, false)
})

test('untracked sequencer signer counts only as ordinary buyer', async () => {
  const adapter = smartAdapter({ tracked: false })
  const result = await adapter.attributeTrade({ token: TOKEN }, true, HASH, 125)

  assert.equal(result.participant, BUYER)
  assert.equal(result.participantSource, 'sequencer_signed_buy')
  assert.match(result.trader, /^tx:/)
  assert.equal(result.attribution.kind, 'unattributed')
  assert.equal(result.attribution.countsAsSmart, false)
})

test('three tracked dust signers can mark seeded manipulation without becoming smart', async () => {
  const wallets = [
    '0x1111111111111111111111111111111111111111',
    '0x4444444444444444444444444444444444444444',
    '0x5555555555555555555555555555555555555555'
  ]
  const adapter = Object.create(SmartRobinhoodAdapter.prototype)
  adapter.trackedProfiles = new Map(wallets.map((wallet) => [wallet, { quality: 80, medianBuyUsd: 100 }]))
  adapter.onTelemetry = () => {}
  adapter.provenance = new Map()
  adapter.hood = { public: { getTransactionReceipt: async () => { throw new Error('receipt RPC must not be called') } } }

  let final
  for (let i = 0; i < wallets.length; i += 1) {
    const hash = `0x${String(i + 6).repeat(64)}`
    adapter.sequencerOrigins = new Map([[hash, {
      sender: wallets[i], to: ROUTER, selector: '0x3593564c', seenAt: Date.now()
    }]])
    final = await adapter.attributeTrade({ token: TOKEN }, true, hash, 1)
    assert.equal(final.attribution.countsAsSmart, false)
  }
  assert.equal(final.seeded, true)
})

test('stale sequencer buyer origin expires instead of contaminating later trades', () => {
  const adapter = Object.create(RobinhoodAdapter.prototype)
  adapter.sequencerOrigins = new Map([[HASH, {
    sender: BUYER,
    selector: '0x3593564c',
    seenAt: Date.now() - 180_000
  }]])

  assert.equal(adapter.getSequencerOrigin(HASH), null)
  assert.equal(adapter.sequencerOrigins.size, 0)
})
