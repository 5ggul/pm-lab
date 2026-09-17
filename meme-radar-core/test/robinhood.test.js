import test from 'node:test'
import assert from 'node:assert/strict'
import { RobinhoodAdapter } from '../src/robinhood.js'

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
