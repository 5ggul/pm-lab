import test from 'node:test'
import assert from 'node:assert/strict'
import { MAINNET_ADDRESSES } from 'hoodchain'
import { readEthUsdFromV3 } from '../src/eth-usd.js'

const POOL_LOW = '0x1111111111111111111111111111111111111111'
const POOL_HIGH = '0x2222222222222222222222222222222222222222'
const ZERO = '0x0000000000000000000000000000000000000000'

function sqrtPriceX96ForUsd(usd) {
  const rawPrice1Per0 = usd / 1e12
  return BigInt(Math.floor(Math.sqrt(rawPrice1Per0) * (2 ** 96)))
}

test('reads WETH/USDG slot0 and prefers the deeper direct pool', async () => {
  const pools = new Map([[100, POOL_LOW], [500, POOL_HIGH], [3000, ZERO], [10000, ZERO]])
  const publicClient = {
    readContract: async ({ address, functionName, args }) => {
      if (functionName === 'getPool') return pools.get(Number(args[2])) ?? ZERO
      if (functionName === 'token0') return MAINNET_ADDRESSES.weth
      if (functionName === 'token1') return MAINNET_ADDRESSES.usdg
      if (functionName === 'slot0') return [sqrtPriceX96ForUsd(address === POOL_HIGH ? 2475 : 2400), 0, 0, 0, 0, 0, true]
      if (functionName === 'liquidity') return address === POOL_HIGH ? 2_000_000n : 1_000_000n
      throw new Error(`unexpected ${functionName}`)
    }
  }

  const got = await readEthUsdFromV3(publicClient)
  assert.equal(got.pool, POOL_HIGH)
  assert.equal(got.fee, 500)
  assert.ok(Math.abs(got.price - 2475) < 1)
})

test('fails closed when no direct pool has positive liquidity', async () => {
  const publicClient = {
    readContract: async ({ functionName }) => functionName === 'getPool' ? ZERO : 0n
  }
  await assert.rejects(() => readEthUsdFromV3(publicClient), /no live WETH\/USDG/)
})
