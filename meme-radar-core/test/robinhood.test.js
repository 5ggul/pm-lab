import test from 'node:test'
import assert from 'node:assert/strict'
import { privateKeyToAccount } from 'viem/accounts'
import { RobinhoodAdapter } from '../src/robinhood.js'
import { SmartRobinhoodAdapter } from '../src/robinhood-smart.js'

const BUYER = '0x1111111111111111111111111111111111111111'
const ROUTER = '0x2222222222222222222222222222222222222222'
const TOKEN = '0x3333333333333333333333333333333333333333'
const HASH = `0x${'4'.repeat(64)}`

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

test('confirmed buy uses generic sequencer signer as smart buyer without receipt RPC', async () => {
  const adapter = Object.create(SmartRobinhoodAdapter.prototype)
  adapter.sequencerOrigins = new Map([[HASH, {
    sender: BUYER,
    to: ROUTER,
    selector: '0x3593564c',
    seenAt: Date.now(),
    sequencerTimestampMs: Date.now() - 500
  }]])
  adapter.trackedProfiles = new Map([[BUYER, { quality: 88, fundingCluster: BUYER }]])
  adapter.onTelemetry = () => {}
  adapter.hood = {
    public: {
      getTransactionReceipt: async () => { throw new Error('receipt RPC must not be called') }
    }
  }

  const result = await adapter.attributeTrade({ token: TOKEN }, true, HASH, 125)

  assert.equal(result.participant, BUYER)
  assert.equal(result.participantSource, 'sequencer_signed_buy')
  assert.equal(result.trader, BUYER)
  assert.equal(result.attribution.kind, 'sequencer_signed_buy')
  assert.equal(result.attribution.countsAsSmart, true)
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
