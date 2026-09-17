import test from 'node:test'
import assert from 'node:assert/strict'
import { ethPerTokenFromSqrtPrice, marketCapUsdFromPoolPrice, classifyMarketCap } from '../src/v4math.js'

const Q96 = 2 ** 96
const approx = (actual, expected, rel = 1e-8) => {
  assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * rel, `${actual} ≈ ${expected}`)
}

test('V4 sqrt price converts correctly when token is currency0', () => {
  const expected = 0.000025
  const sqrtPriceX96 = BigInt(Math.floor(Math.sqrt(expected) * Q96))
  const got = ethPerTokenFromSqrtPrice({ tokenIs0: true, tokenDecimals: 18, sqrtPriceX96 })
  approx(got, expected)
})

test('V4 sqrt price converts correctly when token is currency1', () => {
  const expected = 0.000025
  const tokenPerEth = 1 / expected
  const sqrtPriceX96 = BigInt(Math.floor(Math.sqrt(tokenPerEth) * Q96))
  const got = ethPerTokenFromSqrtPrice({ tokenIs0: false, tokenDecimals: 18, sqrtPriceX96 })
  approx(got, expected)
})

test('market cap math lands a synthetic launch in PRIME below 100k', () => {
  const mcap = marketCapUsdFromPoolPrice({
    ethPerToken: 0.000025,
    ethUsd: 2000,
    totalSupply: 1_000_000n * 10n ** 18n,
    tokenDecimals: 18
  })
  approx(mcap, 50_000)
  assert.equal(classifyMarketCap(mcap), 'PRIME_EARLY')
})

test('1m and above is excluded', () => {
  assert.equal(classifyMarketCap(999_999), 'LATE_EARLY')
  assert.equal(classifyMarketCap(1_000_000), null)
})
