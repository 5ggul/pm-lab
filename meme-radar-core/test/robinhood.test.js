import test from 'node:test'
import assert from 'node:assert/strict'
import { privateKeyToAccount } from 'viem/accounts'
import { RobinhoodAdapter } from '../src/robinhood.js'
import { SmartRobinhoodAdapter } from '../src/robinhood-smart.js'

const BUYER = '0x1111111111111111111111111111111111111111'
const ROUTER = '0x2222222222222222222222222222222222222222'
const TOKEN = '0x3333333333333333333333333333333333333333'
const LAUNCHPAD = '0xf193ede778a92dc37cb450a1ef1565ed1e8b7964'
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

test('recovers the signer from a serialized era-2 sequencer buy transaction', async () => {
  const account = privateKeyToAccount(`0x${'1'.repeat(64)}`)
  const raw = await account.signTransaction({
    chainId: 4663,
    nonce: 0,
    gas: 150_000n,
    maxFeePerGas: 1_000_000_000n,
    maxPriorityFeePerGas: 100_000_000n,
    to: LAUNCHPAD,
    value: 1n,
    data: '0xc1120e3d'
  })
  const adapter = Object.create(RobinhoodAdapter.prototype)
  adapter.sequencerOrigins = new Map()

  const origin = await adapter.rememberSequencerBuyOrigin({ raw, hash: HASH }, { timestamp: 1_800_000_000 }, '0xc1120e3d')

  assert.equal(origin.sender, account.address.toLowerCase())
  assert.equal(adapter.getSequencerOrigin(HASH)?.sender, account.address.toLowerCase())
})

test('confirmed era-2 buy uses sequencer signer as smart buyer without receipt RPC', async () => {
  const adapter = Object.create(SmartRobinhoodAdapter.prototype)
  adapter.sequencerOrigins = new Map([[HASH, {
    sender: BUYER,
    selector: '0xc1120e3d',
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
    selector: '0xc1120e3d',
    seenAt: Date.now() - 180_000
  }]])

  assert.equal(adapter.getSequencerOrigin(HASH), null)
  assert.equal(adapter.sequencerOrigins.size, 0)
})
