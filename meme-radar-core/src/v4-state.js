import { parseAbi } from 'viem'
import { marketCapUsdFromQuotePrice, quotePerTokenFromSqrtPrice } from './v4math.js'

// Official Uniswap v4 StateView deployment on Robinhood Chain (chainId 4663).
export const ROBINHOOD_V4_STATE_VIEW = '0xf3334192d15450cdd385c8b70e03f9a6bd9e673b'

const stateViewAbi = parseAbi([
  'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96,int24 tick,uint24 protocolFee,uint24 lpFee)',
  'function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)'
])

export async function readV4PoolState(publicClient, poolId, { stateView = ROBINHOOD_V4_STATE_VIEW } = {}) {
  const [slot0, liquidity] = await Promise.all([
    publicClient.readContract({
      address: stateView,
      abi: stateViewAbi,
      functionName: 'getSlot0',
      args: [poolId]
    }),
    publicClient.readContract({
      address: stateView,
      abi: stateViewAbi,
      functionName: 'getLiquidity',
      args: [poolId]
    })
  ])

  const [sqrtPriceX96, tick, protocolFee, lpFee] = slot0
  return {
    poolId,
    sqrtPriceX96,
    tick: Number(tick),
    protocolFee: Number(protocolFee),
    lpFee: Number(lpFee),
    liquidity
  }
}

export async function readV4MarketCap(publicClient, {
  poolId,
  tokenIs0,
  tokenDecimals,
  quoteDecimals,
  totalSupply,
  quoteUsd,
  stateView = ROBINHOOD_V4_STATE_VIEW
}) {
  const state = await readV4PoolState(publicClient, poolId, { stateView })
  if (!(state.liquidity > 0n)) return { ...state, quotePerToken: 0, marketCapUsd: 0 }

  const quotePerToken = quotePerTokenFromSqrtPrice({
    tokenIs0,
    tokenDecimals,
    quoteDecimals,
    sqrtPriceX96: state.sqrtPriceX96
  })
  const marketCapUsd = marketCapUsdFromQuotePrice({
    quotePerToken,
    quoteUsd,
    totalSupply,
    tokenDecimals
  })
  return { ...state, quotePerToken, marketCapUsd }
}
