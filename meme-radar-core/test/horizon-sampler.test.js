import test from 'node:test'
import assert from 'node:assert/strict'
import { HorizonSampler } from '../src/horizon-sampler.js'

const TOKEN = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const POOL_ID = `0x${'22'.repeat(32)}`
const Q96 = 2n ** 96n

test('sampler reads one V4 pool and settles all due wallet horizons with one price', async () => {
  const settlements = []
  let slot0Reads = 0
  let liquidityReads = 0
  const learner = {
    tokensDueForSampling() {
      return [{
        token: TOKEN,
        venue: 'uniswap-v4',
        poolId: POOL_ID,
        tokenIs0: true,
        quoteAddress: '0x0000000000000000000000000000000000000000',
        quoteSymbol: 'ETH',
        quoteDecimals: 18,
        quoteUsdKind: 'eth',
        horizons: [60]
      }]
    },
    settleToken(token, marketCapUsd, measuredAt, options) {
      settlements.push({ token, marketCapUsd, measuredAt, options })
      return 3
    }
  }
  const adapter = {
    hood: {
      public: {
        async readContract({ functionName }) {
          if (functionName === 'getSlot0') {
            slot0Reads += 1
            return [Q96, 0, 0, 10_000]
          }
          if (functionName === 'getLiquidity') {
            liquidityReads += 1
            return 500n
          }
          throw new Error(`unexpected ${functionName}`)
        }
      }
    },
    async ensureTokenMeta() {
      return { decimals: 18, totalSupply: 1_000n * 10n ** 18n }
    },
    async quoteUsd() {
      return 2
    }
  }

  const sampler = new HorizonSampler({ learner, adapter, intervalMs: 30_000 })
  const result = await sampler.sampleOnce(1_800_000_000_000)
  assert.equal(result.dueTokens, 1)
  assert.equal(result.sampled, 1)
  assert.equal(result.settled, 3)
  assert.equal(slot0Reads, 1)
  assert.equal(liquidityReads, 1)
  assert.equal(settlements.length, 1)
  assert.equal(settlements[0].marketCapUsd, 2_000)
  assert.equal(settlements[0].options.source, 'v4_state_view')
})

test('sampler records zero-liquidity state as an explicit rug outcome', async () => {
  const settlements = []
  const telemetry = []
  const learner = {
    tokensDueForSampling() {
      return [{
        token: TOKEN,
        venue: 'uniswap-v4',
        poolId: POOL_ID,
        tokenIs0: true,
        quoteAddress: '0x0000000000000000000000000000000000000000',
        quoteSymbol: 'ETH',
        quoteDecimals: 18,
        quoteUsdKind: 'eth',
        horizons: [300]
      }]
    },
    settleToken(token, marketCapUsd, measuredAt, options) {
      settlements.push({ token, marketCapUsd, measuredAt, options })
      return 1
    }
  }
  const adapter = {
    hood: {
      public: {
        async readContract({ functionName }) {
          if (functionName === 'getSlot0') return [Q96, 0, 0, 10_000]
          if (functionName === 'getLiquidity') return 0n
          throw new Error(`unexpected ${functionName}`)
        }
      }
    },
    async ensureTokenMeta() {
      return { decimals: 18, totalSupply: 1_000n * 10n ** 18n }
    },
    async quoteUsd() {
      return 2
    }
  }

  const sampler = new HorizonSampler({ learner, adapter, onTelemetry: (event) => telemetry.push(event) })
  const result = await sampler.sampleOnce(1_800_000_000_000)
  assert.equal(result.sampled, 1)
  assert.equal(result.settled, 1)
  assert.equal(settlements.length, 1)
  assert.equal(settlements[0].marketCapUsd, 0)
  assert.equal(settlements[0].options.source, 'v4_state_view_zero_liquidity')
  assert.equal(settlements[0].options.allowZero, true)
  assert.equal(telemetry.some((event) => event.type === 'horizon-sample-rug'), true)
})
