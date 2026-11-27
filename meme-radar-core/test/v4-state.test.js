import test from 'node:test'
import assert from 'node:assert/strict'
import { ROBINHOOD_V4_STATE_VIEW, readV4MarketCap, readV4PoolState } from '../src/v4-state.js'

const POOL_ID = `0x${'11'.repeat(32)}`
const Q96 = 2n ** 96n

function client({ liquidity = 1_000n } = {}) {
  return {
    async readContract({ address, functionName, args }) {
      assert.equal(address, ROBINHOOD_V4_STATE_VIEW)
      assert.deepEqual(args, [POOL_ID])
      if (functionName === 'getSlot0') return [Q96, 0, 0, 10_000]
      if (functionName === 'getLiquidity') return liquidity
      throw new Error(`unexpected function ${functionName}`)
    }
  }
}

test('reads Robinhood V4 StateView slot0 and liquidity', async () => {
  const state = await readV4PoolState(client(), POOL_ID)
  assert.equal(state.sqrtPriceX96, Q96)
  assert.equal(state.tick, 0)
  assert.equal(state.lpFee, 10_000)
  assert.equal(state.liquidity, 1_000n)
})

test('computes current market cap from StateView without a swap event', async () => {
  const result = await readV4MarketCap(client(), {
    poolId: POOL_ID,
    tokenIs0: true,
    tokenDecimals: 18,
    quoteDecimals: 18,
    totalSupply: 1_000n * 10n ** 18n,
    quoteUsd: 2
  })
  assert.equal(result.quotePerToken, 1)
  assert.equal(result.marketCapUsd, 2_000)
})

test('zero-liquidity pool is not used for horizon pricing', async () => {
  const result = await readV4MarketCap(client({ liquidity: 0n }), {
    poolId: POOL_ID,
    tokenIs0: true,
    tokenDecimals: 18,
    quoteDecimals: 18,
    totalSupply: 1_000n * 10n ** 18n,
    quoteUsd: 2
  })
  assert.equal(result.marketCapUsd, 0)
})
